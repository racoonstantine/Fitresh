// ---------- Recent & favorite foods (quick re-log without a fresh search) ----------
// Snapshots use the same shape as a search result (with _origin fixed to
// 'library', since by the time something is recent/favorited it's already
// a real row in the `foods` table) so they can be dropped straight into
// foodSearchResultsCache/lmSearchResultsCache and reuse all the existing
// measure-picker/confirm/save logic instead of a separate code path.
let recentFoods = [];
let favoriteFoods = [];
async function loadRecentFoods(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'recentFoods', false);
    recentFoods = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){ recentFoods = []; }
}
async function saveRecentFoods(){
  try{ await window.storage.set(STORAGE_PREFIX + 'recentFoods', JSON.stringify(recentFoods), false); }catch(e){}
}
async function loadFavoriteFoods(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'favoriteFoods', false);
    favoriteFoods = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){ favoriteFoods = []; }
}
async function saveFavoriteFoods(){
  try{ await window.storage.set(STORAGE_PREFIX + 'favoriteFoods', JSON.stringify(favoriteFoods), false); }catch(e){}
}
function foodSnapshot(row, foodId){
  return {
    id: foodId, name: row.name, local_name: row.local_name || null, brand: row.brand || null,
    canonical_unit: row.canonical_unit || 'g', canonical_amount: row.canonical_amount || 100,
    personal_food: row.personal_food || null, label: row.label || null,
    confidence: row.confidence || null, estimate: row.estimate || null,
    nutrients: row.nutrients || {}, portions: row.portions || [], _origin: 'library'
  };
}
function recordRecentFood(row, foodId){
  const snap = foodSnapshot(row, foodId);
  recentFoods = recentFoods.filter(f => f.id !== snap.id);
  recentFoods.unshift(snap);
  recentFoods = recentFoods.slice(0, 12);
  saveRecentFoods();
  renderRecentFavorites('food');
  renderRecentFavorites('lm');
}
function isFavoriteFood(id){ return favoriteFoods.some(f => f.id === id); }
function toggleFavoriteFood(snap){
  const idx = favoriteFoods.findIndex(f => f.id === snap.id);
  if(idx >= 0) favoriteFoods.splice(idx, 1);
  else { favoriteFoods.unshift(snap); favoriteFoods = favoriteFoods.slice(0, 20); }
  saveFavoriteFoods();
  renderRecentFavorites('food');
  renderRecentFavorites('lm');
}
// kind is 'food' (Food tab inline search) or 'lm' (dedicated Log Meal page) --
// same list, different container id / results cache / render function.
function renderRecentFavorites(kind){
  const containerId = kind === 'lm' ? 'lmRecentFavorites' : 'foodRecentFavorites';
  const el = document.getElementById(containerId);
  if(!el) return;
  const items = [...favoriteFoods, ...recentFoods.filter(r => !isFavoriteFood(r.id))].slice(0, 10);
  if(!items.length){ el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="font-size:10.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Recent &amp; Favorites</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">
      ${items.map((f, i) => `
        <div class="recent-food-chip" data-idx="${i}" style="flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--line);border-radius:20px;background:var(--paper-raised);font-size:12px;white-space:nowrap;cursor:pointer;">
          <span style="color:var(--ink-soft);">${renderFoodIconSvg(getFoodIcon(f), 16)}</span>
          <span class="recent-food-star" data-idx="${i}" style="cursor:pointer;color:${isFavoriteFood(f.id) ? 'var(--ochre)' : 'var(--ink-soft)'};">${isFavoriteFood(f.id) ? '★' : '☆'}</span>
          <span class="recent-food-name" data-idx="${i}">${foodSearchEscape(foodDisplayName(f))}</span>
        </div>
      `).join('')}
    </div>
  `;
  el.querySelectorAll('.recent-food-star').forEach(star => {
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavoriteFood(items[parseInt(star.dataset.idx, 10)]);
    });
  });
  el.querySelectorAll('.recent-food-name').forEach(nameEl => {
    nameEl.addEventListener('click', () => {
      const snap = items[parseInt(nameEl.dataset.idx, 10)];
      if(kind === 'lm'){
        // The Log Meal screen's result list is private to its own code; it
        // exposes this hook (lmShowFoods) so the chips can reach it.
        window.lmShowFoods([snap], true);
      } else {
        foodSearchResultsCache = [snap, ...foodSearchResultsCache.filter(r => r.id !== snap.id)];
        renderFoodSearchResults();
      }
      const panel = document.querySelector(`#${kind === 'lm' ? 'lmSearchResults' : 'foodSearchResults'} .food-result-amount[data-idx="0"]`);
      if(panel){ panel.style.display = 'block'; panel.scrollIntoView({behavior:'smooth', block:'center'}); }
    });
  });
}

