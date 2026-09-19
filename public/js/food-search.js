// ---------- Recent & favorite foods (quick re-log without a fresh search) ----------
// Snapshots use the same shape as a search result (with _origin fixed to
// 'library', since by the time something is recent/favorited it's already
// a real row in the `foods` table) so they can be dropped straight into
// foodSearchResultsCache/lmSearchResultsCache and reuse all the existing
// measure-picker/confirm/save logic instead of a separate code path.
let recentFoods = [];
let favoriteFoods = [];
let foodFavorites = null; // the Food tab's Favorites dropdown controller (see foodlog.js)
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
    nutrients: row.nutrients || {}, portions: row.portions || [], _origin: 'library',
    source: row.source || null
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
          <span class="recent-food-name" data-idx="${i}">${foodSearchEscape(foodDisplayName(f))}</span>${foodOriginTagHtml(f.source)}
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

// Small tag on foods the user made themselves: manual entries read "My Entry",
// AI-assist entries read "AI Assist" (older manual foods were saved as 'custom').
function foodOriginTagHtml(source){
  if(source === 'ai') return ' <span class="food-tag food-tag-ai">AI Assist</span>';
  if(source === 'manual' || source === 'custom') return ' <span class="food-tag food-tag-mine">My Entry</span>';
  return '';
}
const FOOD_COPY_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';

// One search/favorites result row, shared by the Food tab and the Log Meal page.
// subHtml: the small lines under the name; actionsHtml: the buttons under the
// amount panel (Save/Cancel on the Food tab, "+ Add to meal" on Log Meal).
function foodResultRowHtml(r, i, {surface, heading, subHtml, actionsHtml}){
  const canonicalAmount = r.canonical_amount || 100;
  const name = foodSearchEscape(foodDisplayName(r));
  return `
    ${heading || ''}<div class="food-result-row" data-idx="${i}">
      <div class="frr-main">
        <span class="frr-icon">${renderFoodIconSvg(getFoodIcon(r), 20)}</span>
        <div class="frr-text">
          <div class="frr-name">${name}${foodOriginTagHtml(r.source)}</div>
          ${subHtml}
          ${r.confidence ? `<div class="frr-sub" title="${foodSearchEscape(r.confidence.reason)}">${foodSearchEscape(r.confidence.level)} confidence</div>` : ''}
          ${r.estimate ? `<details onclick="event.stopPropagation()"><summary>Estimate assumptions and limitations</summary><p style="font-size:12px;">${foodSearchEscape(r.estimate.assumptions)}</p><p style="font-size:12px;">${foodSearchEscape(r.estimate.limitations)}</p></details>` : ''}
        </div>
        <button type="button" class="food-copy-btn" data-personal-copy="${i}" data-personal-surface="${surface}" title="Save a personal copy" aria-label="Save a personal copy of ${name}">${FOOD_COPY_ICON}</button>
        <svg class="frr-chevron" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      <div class="food-result-amount" data-idx="${i}" style="display:none;margin-top:10px;">
        ${foodAmountRowHtml(r, i, canonicalAmount)}
        <div class="food-macro-preview" data-idx="${i}">${macroPreviewText(r, canonicalAmount)}</div>
        ${actionsHtml}
      </div>
    </div>`;
}

// ---- Favorites view ----
// Starred foods first, then the user's own foods grouped by how they were made.
// Each row carries a _group label; the renderers print a heading when it changes.
const FAVORITE_GROUPS = {
  fav: '⭐ Favorites',
  personal: '🛠️ Custom foods',
  manual: '✍️ My entries',
  ai: '🤖 AI Assist entries'
};
const FAVORITE_GROUP_TONE = Object.fromEntries(Object.entries(FAVORITE_GROUPS).map(([tone, label]) => [label, tone]));
async function loadFavoritesView(){
  let groups = {};
  try{
    const res = await fetch('api/foods.php?action=my_foods', {credentials: 'same-origin'});
    if(res.ok) groups = (await res.json()).groups || {};
  }catch(e){}
  // Chips saved before foods were tagged have no source yet: fill it in from
  // what the server knows, so they get their My Entry / AI Assist tag too.
  const sourceById = new Map();
  for(const list of Object.values(groups)) for(const f of (list || [])) sourceById.set(f.id, f.source);
  let patched = false;
  for(const list of [favoriteFoods, recentFoods]){
    for(const f of list){
      if(!f.source && sourceById.has(f.id)){ f.source = sourceById.get(f.id); patched = true; }
    }
  }
  if(patched){ saveFavoriteFoods(); saveRecentFoods(); renderRecentFavorites('food'); renderRecentFavorites('lm'); }

  const seen = new Set();
  const out = [];
  const add = (list, label) => (list || []).forEach(f => {
    if(f.id !== undefined && f.id !== null){ if(seen.has(f.id)) return; seen.add(f.id); }
    out.push({...f, _origin: 'library', _group: label});
  });
  add(favoriteFoods, FAVORITE_GROUPS.fav);
  add((groups.personal || []).filter(hasUsableNutrients), FAVORITE_GROUPS.personal);
  add((groups.manual || []).filter(hasUsableNutrients), FAVORITE_GROUPS.manual);
  add((groups.ai || []).filter(hasUsableNutrients), FAVORITE_GROUPS.ai);
  return out;
}
function foodGroupHeadingHtml(label){
  const tone = FAVORITE_GROUP_TONE[label] || 'fav';
  return `<div class="food-group-heading" data-tone="${tone}"><span>${foodSearchEscape(label)}</span></div>`;
}
const FAVORITES_EMPTY_TEXT = 'Nothing here yet — ⭐ a food, or add one with Manual Log or AI Assist and it will show up here.';
const FAVORITES_HINT_TEXT = 'Your favorites and saved foods — tap one to log it.';
const FAVORITES_PAGE = 5;

