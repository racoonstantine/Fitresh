/* ---------- Food search-and-log (nutrition engine) ---------- */
(function(){
  let searchDebounce;
  document.getElementById('foodIncludeEstimates').addEventListener('change', ()=>{
    clearTimeout(searchDebounce);
    searchFoodsCombined(document.getElementById('foodSearchInput').value.trim());
  });
  document.getElementById('foodSearchInput').addEventListener('input', (e)=>{
    clearTimeout(searchDebounce);
    const q = e.target.value.trim();
    searchDebounce = setTimeout(()=> searchFoodsCombined(q), 500);
  });
  // Manual fallback -- searches immediately (no debounce wait) and works as
  // a retry after a dropped/slow search without needing to edit the text.
  document.getElementById('foodSearchBtn').addEventListener('click', ()=>{
    clearTimeout(searchDebounce);
    searchFoodsCombined(document.getElementById('foodSearchInput').value.trim());
  });
  document.getElementById('foodSearchInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      clearTimeout(searchDebounce);
      searchFoodsCombined(e.target.value.trim());
    }
  });

  ['input','change'].forEach(eventName => document.getElementById('foodSearchResults').addEventListener(eventName, e=>{
    const panel = e.target.closest('.food-result-amount');
    if(!panel) return;
    const row = foodSearchResultsCache[Number(panel.dataset.idx)];
    if(row) updateFoodMeasurement(row, panel);
  }));

  document.getElementById('foodSearchStatus').addEventListener('click', e=>{
    const suggestion = e.target.closest('[data-food-suggestion]');
    if(!suggestion) return;
    const query = suggestion.dataset.foodSuggestion;
    document.getElementById('foodSearchInput').value = query;
    searchFoodsCombined(query);
  });
  document.getElementById('foodSearchResults').addEventListener('click', async (e)=>{
    const copyBtn=e.target.closest('[data-personal-copy]');
    if(copyBtn){e.stopPropagation();window.personalFoods.openCopy(foodSearchResultsCache[Number(copyBtn.dataset.personalCopy)]);return;}
    const cancelBtn = e.target.closest('.food-log-cancel');
    if(cancelBtn){
      e.stopPropagation();
      const idx = cancelBtn.dataset.idx;
      const panel = document.querySelector(`.food-result-amount[data-idx="${idx}"]`);
      if(panel) panel.style.display = 'none';
      return;
    }
    const confirmBtn = e.target.closest('.food-log-confirm');
    if(confirmBtn){
      e.stopPropagation();
      const idx = parseInt(confirmBtn.dataset.idx, 10);
      const row = foodSearchResultsCache[idx];
      const amountInput = confirmBtn.closest('.food-result-amount').querySelector('.food-amount-input');
      let measurement;
      try { measurement = foodMeasurement(row, confirmBtn.closest('.food-result-amount')); }
      catch(err){ alert(err.message); amountInput.focus(); return; }
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Saving…';
      try{
        let foodId = row.id;
        if(row._origin === 'off' || row._origin === 'catalog'){
          const {ok, data} = await safeFetchJson('api/foods.php?action=save_external', {
            method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({source: row._origin === 'catalog' ? 'catalog' : 'off', external_id: row.external_id, name: row.name, brand: row.brand, canonical_unit: row.canonical_unit, nutrients: row.nutrients})
          });
          if(!ok || data.error || !data.id) throw new Error(data.error || 'Food could not be saved');
          foodId = data.id;
        }
        const {ok: logOk, data: logged} = await safeFetchJson('api/meals.php?action=log', {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({date: nutriSelectedDate || dateStrForOffset(0), meal_type: document.getElementById('mealLogType').value, component: {food_id: foodId, ...measurement.request}})
        });
        if(!logOk || logged.error) throw new Error(logged.error || 'Meal could not be logged');
        recordRecentFood(row, foodId);
        ++foodSearchGeneration;
        document.getElementById('foodSearchInput').value = '';
        foodSearchResultsCache = [];
        renderFoodSearchResults();
        renderTodayMeals();
        renderNutrition();
      }catch(err){
        alert(err.message || 'Could not save this food — try again.');
        confirmBtn.textContent = 'Failed — try again';
        confirmBtn.disabled = false;
      }
      return;
    }
    if(e.target.closest('.food-result-amount')) return; // clicks inside the expanded amount/macro panel shouldn't re-toggle it
    const row = e.target.closest('.food-result-row');
    if(row){
      const idx = row.dataset.idx;
      document.querySelectorAll('.food-result-amount').forEach(el=>{
        el.style.display = (el.dataset.idx === idx && el.style.display !== 'block') ? 'block' : 'none';
      });
    }
  });

  // "My foods · Create food" (personal-foods.js) already covers this --
  // private, reusable by name in search, versioned, and with an opt-in
  // submission queue for admin review -- so this button opens that instead
  // of the ad-hoc one-off form it used to show.
  document.getElementById('createCustomFoodBtn').addEventListener('click', ()=>{
    if(window.personalFoods) window.personalFoods.open();
  });
})();

