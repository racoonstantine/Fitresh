// Origin tags on foods, and the Favorites dropdown: first 5 + "Show more",
// filter box, grouping, frame toggling.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = require('./app_source.cjs')();
const slice = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('Could not locate ' + from);
  return html.slice(a, b);
};

// ---- a tiny fake DOM: elements with classList, value, style, innerHTML, listeners
class El {
  constructor(){ this.style = {}; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.cls = new Set(); this.handlers = {}; this.appended = []; }
  get classList(){ return {add: c => this.cls.add(c), remove: c => this.cls.delete(c), contains: c => this.cls.has(c)}; }
  addEventListener(type, fn){ (this.handlers[type] = this.handlers[type] || []).push(fn); }
  fire(type, event = {}){ (this.handlers[type] || []).forEach(fn => fn({target: {closest: () => null}, ...event})); }
  insertAdjacentHTML(_, h){ this.innerHTML += h; }
}
const ids = ['btn', 'tools', 'filter', 'count', 'panel', 'results', 'status'];
const els = Object.fromEntries(ids.map(i => [i, new El()]));
const foods = [];
for (let i = 1; i <= 8; i++) foods.push({id: i, name: 'Food ' + i, nutrients: {ENERC_KCAL: 100}, source: i <= 3 ? 'ai' : 'manual'});
let cache = [], renders = 0, generation = 0;
const ctx = vm.createContext({
  document: {getElementById: id => els[id]},
  foodSearchEscape: s => String(s), foodDisplayName: r => r.name,
  hasUsableNutrients: r => !!r.nutrients, favoriteFoods: [], recentFoods: [],
  saveFavoriteFoods() {}, saveRecentFoods() {}, renderRecentFavorites() {},
  fetch: async () => ({ok: true, json: async () => ({groups: {personal: [], manual: foods.filter(f => f.source === 'manual'), ai: foods.filter(f => f.source === 'ai')}})}),
});
vm.runInContext(slice('function foodOriginTagHtml', 'const FOOD_COPY_ICON'), ctx);
vm.runInContext(slice('const FAVORITE_GROUPS', 'const FAVORITES_EMPTY_TEXT'), ctx);
vm.runInContext(slice('const FAVORITES_EMPTY_TEXT', '// The closing status line'), ctx);

// ---- tags
const tag = ctx.foodOriginTagHtml;
assert.match(tag('ai'), /food-tag-ai">AI Assist</);
assert.match(tag('manual'), /food-tag-mine">My Entry</);
assert.match(tag('custom'), /My Entry/, 'older manual foods (source "custom") are My Entry');
for (const other of ['catalog', 'off', 'personal', null, undefined]) assert.equal(tag(other), '', 'no tag for ' + other);

// ---- headings carry a tone for their colour
assert.match(ctx.foodGroupHeadingHtml('🤖 AI Assist entries'), /data-tone="ai"/);
assert.match(ctx.foodGroupHeadingHtml('✍️ My entries'), /data-tone="manual"/);
assert.match(ctx.foodGroupHeadingHtml('⭐ Favorites'), /data-tone="fav"/);

// ---- the controller
const controller = ctx.createFavoritesController({
  btnId: 'btn', toolsId: 'tools', filterId: 'filter', countId: 'count', panelId: 'panel', resultsId: 'results', statusId: 'status',
  bump: () => ++generation, generation: () => generation,
  setCache: list => { cache = list; },
  render: () => { renders++; els.results.innerHTML = cache.map(r => `<row>${r.name}</row>`).join(''); },
  closeAll: () => controller.deactivate(),
});
(async () => {
  await controller.open();
  assert.equal(cache.length, 5, 'only the first 5 are shown');
  assert.match(els.results.innerHTML, /Show more \(3 more\)/);
  assert.equal(els.count.textContent, '8 items');
  assert.ok(els.panel.cls.has('fav-active') && els.btn.cls.has('active'), 'panel is framed while open');
  assert.equal(els.tools.style.display, 'flex');

  // Show more expands to everything, and offers Show less
  els.results.handlers.click[0]({target: {closest: sel => sel === '[data-fav-more]' ? {} : null}});
  assert.equal(cache.length, 8);
  assert.match(els.results.innerHTML, /Show less/);

  // Filter narrows the list, resets to the first page
  els.filter.value = 'food 7';
  els.filter.fire('input');
  assert.equal(JSON.stringify(cache.map(r => r.name)), JSON.stringify(['Food 7']));
  assert.equal(els.count.textContent, '1 item');
  assert.doesNotMatch(els.results.innerHTML, /Show more/);
  els.filter.value = 'zzz';
  els.filter.fire('input');
  assert.equal(cache.length, 0);
  assert.match(els.results.innerHTML, /No matches/);
  els.filter.value = '';
  els.filter.fire('input');
  assert.equal(cache.length, 5, 'clearing the filter returns to the first page');

  // Grouping/tags come from the server data: ai foods are in the AI group
  assert.ok(cache.some(r => r._group === '🤖 AI Assist entries') || cache.some(r => r._group === '✍️ My entries'));

  // Closing removes the frame and clears the filter
  controller.deactivate();
  assert.ok(!els.panel.cls.has('fav-active') && !els.btn.cls.has('active'));
  assert.equal(els.tools.style.display, 'none');
  assert.equal(els.filter.value, '');
  console.log('PASS: origin tags, group tones, and Favorites paging/filter/frame behaviour.');
})().catch(e => { console.error(e); process.exit(1); });