// Drives one Favorites dropdown (Food tab or Log Meal): loads the list, keeps a
// filter box, shows the first 5 with "Show more", and puts the thin coloured
// frame around the panel while it is open. cfg supplies the surface's elements
// and its private cache/render hooks.
function createFavoritesController(cfg){
  let all = [], expanded = false;
  const el = id => document.getElementById(id);
  const filtered = () => {
    const q = el(cfg.filterId).value.trim().toLowerCase();
    return q ? all.filter(r => (foodDisplayName(r) + ' ' + (r.brand || '')).toLowerCase().includes(q)) : all;
  };
  function apply(){
    const list = filtered();
    const shown = expanded ? list : list.slice(0, FAVORITES_PAGE);
    cfg.setCache(shown);
    cfg.render();
    const results = el(cfg.resultsId);
    const hidden = list.length - shown.length;
    if(!list.length){
      results.insertAdjacentHTML('beforeend', `<div class="fav-empty">${el(cfg.filterId).value.trim() ? 'No matches — try another word.' : ''}</div>`);
    } else if(hidden > 0 || (expanded && list.length > FAVORITES_PAGE)){
      results.insertAdjacentHTML('beforeend', `<button type="button" class="fav-more-btn" data-fav-more>${expanded ? 'Show less' : `Show more (${hidden} more)`}</button>`);
    }
    el(cfg.countId).textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
  }
  function deactivate(){
    el(cfg.btnId).classList.remove('active');
    el(cfg.toolsId).style.display = 'none';
    el(cfg.panelId).classList.remove('fav-active');
    el(cfg.filterId).value = '';
    expanded = false;
  }
  async function open(){
    const statusEl = el(cfg.statusId);
    const generation = cfg.bump();
    el(cfg.btnId).classList.add('active');
    el(cfg.panelId).classList.add('fav-active');
    el(cfg.toolsId).style.display = 'flex';
    el(cfg.filterId).value = '';
    expanded = false;
    cfg.setCache([]);
    el(cfg.resultsId).innerHTML = '';
    statusEl.textContent = 'Loading favorites…';
    statusEl.style.display = 'block';
    all = await loadFavoritesView();
    if(generation !== cfg.generation()) return;
    apply();
    statusEl.textContent = all.length ? FAVORITES_HINT_TEXT : FAVORITES_EMPTY_TEXT;
  }
  function toggle(){
    if(el(cfg.btnId).classList.contains('active')) cfg.closeAll();
    else open();
  }
  el(cfg.btnId).addEventListener('click', toggle);
  el(cfg.filterId).addEventListener('input', ()=>{ expanded = false; apply(); });
  el(cfg.resultsId).addEventListener('click', e => {
    if(!e.target.closest('[data-fav-more]')) return;
    expanded = !expanded;
    apply();
  });
  return {open, deactivate, toggle};
}

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
  if(typeof foodFavorites !== 'undefined' && foodFavorites) foodFavorites.deactivate();
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
// Amount and Measure sit side by side as two equal-height, labelled fields;
// the personal-weight field and the "saved in" note run full width beneath.
function foodAmountRowHtml(r, i, amount){
  return `<div class="food-amount-row">
    <label class="fc-field fc-amount"><span>Amount</span><input type="text" inputmode="decimal" data-num min="0.000001" step="any" aria-label="Food amount" class="food-amount-input fc-input" data-idx="${i}" value="${foodSearchEscape(String(amount))}"></label>
    <label class="fc-field fc-grow"><span>Measure</span><select class="food-unit-input fc-input" data-idx="${i}" aria-label="Food measure">${foodMeasureOptions(r).map(o=>`<option value="${foodSearchEscape(o.value)}">${foodSearchEscape(o.label)}</option>`).join('')}</select></label>
  </div>
  <label class="food-personal-weight fc-field" style="display:none;margin-top:8px;"><span>My measured edible grams per piece / ml</span><input type="text" inputmode="decimal" data-num class="food-weight-input fc-input" min="0.000001" step="any" aria-label="Measured grams per piece or ml"></label>
  <div class="food-measure-note">Saved in ${foodSearchEscape(r.canonical_unit || 'g')}. Use edible weight.</div>`;
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
  if(typeof foodFavorites !== 'undefined' && foodFavorites) foodFavorites.deactivate();
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
    return foodResultRowHtml(r, i, {
      surface: 'food', heading,
      subHtml: `<div class="frr-sub">${foodSearchEscape(sub)}</div>${r.label ? `<div class="frr-sub">${foodSearchEscape(r.label)}${r.complete === false ? ' · Some nutrients unavailable' : ''}</div>` : ''}`,
      actionsHtml: `<div class="food-action-row">
          <button class="timer-btn start food-log-confirm" data-idx="${i}" type="button">Save</button>
          <button class="timer-btn reset food-log-cancel" data-idx="${i}" type="button">Cancel</button>
        </div>`
    });
  }).join('');
}