// The Favorites view: starred foods first, then the user's own foods grouped by
// how they were made (label-entered "custom", manual entry, AI assist). Each row
// carries a _group label; the result renderers print a heading when it changes.
async function loadFavoritesView(){
  let groups = {};
  try{
    const res = await fetch('api/foods.php?action=my_foods', {credentials: 'same-origin'});
    if(res.ok) groups = (await res.json()).groups || {};
  }catch(e){}
  const seen = new Set();
  const out = [];
  const add = (list, label) => (list || []).forEach(f => {
    if(f.id !== undefined && f.id !== null){ if(seen.has(f.id)) return; seen.add(f.id); }
    out.push({...f, _origin: 'library', _group: label});
  });
  add(favoriteFoods, '⭐ Favorites');
  add((groups.personal || []).filter(hasUsableNutrients), '🛠️ Custom foods');
  add((groups.manual || []).filter(hasUsableNutrients), '✍️ Manual entries');
  add((groups.ai || []).filter(hasUsableNutrients), '🤖 AI assist entries');
  return out;
}
function foodGroupHeadingHtml(label){
  return `<div class="food-group-heading">${foodSearchEscape(label)}</div>`;
}
const FAVORITES_EMPTY_TEXT = 'Nothing here yet — ⭐ a food, or add one with Manual Log or AI Assist and it will show up here.';
const FAVORITES_HINT_TEXT = 'Your favorites and saved foods — tap one to log it.';

// The closing status line for a finished search. Open Food Facts is an outside
// service: when it is unreachable we say so (instead of silently showing only
// local results), and when nothing matched at all we point at the ways to log
// the food yourself. Returns '' when there is nothing extra to say.
function foodSearchOutcomeHtml({hasResults, offline, suggestionsHtml}){
  const fallback = 'Try another name, or log it yourself: '
    + '<button type="button" class="timer-btn" data-food-fallback="manual">Manual Log</button> '
    + '<button type="button" class="timer-btn" data-food-fallback="ai">AI Assist</button>';
  const didYouMean = suggestionsHtml ? `Did you mean ${suggestionsHtml}? ` : '';
  if(!hasResults){
    return didYouMean + (offline
      ? `No local match, and the online food search is offline. ${fallback}`
      : `No matching foods. ${fallback}`);
  }
  if(offline) return didYouMean + 'The online food search is offline — showing local results only.';
  return '';
}