/* ---------- Log Meal (dedicated full-page logger) ---------- */
(function(){
  let lmItems = []; // {name, amount, unit, nutrients (already scaled to amount), source: 'catalog'|'off'|'library'|'manual', payload}
  let lmSearchResultsCache = [];
  let lmSearchGeneration = 0;

  window.openLogMealScreen = function(mealType){
    lmItems = [];
    document.getElementById('lmDate').value = nutriSelectedDate || dateStrForOffset(0);
    document.getElementById('lmMealType').value = mealType || document.getElementById('mealLogType').value || 'breakfast';
    document.getElementById('lmSearchInput').value = '';
    document.getElementById('lmSearchResults').innerHTML = '';
    document.getElementById('lmSearchStatus').style.display = 'none';
    document.getElementById('lmNotes').value = '';
    document.getElementById('lmSaveStatus').style.display = 'none';
    ['lmManualName','lmManualCal','lmManualProtein','lmManualFat','lmManualCarbs','lmManualSodium','lmManualFiber','lmManualSugar'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('lmManualAmount').value = 100;
    document.getElementById('lmMoreMacros').style.display = 'none';
    // AI Assist tab: clear the whole round trip (inputs, generated prompt,
    // pasted reply, any error/success note) so a previous session's prompt
    // or parsed reply never lingers into a fresh "Log a meal" open.
    ['aiFoodName','aiFoodAmount','aiFoodDesc','aiFoodPromptOut','aiFoodReplyIn'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('aiFoodPromptWrap').style.display = 'none';
    document.getElementById('aiFoodParseError').style.display = 'none';
    document.getElementById('aiFoodParseSuccess').style.display = 'none';
    lmSetMode('search');
    renderLmMealItems();
    renderRecentFavorites('lm');
    document.getElementById('logMealScreen').style.display = 'flex';
  };
  function closeLogMealScreen(){
    document.getElementById('logMealScreen').style.display = 'none';
  }
  document.getElementById('logMealClose').addEventListener('click', closeLogMealScreen);

  function lmSetMode(mode){
    document.querySelectorAll('#lmModeTabs .main-tab').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.lmMode === mode);
    });
    document.getElementById('lmSearchMode').style.display = mode === 'search' ? 'block' : 'none';
    document.getElementById('lmManualMode').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('lmAiMode').style.display = mode === 'ai' ? 'block' : 'none';
  }
  document.getElementById('lmModeTabs').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-lm-mode]');
    if(!btn) return;
    lmSetMode(btn.dataset.lmMode);
  });

  let lmSearchDebounce;
  document.getElementById('lmSearchStatus').addEventListener('click', e=>{
    const suggestion = e.target.closest('[data-food-suggestion]');
    if(!suggestion) return;
    clearTimeout(lmSearchDebounce);
    document.getElementById('lmSearchInput').value = suggestion.dataset.foodSuggestion;
    lmSearchFoods(suggestion.dataset.foodSuggestion);
  });
  document.getElementById('lmSearchInput').addEventListener('input', (e)=>{
    clearTimeout(lmSearchDebounce);
    const q = e.target.value.trim();
    lmSearchDebounce = setTimeout(()=> lmSearchFoods(q), 500);
  });
  document.getElementById('lmIncludeEstimates').addEventListener('change', ()=>{
    clearTimeout(lmSearchDebounce);
    lmSearchFoods(document.getElementById('lmSearchInput').value.trim());
  });
  document.getElementById('lmSearchBtn').addEventListener('click', ()=>{
    clearTimeout(lmSearchDebounce);
    lmSearchFoods(document.getElementById('lmSearchInput').value.trim());
  });
  document.getElementById('lmSearchInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      clearTimeout(lmSearchDebounce);
      lmSearchFoods(e.target.value.trim());
    }
  });

  async function lmSearchFoods(query){
    const generation = ++lmSearchGeneration;
    const statusEl = document.getElementById('lmSearchStatus');
    const resultsEl = document.getElementById('lmSearchResults');
    if(query.length < 2){ lmSearchResultsCache = []; resultsEl.innerHTML = ''; statusEl.style.display = 'none'; return; }
    statusEl.textContent = 'Searching…';
    statusEl.style.display = 'block';
    try{
      const localRes = await fetch(`api/food_catalog.php?q=${encodeURIComponent(query)}&include_estimates=${document.getElementById('lmIncludeEstimates')?.checked ? '1' : '0'}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[],error:'Local food search is temporarily unavailable.'}));
      if(generation !== lmSearchGeneration) return;
      const local = (localRes.results || []).map(r => ({...r, _origin:'catalog'})).filter(hasUsableNutrients);
      lmSearchResultsCache = local;
      renderLmSearchResults();
      const suggestions = (localRes.suggestions || []).map(word => `<button type="button" class="timer-btn" data-food-suggestion="${foodSearchEscape(word)}">${foodSearchEscape(word)}</button>`).join(' ');
      statusEl.innerHTML = localRes.error ? foodSearchEscape(localRes.error) : (suggestions ? `Did you mean ${suggestions}?` : (local.length ? 'Choose the preparation and edible part that match your food.' : 'Checking other sources…'));
      const [libRes, offRes] = await Promise.all([
        fetch(`api/foods.php?action=search_library&q=${encodeURIComponent(query)}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[]})),
        fetch(`api/food_search.php?q=${encodeURIComponent(query)}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[]}))
      ]);
      if(generation !== lmSearchGeneration) return;
      if([...resultsEl.querySelectorAll('.food-result-amount')].some(el => el.style.display === 'block')) return;
      const library = (libRes.results || []).map(r => ({...r, _origin:'library'})).filter(hasUsableNutrients).filter(r => r.label !== 'Estimated' || document.getElementById('lmIncludeEstimates')?.checked);
      const external = (offRes.results || []).map(r => ({...r, _origin:'off'})).filter(hasUsableNutrients);
      const localIds = new Set(local.map(r => r.external_id));
      lmSearchResultsCache = [...local, ...library.filter(r => !(r.source === 'catalog' && localIds.has(r.external_id))), ...external];
      renderLmSearchResults();
      if(localRes.error || local.length || suggestions){
        statusEl.style.display = 'block';
      } else if(offRes.error){
        statusEl.textContent = offRes.error;
      } else {
        statusEl.textContent = lmSearchResultsCache.length ? '' : 'No matching foods. Try another name or a more specific preparation.';
        statusEl.style.display = lmSearchResultsCache.length ? 'none' : 'block';
      }
    }catch(e){
      if(generation !== lmSearchGeneration) return;
      statusEl.textContent = 'Search failed — try again.';
    }
  }

  function renderLmSearchResults(){
    const resultsEl = document.getElementById('lmSearchResults');
    if(!lmSearchResultsCache.length){ resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = lmSearchResultsCache.map((r, i) => {
      const canonicalAmount = r.canonical_amount || 100;
      const canonicalUnit = r.canonical_unit || 'g';
      const hasNutrients = r.nutrients && r.nutrients.ENERC_KCAL !== undefined && r.nutrients.ENERC_KCAL !== null;
      const sub = hasNutrients
        ? `${r.label ? r.label + ' · ' : (r.brand ? r.brand + ' · ' : '')}${Math.round(r.nutrients.ENERC_KCAL)} kcal / ${canonicalAmount}${canonicalUnit}`
        : (r.brand || (r._origin === 'library' ? 'Your library' : 'No calorie data'));
      return `
        <div class="food-result-row" data-idx="${i}" style="padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;min-width:0;">
              <span style="color:var(--ink-soft);flex-shrink:0;">${renderFoodIconSvg(getFoodIcon(r), 20)}</span>
              <div style="min-width:0;">
                <div style="font-weight:600;font-size:13.5px;">${foodSearchEscape(foodDisplayName(r))}</div>
                <div style="font-size:11.5px;color:var(--ink-soft);">${foodSearchEscape(sub)}${r.complete === false ? ' · Some nutrients unavailable' : ''}</div>
                ${r.confidence ? `<div style="font-size:11.5px;color:var(--ink-soft);" title="${foodSearchEscape(r.confidence.reason)}">${foodSearchEscape(r.confidence.level)} confidence</div>` : ''}
                ${r.estimate ? `<details onclick="event.stopPropagation()"><summary>Estimate assumptions and limitations</summary><p style="font-size:12px;">${foodSearchEscape(r.estimate.assumptions)}</p><p style="font-size:12px;">${foodSearchEscape(r.estimate.limitations)}</p></details>` : ''}
                <button type="button" class="timer-btn" data-personal-copy="${i}" data-personal-surface="lm">Save a personal copy</button>
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;stroke:var(--ink-soft);flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>
          </div>
          <div class="food-result-amount" data-idx="${i}" style="display:none;margin-top:8px;">
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="number" min="0.000001" step="any" aria-label="Food amount" class="food-amount-input" data-idx="${i}" value="${canonicalAmount}" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
              ${foodMeasureControls(r, i)}
            </div>
            <div class="food-macro-preview" data-idx="${i}" style="font-size:11.5px;color:var(--ink-soft);margin-top:8px;">${macroPreviewText(r, canonicalAmount)}</div>
            <button class="timer-btn start lm-add-search-item" data-idx="${i}" type="button" style="width:100%;margin-top:8px;padding:7px 0;">+ Add to meal</button>
          </div>
        </div>
      `;
    }).join('');
  }

  ['input','change'].forEach(eventName => document.getElementById('lmSearchResults').addEventListener(eventName, e=>{
    const panel = e.target.closest('.food-result-amount');
    if(!panel) return;
    const row = lmSearchResultsCache[Number(panel.dataset.idx)];
    if(row) updateFoodMeasurement(row, panel);
  }));
  document.getElementById('lmSearchResults').addEventListener('click', async (e)=>{
    const copyBtn=e.target.closest('[data-personal-copy]');
    if(copyBtn){e.stopPropagation();window.personalFoods.openCopy(lmSearchResultsCache[Number(copyBtn.dataset.personalCopy)]);return;}
    const addBtn = e.target.closest('.lm-add-search-item');
    if(addBtn){
      e.stopPropagation();
      const idx = parseInt(addBtn.dataset.idx, 10);
      const row = lmSearchResultsCache[idx];
      const amountInput = addBtn.closest('.food-result-amount').querySelector('.food-amount-input');
      let measurement;
      try { measurement = foodMeasurement(row, addBtn.closest('.food-result-amount')); }
      catch(err){ alert(err.message); return; }
      const amount = measurement.amount;
      const macros = scaledFoodMacros(row, amount);
      lmItems.push({
        name: row.name, amount, unit: row.canonical_unit || 'g', measurement: measurement.request,
        kcal: macros.kcal, protein: macros.protein, fat: macros.fat, carbs: macros.carbs,
        source: row._origin, payload: row
      });
      document.getElementById('lmSearchInput').value = '';
      lmSearchResultsCache = [];
      renderLmSearchResults();
      document.getElementById('lmSearchStatus').style.display = 'none';
      renderLmMealItems();
      return;
    }
    if(e.target.closest('.food-result-amount')) return;
    const row = e.target.closest('.food-result-row');
    if(row){
      const idx = row.dataset.idx;
      document.querySelectorAll('#lmSearchResults .food-result-amount').forEach(el=>{
        el.style.display = (el.dataset.idx === idx && el.style.display !== 'block') ? 'block' : 'none';
      });
    }
  });

  document.getElementById('lmManualAdd').addEventListener('click', ()=>{
    const name = document.getElementById('lmManualName').value.trim();
    const errEl = document.getElementById('lmManualError');
    errEl.style.display = 'none';
    if(!name) return;
    const kcal = parseFloat(document.getElementById('lmManualCal').value);
    if(!kcal || kcal <= 0){
      errEl.textContent = 'Enter the calories for this item — it needs at least a calorie estimate to be useful in your log.';
      errEl.style.display = 'block';
      return;
    }
    const amount = parseFloat(document.getElementById('lmManualAmount').value) || 100;
    const unit = document.getElementById('lmManualUnit').value;
    lmItems.push({
      name, amount, unit,
      kcal,
      protein: parseFloat(document.getElementById('lmManualProtein').value) || 0,
      fat: parseFloat(document.getElementById('lmManualFat').value) || 0,
      carbs: parseFloat(document.getElementById('lmManualCarbs').value) || 0,
      sodium: parseFloat(document.getElementById('lmManualSodium').value) || null,
      fiber: parseFloat(document.getElementById('lmManualFiber').value) || null,
      sugar: parseFloat(document.getElementById('lmManualSugar').value) || null,
      source: 'manual'
    });
    ['lmManualName','lmManualCal','lmManualProtein','lmManualFat','lmManualCarbs','lmManualSodium','lmManualFiber','lmManualSugar'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('lmManualAmount').value = 100;
    renderLmMealItems();
  });
  document.getElementById('lmToggleMoreMacros').addEventListener('click', ()=>{
    const grid = document.getElementById('lmMoreMacros');
    grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
  });

  // ---------- AI prompt-assist logging (food) ----------
  // Clipboard-mediated, no API key: we generate a plain-text prompt the user
  // pastes into their own AI chat (ChatGPT/Gemini/etc.), then parse the AI's
  // plain-text reply back out and autofill the existing Manual Log fields
  // above for the user to review before saving through the normal pipeline.
  function buildFoodAiPrompt(name, amount, desc){
    const lines = [];
    lines.push('You are a nutrition estimation assistant. Estimate the nutrition facts for the meal described below.');
    lines.push('');
    lines.push('Food: ' + (name || '(not specified -- infer from any description or photo below)'));
    lines.push('Weight/quantity: ' + (amount || '(not specified -- estimate a reasonable serving size)'));
    if(desc) lines.push('Description: ' + desc);
    lines.push('');
    if(!name || !amount){
      lines.push("If you have a photo of this food, please attach it to this chat -- it helps a lot, especially since the food name and/or weight weren't given.");
      lines.push('');
    }
    lines.push('If this meal has MORE THAN ONE distinct food item (e.g. rice + a main dish + a drink), give each item its OWN separate block in the exact format below, one after another, in the same order they were mentioned. Do not merge multiple items into a single block.');
    lines.push('');
    lines.push('Reply with ONLY block(s) in this exact format, filled in with your best estimate. Leave a line blank after the colon if you truly cannot estimate it. No extra commentary.');
    lines.push('Food: <food name>');
    lines.push('Amount: <estimated weight or quantity, e.g. 250g or 1 cup>');
    lines.push('Calories: <number> kcal');
    lines.push('Protein: <number> g');
    lines.push('Fat: <number> g');
    lines.push('Carbs: <number> g');
    lines.push('Sodium: <number> mg');
    lines.push('Fiber: <number> g');
    lines.push('Sugar: <number> g');
    return lines.join('\n');
  }
  // Splits a reply into one chunk per food item -- a new item starts at every
  // "Food:" line, so this works whether or not the AI adds "Item 1:"-style
  // headers or blank lines between blocks, and ignores any chatter before
  // the first "Food:" line.
  function splitFoodReplyBlocks(text){
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let current = null;
    lines.forEach(line => {
      if(/^\s*Food\s*:/i.test(line)){
        if(current) blocks.push(current.join('\n'));
        current = [line];
      } else if(current){
        current.push(line);
      }
    });
    if(current) blocks.push(current.join('\n'));
    return blocks.map(block => parseLabeledReply(block, ['Food','Amount','Calories','Protein','Fat','Carbs','Sodium','Fiber','Sugar']));
  }
  document.getElementById('aiFoodGenerateBtn').addEventListener('click', ()=>{
    const name = document.getElementById('aiFoodName').value.trim();
    const amount = document.getElementById('aiFoodAmount').value.trim();
    const desc = document.getElementById('aiFoodDesc').value.trim();
    document.getElementById('aiFoodPromptOut').value = buildFoodAiPrompt(name, amount, desc);
    document.getElementById('aiFoodPromptWrap').style.display = 'block';
  });
  document.getElementById('aiFoodCopyBtn').addEventListener('click', (e)=>{
    copyTextToClipboard(document.getElementById('aiFoodPromptOut').value, e.currentTarget);
  });
  function amountRawToAmountUnit(amountRaw){
    const m = (amountRaw || '').match(/^([\d.]+)\s*(g|gram|grams|gm|ml|millilit(?:er|re)s?)?/i);
    if(!m) return { amount: 100, unit: 'serving' };
    const unit = (m[2] || '').toLowerCase();
    return {
      amount: parseFloat(m[1]),
      unit: unit.startsWith('g') ? 'g' : (unit.startsWith('m') ? 'ml' : 'serving')
    };
  }
  document.getElementById('aiFoodParseBtn').addEventListener('click', ()=>{
    const reply = document.getElementById('aiFoodReplyIn').value;
    const errEl = document.getElementById('aiFoodParseError');
    const successEl = document.getElementById('aiFoodParseSuccess');
    errEl.style.display = 'none';
    successEl.style.display = 'none';
    const items = splitFoodReplyBlocks(reply);
    if(!reply.trim() || items.length === 0){
      errEl.textContent = "Couldn't find any food items in that reply -- make sure the AI replied using the format from the generated prompt, then try again.";
      errEl.style.display = 'block';
      return;
    }
    const typedName = document.getElementById('aiFoodName').value.trim();
    let added = 0, skipped = 0;
    items.forEach((fields, idx) => {
      const calories = firstNumber(fields.Calories);
      if(isNaN(calories) || calories <= 0){ skipped++; return; }
      const { amount, unit } = amountRawToAmountUnit(fields.Amount);
      const protein = firstNumber(fields.Protein);
      const fat = firstNumber(fields.Fat);
      const carbs = firstNumber(fields.Carbs);
      const sodium = firstNumber(fields.Sodium);
      const fiber = firstNumber(fields.Fiber);
      const sugar = firstNumber(fields.Sugar);
      lmItems.push({
        // Only the first item falls back to the user's own typed name --
        // later items always use the AI's own name for that block, since
        // reusing the typed name for every item would mislabel a multi-item
        // reply (e.g. rice + adobo would both end up called "adobo").
        name: (idx === 0 && typedName) || fields.Food || 'AI-estimated food',
        amount, unit,
        kcal: calories,
        protein: isNaN(protein) ? 0 : protein,
        fat: isNaN(fat) ? 0 : fat,
        carbs: isNaN(carbs) ? 0 : carbs,
        sodium: isNaN(sodium) ? null : sodium,
        fiber: isNaN(fiber) ? null : fiber,
        sugar: isNaN(sugar) ? null : sugar,
        source: 'manual'
      });
      added++;
    });
    if(added === 0){
      errEl.textContent = "Found food item(s) in that reply, but none had a usable calorie value -- make sure the AI replied using the format from the generated prompt, then try again.";
      errEl.style.display = 'block';
      return;
    }
    renderLmMealItems();
    successEl.textContent = `Added ${added} item${added === 1 ? '' : 's'} to this meal below` + (skipped ? ` (${skipped} skipped -- no calorie value)` : '') + ' -- review and edit if needed, then save.';
    successEl.style.display = 'block';
    lmSetMode('manual');
  });

  function renderLmMealItems(){
    const el = document.getElementById('lmMealItems');
    const totalEl = document.getElementById('lmMealTotal');
    const saveBtn = document.getElementById('lmSaveBtn');
    if(!lmItems.length){
      el.innerHTML = `<div class="dash-empty">No items added yet.</div>`;
      totalEl.style.display = 'none';
      saveBtn.disabled = true;
      return;
    }
    el.innerHTML = lmItems.map((it, i) => `
      <div class="lm-item-row">
        <div>
          <div class="lm-item-name">${foodSearchEscape(it.name)}</div>
          <div class="lm-item-sub">${it.amount}${it.unit} · ${Math.round(it.kcal)} kcal · ${it.protein}g P / ${it.fat}g F / ${it.carbs}g C</div>
          ${(it.sodium || it.fiber || it.sugar) ? `<div class="lm-item-sub">${it.sodium ? Math.round(it.sodium) + 'mg sodium' : ''}${(it.sodium && (it.fiber || it.sugar)) ? ' · ' : ''}${it.fiber ? it.fiber.toFixed(1) + 'g fiber' : ''}${(it.fiber && it.sugar) ? ' · ' : ''}${it.sugar ? it.sugar.toFixed(1) + 'g sugar' : ''}</div>` : ''}
        </div>
        <button type="button" class="lm-item-remove" data-remove-idx="${i}" title="Remove">✕</button>
      </div>
    `).join('');
    el.querySelectorAll('[data-remove-idx]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        lmItems.splice(parseInt(btn.dataset.removeIdx, 10), 1);
        renderLmMealItems();
      });
    });
    const totals = lmItems.reduce((acc, it)=>({
      kcal: acc.kcal + it.kcal, protein: acc.protein + it.protein, fat: acc.fat + it.fat, carbs: acc.carbs + it.carbs
    }), {kcal:0, protein:0, fat:0, carbs:0});
    totalEl.style.display = 'flex';
    totalEl.innerHTML = `<span>Meal total</span><span>${Math.round(totals.kcal)} kcal · ${totals.protein.toFixed(1)}g P / ${totals.fat.toFixed(1)}g F / ${totals.carbs.toFixed(1)}g C</span>`;
    saveBtn.disabled = false;
  }

  document.getElementById('lmSaveBtn').addEventListener('click', async ()=>{
    if(!lmItems.length) return;
    const btn = document.getElementById('lmSaveBtn');
    const statusEl = document.getElementById('lmSaveStatus');
    const date = document.getElementById('lmDate').value || dateStrForOffset(0);
    const mealType = document.getElementById('lmMealType').value;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    statusEl.style.display = 'none';
    try{
      for(const it of [...lmItems]){
        let foodId = null;
        if(it.source === 'library'){
          foodId = it.payload.id;
        } else if(it.source === 'catalog' || it.source === 'off'){
          const {ok, data: food} = await safeFetchJson('api/foods.php?action=save_external', {
            method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({source: it.source, external_id: it.payload.external_id, name: it.payload.name, brand: it.payload.brand, canonical_unit: it.payload.canonical_unit, nutrients: it.payload.nutrients})
          });
          if(!ok || food.error || !food.id) throw new Error(food.error || `Could not save "${it.name}" — try again.`);
          foodId = food.id;
        } else {
          const {ok, data: food} = await safeFetchJson('api/foods.php?action=create_custom', {
            method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              name: it.name, canonical_amount: it.amount, canonical_unit: it.unit,
              nutrients: {
                ENERC_KCAL: it.kcal, PROCNT: it.protein, FAT: it.fat, CHOCDF: it.carbs,
                FIBTG: it.fiber || null, SUGAR: it.sugar || null, NA: it.sodium || null
              }
            })
          });
          if(!ok || food.error || !food.id) throw new Error(food.error || `Could not save "${it.name}" — try again.`);
          foodId = food.id;
        }
        const {ok: logOk, data: logged} = await safeFetchJson('api/meals.php?action=log', {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({date, meal_type: mealType, component: {food_id: foodId, ...(it.measurement || {amount: it.amount, unit: it.unit})}})
        });
        if(!logOk || logged.error) throw new Error(logged.error || `"${it.name}" could not be logged — try again.`);
        recordRecentFood({name: it.name, canonical_unit: it.unit, canonical_amount: it.amount, nutrients: {ENERC_KCAL: it.kcal, PROCNT: it.protein, FAT: it.fat, CHOCDF: it.carbs}}, foodId);
        lmItems.splice(lmItems.indexOf(it), 1);
      }
      const notes = document.getElementById('lmNotes').value.trim();
      if(notes) upsertNutritionFields(date, {notes});
      closeLogMealScreen();
      nutriSelectedDate = date;
      renderTodayMeals();
      renderNutrition();
      renderTodayGlance();
    }catch(err){
      renderLmMealItems();
      statusEl.textContent = err.message || 'Something went wrong saving this meal — try again.';
      statusEl.style.display = 'block';
    }finally{
      btn.disabled = lmItems.length === 0;
      btn.textContent = 'Save to Log';
    }
  });

  document.getElementById('openLogMealBtn').addEventListener('click', ()=> window.openLogMealScreen());
})();

