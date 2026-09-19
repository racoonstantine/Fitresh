// Origin tags on foods, and the Favorites dropdown: 3 rows per group with each
// group's own "Show more", filter box, group order, frame toggling.
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
  constructor(){ this.style = {}; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.cls = new Set(); this.handlers = {}; }
  get classList(){ return {add: c => this.cls.add(c), remove: c => this.cls.delete(c), contains: c => this.cls.has(c)}; }
  addEventListener(type, fn){ (this.handlers[type] = this.handlers[type] || []).push(fn); }
  fire(type, event = {}){ (this.handlers[type] || []).forEach(fn => fn({target: {closest: () => null}, ...event})); }
  insertAdjacentHTML(_, h){ this.innerHTML += h; }
}
const ids = ['btn', 'tools', 'filter', 'count', 'panel', 'results', 'status'];
const els = Object.fromEntries(ids.map(i => [i, new El()]));
const mk = (id, name, source) => ({id, name, nutrients: {ENERC_KCAL: 100}, source});
const favs = [1, 2, 3, 4].map(i => mk(i, 'Fav ' + i, 'manual'));
const manual = [5, 6, 7, 8, 9].map(i => mk(i, 'Manual ' + i, 'manual'));
const ai = [10, 11, 12, 13].map(i => mk(i, 'AI ' + i, 'ai'));
let cache = [], generation = 0;
const ctx = vm.createContext({
  document: {getElementById: id => els[id]},
  foodSearchEscape: s => String(s), foodDisplayName: r => r.name,
  hasUsableNutrients: r => !!r.nutrients, favoriteFoods: favs, recentFoods: [],
  saveFavoriteFoods() {}, saveRecentFoods() {}, renderRecentFavorites() {},
  fetch: async () => ({ok: true, json: async () => ({groups: {personal: [], manual, ai}})}),
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
assert.match(ctx.foodFavMoreHtml({_tone: 'ai', _hidden: 2, _open: false}), /data-fav-more="ai">Show more \(2 more\)</);
assert.match(ctx.foodFavMoreHtml({_tone: 'ai', _hidden: 2, _open: true}), />Show less</);

// ---- the controller
const controller = ctx.createFavoritesController({
  btnId: 'btn', toolsId: 'tools', filterId: 'filter', countId: 'count', panelId: 'panel', resultsId: 'results', statusId: 'status',
  bump: () => ++generation, generation: () => generation,
  setCache: list => { cache = list; },
  render: () => { els.results.innerHTML = ''; },
  closeAll: () => controller.deactivate(),
});
const names = group => cache.filter(r => !r._more && r._group === group).map(r => r.name);
const more = tone => cache.find(r => r._more && r._tone === tone);
const clickMore = tone => els.results.handlers.click[0]({target: {closest: sel => sel === '[data-fav-more]' ? {dataset: {favMore: tone}} : null}});
(async () => {
  await controller.open();
  // each group shows its own first 3, with its own count of the rest
  assert.equal(names('⭐ Favorites').length, 3);
  assert.equal(names('✍️ My entries').length, 3);
  assert.equal(names('🤖 AI Assist entries').length, 3);
  assert.equal(more('fav')._hidden, 1);
  assert.equal(more('manual')._hidden, 2);
  assert.equal(more('ai')._hidden, 1);
  assert.equal(els.count.textContent, '13 items');
  assert.ok(els.panel.cls.has('fav-active') && els.btn.cls.has('active'), 'panel is framed while open');
  assert.equal(els.tools.style.display, 'flex');

  // the pseudo "more" row sits right after its own group's rows
  const order = cache.map(r => r._more ? 'more:' + r._tone : Array.from(r._group)[0]);
  assert.equal(order.join(' '), '⭐ ⭐ ⭐ more:fav ✍ ✍ ✍ more:manual 🤖 🤖 🤖 more:ai');

  // expanding one group leaves the others alone
  clickMore('ai');
  assert.equal(names('🤖 AI Assist entries').length, 4);
  assert.equal(names('✍️ My entries').length, 3);
  assert.equal(more('ai')._open, true);
  clickMore('manual');
  assert.equal(names('✍️ My entries').length, 5);
  clickMore('ai'); // collapse again
  assert.equal(names('🤖 AI Assist entries').length, 3);
  assert.equal(more('ai')._open, false);

  // a group with 3 or fewer never shows a button
  els.filter.value = 'ai 1';
  els.filter.fire('input');
  assert.equal(JSON.stringify(cache.filter(r => !r._more).map(r => r.name)), JSON.stringify(['AI 10', 'AI 11', 'AI 12']), 'first three matches shown');
  assert.equal(cache.filter(r => r._more).length, 1, 'AI 13 is hidden behind its own Show more');
  els.filter.value = 'ai 13';
  els.filter.fire('input');
  assert.equal(cache.filter(r => r._more).length, 0);
  assert.equal(els.count.textContent, '1 item');
  els.filter.value = 'zzz';
  els.filter.fire('input');
  assert.equal(cache.length, 0);
  assert.match(els.results.innerHTML, /No matches/);
  els.filter.value = '';
  els.filter.fire('input');
  assert.equal(names('⭐ Favorites').length, 3, 'clearing the filter returns to first pages');

  // Closing removes the frame and clears the filter
  controller.deactivate();
  assert.ok(!els.panel.cls.has('fav-active') && !els.btn.cls.has('active'));
  assert.equal(els.tools.style.display, 'none');
  assert.equal(els.filter.value, '');
  console.log('PASS: origin tags, group tones, and per-group Favorites paging (3 rows + Show more), filter and frame.');
})().catch(e => { console.error(e); process.exit(1); });