async function searchFoodsCombined(query){
  const generation = ++foodSearchGeneration;
  const favBtn = document.getElementById('foodFavBtn');
  if(favBtn) favBtn.classList.remove('active');
  const statusEl = document.getElementById('foodSearchStatus');
  const resultsEl = document.getElementById('foodSearchResults');
  if(query.trim().length < 2){ foodSearchResultsCache = []; resultsEl.innerHTML = ''; statusEl.style.display = 'none'; return; }
  foodSearchResultsCache = [];
  resultsEl.innerHTML = '';
  statusEl.textContent = 'Searching…';
  statusEl.style.display = 'block';
  try{
    const remoteSearch = Promise.all([
      fetch(`api/foods.php?action=search_library&q=${encodeURIComponent(query)}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[]})),
      fetch(`api/food_search.php?q=${encodeURIComponent(query)}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[], error:'offline'}))
    ]);
    const localRes = await fetch(`api/food_catalog.php?q=${encodeURIComponent(query)}&include_estimates=${document.getElementById('foodIncludeEstimates')?.checked ? '1' : '0'}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[], error:'Local food search is temporarily unavailable.'}));
    if(generation !== foodSearchGeneration) return;
    const local = (localRes.results || []).map(r => ({...r, _origin:'catalog'})).filter(hasUsableNutrients);
    foodSearchResultsCache = local;
    renderFoodSearchResults();
    const suggestions = (localRes.suggestions || []).map(word => `<button type="button" class="timer-btn" data-food-suggestion="${foodSearchEscape(word)}">${foodSearchEscape(word)}</button>`).join(' ');
    statusEl.innerHTML = localRes.error ? foodSearchEscape(localRes.error) : (suggestions ? `Did you mean ${suggestions}?` : (local.length ? 'Choose the preparation and edible part that match your food.' : 'Checking other sources…'));
    statusEl.style.display = 'block';
    const [libRes, offRes] = await remoteSearch;
    if(generation !== foodSearchGeneration) return;
    // Do not reset a selected portion while slower external searches finish.
    if([...resultsEl.querySelectorAll('.food-result-amount')].some(el => el.style.display === 'block')) return;
    const library = (libRes.results || []).map(r => ({...r, _origin: 'library'})).filter(hasUsableNutrients).filter(r => r.label !== 'Estimated' || document.getElementById('foodIncludeEstimates')?.checked);
    const external = (offRes.results || []).map(r => ({...r, _origin: 'off'})).filter(hasUsableNutrients);
    const localIds = new Set(local.map(r => r.external_id));
    foodSearchResultsCache = [...local, ...library.filter(r => !(r.source === 'catalog' && localIds.has(r.external_id))), ...external];
    renderFoodSearchResults();
    if(localRes.error){
      statusEl.textContent = localRes.error;
      statusEl.style.display = 'block';
    } else {
      const outcome = foodSearchOutcomeHtml({hasResults: foodSearchResultsCache.length > 0, offline: !!offRes.error, suggestionsHtml: suggestions});
      if(outcome){
        statusEl.innerHTML = outcome;
        statusEl.style.display = 'block';
      } else if(local.length || suggestions){
        statusEl.style.display = 'block';
      } else {
        statusEl.style.display = 'none';
      }
    }
  }catch(e){
    if(generation !== foodSearchGeneration) return;
    statusEl.textContent = 'Search failed — try again.';
  }
}

// Scales a result's per-canonical-amount nutrients to a given amount, e.g.
// 165 kcal/100g at amount=150 -> ~248 kcal.
function foodMeasureOptions(r){
  const base = r.canonical_unit || 'g';
  const options = [{value:base, label:base, factor:1}];
  if(r.personal_food?.definition && base !== 'serving') options.push({value:'serving',label:'Serving: '+r.personal_food.definition.serving_label+' (user entered)',factor:Number(r.personal_food.definition.serving_size)});
  if(base === 'g'){
    options.push({value:'oz', label:'oz (weight)', factor:28.349523125});
    (r.portions || []).forEach(p => options.push({value:'portion:' + p.portion_id, label:'Serving: ' + p.description, factor:Number(p.edible_weight_g), portion:p}));
    options.push({value:'personal_piece',label:'Pieces — my measured weight',factor:null}, {value:'personal_ml',label:'ml — my measured weight',factor:null});
  } else if(base === 'oz') options.push({value:'g',label:'g',factor:1/28.349523125});
  return options;
}
function foodMeasureControls(r, i){
  return `<div style="margin-top:6px;min-width:0;flex:1;">
    <label>Measure <select class="food-unit-input" data-idx="${i}" aria-label="Food measure" style="max-width:100%;">${foodMeasureOptions(r).map(o=>`<option value="${foodSearchEscape(o.value)}">${foodSearchEscape(o.label)}</option>`).join('')}</select></label>
    <label class="food-personal-weight" style="display:none;margin-top:6px;">My measured edible grams per piece / ml <input type="text" inputmode="decimal" data-num class="food-weight-input" min="0.000001" step="any" aria-label="Measured grams per piece or ml" style="width:90px;"></label>
    <div class="food-measure-note" style="font-size:11.5px;color:var(--ink-soft);margin-top:5px;">Saved in ${foodSearchEscape(r.canonical_unit || 'g')}. Use edible weight.</div>
  </div>`;
}
function foodMeasurement(r, panel){
  const amount = Number(panel.querySelector('.food-amount-input').value);
  const option = foodMeasureOptions(r).find(o=>o.value === panel.querySelector('.food-unit-input').value);
  if(!option || !Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount.');
  const factor = option.factor === null ? Number(panel.querySelector('.food-weight-input').value) : option.factor;
  const converted = amount * factor;
  if(!Number.isFinite(factor) || factor <= 0) throw new Error('Enter your measured edible grams per piece or ml.');
  if(!Number.isFinite(converted) || converted < 0.01 || converted > 99999999.99) throw new Error('Converted amount is outside the supported range.');
  const request = {amount, unit:option.portion ? 'portion' : option.value};
  if(option.portion) request.portion_id = option.portion.portion_id;
  if(option.factor === null) request.grams_per_unit = factor;
  return {amount: Math.round((converted + Number.EPSILON)*100)/100, request};
}
function updateFoodMeasurement(r, panel){
  const option = foodMeasureOptions(r).find(o=>o.value === panel.querySelector('.food-unit-input').value);
  panel.querySelector('.food-personal-weight').style.display = option?.factor === null ? 'block' : 'none';
  const note = panel.querySelector('.food-measure-note');
  note.textContent = option?.portion ? `${option.portion.description} = ${option.portion.edible_weight_g} g edible · ${option.portion.data_status}. Saved in grams.` : option?.factor === null ? 'Personal measurement, not a verified database portion. Saved in grams.' : `Saved in ${r.canonical_unit || 'g'}. Use edible weight.`;
  if(option?.portion){
    const link = document.createElement('a'); link.textContent = ' Source'; link.href = option.portion.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; note.appendChild(link);
  }
  try{
    const measurement = foodMeasurement(r, panel);
    panel.querySelector('.food-macro-preview').textContent = `${measurement.amount} ${r.canonical_unit || 'g'} · ${macroPreviewText(r, measurement.amount)}`;
  }catch(err){ panel.querySelector('.food-macro-preview').textContent = err.message; }
}
function scaledFoodMacros(r, amount){
  const canonical = r.canonical_amount || 100;
  const factor = canonical > 0 ? amount / canonical : 0;
  const n = r.nutrients || {};
  // Sodium/fiber/cholesterol can be genuinely unknown (null) -- keep that
  // distinct from a real zero instead of coercing it to 0.
  const optional = (code, digits) => (n[code] === null || n[code] === undefined) ? null : +((n[code] * factor).toFixed(digits));
  return {
    kcal: Math.round((n.ENERC_KCAL || 0) * factor),
    protein: +(((n.PROCNT || 0) * factor).toFixed(1)),
    fat: +(((n.FAT || 0) * factor).toFixed(1)),
    carbs: +(((n.CHOCDF || 0) * factor).toFixed(1)),
    sodium: optional('NA', 0),
    fiber: optional('FIBTG', 1),
    cholesterol: optional('CHOLE', 0)
  };
}
function macroPreviewText(r, amount){
  const m = scaledFoodMacros(r, amount);
  const extra = (value, unit, label) => value === null ? `${label} n/a` : `${value}${unit} ${label}`;
  return `${m.kcal} kcal · ${m.protein}g protein · ${m.fat}g fat · ${m.carbs}g carbs`
    + ` · ${extra(m.sodium, 'mg', 'sodium')} · ${extra(m.fiber, 'g', 'fiber')} · ${extra(m.cholesterol, 'mg', 'cholesterol')}`;
}

// Shared "close search results" bar shown above any non-empty result list.
function foodSearchCloseBar(){
  return '<div style="display:flex;justify-content:flex-end;margin:2px 0 4px;">'
    + '<button type="button" class="timer-btn food-search-close" aria-label="Close search results" title="Close search results" style="width:auto;flex:0 0 auto;padding:4px 10px;">✕ Close</button></div>';
}

// Empties the Food tab search: cancels any in-flight lookup, clears the
// results, status line and (optionally) the typed query.
function clearFoodSearch(clearInput){
  ++foodSearchGeneration;
  const favBtn = document.getElementById('foodFavBtn');
  if(favBtn) favBtn.classList.remove('active');
  foodSearchResultsCache = [];
  const resultsEl = document.getElementById('foodSearchResults');
  const statusEl = document.getElementById('foodSearchStatus');
  if(resultsEl) resultsEl.innerHTML = '';
  if(statusEl) statusEl.style.display = 'none';
  if(clearInput){
    const input = document.getElementById('foodSearchInput');
    if(input) input.value = '';
  }
}

function renderFoodSearchResults(){
  const resultsEl = document.getElementById('foodSearchResults');
  if(!resultsEl) return;
  if(!foodSearchResultsCache.length){ resultsEl.innerHTML = ''; return; }
  let lastGroup = null;
  resultsEl.innerHTML = foodSearchCloseBar() + foodSearchResultsCache.map((r, i) => {
    const heading = (r._group && r._group !== lastGroup) ? foodGroupHeadingHtml(r._group) : '';
    lastGroup = r._group || null;
    const canonicalAmount = r.canonical_amount || 100;
    const canonicalUnit = r.canonical_unit || 'g';
    const hasNutrients = r.nutrients && r.nutrients.ENERC_KCAL !== undefined && r.nutrients.ENERC_KCAL !== null;
    const sub = hasNutrients
      ? `${r.brand ? r.brand + ' · ' : ''}${Math.round(r.nutrients.ENERC_KCAL)} kcal / ${canonicalAmount}${canonicalUnit}`
      : (r.brand || (r._origin === 'library' ? 'Your library' : 'No calorie data'));
    return `
      ${heading}<div class="food-result-row" data-idx="${i}" style="padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span style="color:var(--ink-soft);flex-shrink:0;">${renderFoodIconSvg(getFoodIcon(r), 20)}</span>
            <div style="min-width:0;">
              <div style="font-weight:600;font-size:13.5px;">${foodSearchEscape(foodDisplayName(r))}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);">${foodSearchEscape(sub)}</div>
              ${r.label ? `<div style="font-size:11.5px;color:var(--ink-soft);">${foodSearchEscape(r.label)}${r.complete === false ? ' · Some nutrients unavailable' : ''}</div>` : ''}
              ${r.confidence ? `<div style="font-size:11.5px;color:var(--ink-soft);" title="${foodSearchEscape(r.confidence.reason)}">${foodSearchEscape(r.confidence.level)} confidence</div>` : ''}
              ${r.estimate ? `<details onclick="event.stopPropagation()"><summary>Estimate assumptions and limitations</summary><p style="font-size:12px;">${foodSearchEscape(r.estimate.assumptions)}</p><p style="font-size:12px;">${foodSearchEscape(r.estimate.limitations)}</p></details>` : ''}
              <button type="button" class="timer-btn" data-personal-copy="${i}" data-personal-surface="food">Save a personal copy</button>
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;stroke:var(--ink-soft);flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <div class="food-result-amount" data-idx="${i}" style="display:none;margin-top:8px;">
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" inputmode="decimal" data-num min="0.000001" step="any" aria-label="Food amount" class="food-amount-input" data-idx="${i}" value="${canonicalAmount}" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
            ${foodMeasureControls(r, i)}
          </div>
          <div class="food-macro-preview" data-idx="${i}" style="font-size:11.5px;color:var(--ink-soft);margin-top:8px;">${macroPreviewText(r, canonicalAmount)}</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="timer-btn start food-log-confirm" data-idx="${i}" type="button" style="flex:1;padding:7px 0;">Save</button>
            <button class="timer-btn reset food-log-cancel" data-idx="${i}" type="button" style="flex:1;padding:7px 0;">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

