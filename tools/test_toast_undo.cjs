const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = require('./app_source.cjs')();
const start = html.indexOf('function showToast(');
const end = html.indexOf('function saveNutritionDay(', start);
assert.ok(start > 0 && end > start, 'toast code not found');

// Minimal DOM: enough for showToast and undoLoggedMeals.
function el(tag){
  const e = {tag, children: [], _text: '', handlers: {}, attrs: {}, classes: new Set(),
    appendChild(c){ this.children.push(c); return c; },
    setAttribute(k, v){ this.attrs[k] = v; },
    addEventListener(t, f){ this.handlers[t] = f; },
    classList: null};
  e.classList = {add: c => e.classes.add(c), remove: c => e.classes.delete(c), toggle: (c, on) => on ? e.classes.add(c) : e.classes.delete(c), contains: c => e.classes.has(c)};
  Object.defineProperty(e, 'textContent', {get(){ return e._text; }, set(v){ e._text = v; if(v === '') e.children = []; }});
  return e;
}
let toast = null;
const calls = [], fetches = [];
const document = {
  getElementById: id => id === 'appToast' ? toast : null,
  createElement: tag => el(tag),
  body: {appendChild: e => { toast = e; }}
};
const ctx = vm.createContext({document, setTimeout: () => 0, clearTimeout: () => {}, fetch: async (url, opts) => { fetches.push([url, JSON.parse(opts.body)]); return {}; },
  renderTodayMeals: () => calls.push('meals'), renderNutrition: () => calls.push('nutrition'), renderTodayGlance: () => calls.push('glance')});
vm.runInContext(html.slice(start, end), ctx);

// Plain toast: message only, not tappable.
ctx.showToast('Saved');
assert.equal(toast.children.length, 1);
assert.equal(toast.children[0].textContent, 'Saved');
assert.ok(toast.classes.has('show') && !toast.classes.has('has-undo'));

// Toast with Undo: a button that hides the toast and runs the callback.
let undone = 0;
ctx.showToast('Meal added', () => { undone++; });
assert.equal(toast.children.length, 2, 'message plus Undo button');
const btn = toast.children[1];
assert.equal(btn.tag, 'button'); assert.equal(btn.textContent, 'Undo'); assert.ok(toast.classes.has('has-undo'));
btn.handlers.click();
assert.equal(undone, 1); assert.ok(!toast.classes.has('show'));
// A later plain toast clears the old button.
ctx.showToast('Next');
assert.equal(toast.children.length, 1);

// Undo deletes every saved component, then refreshes the day.
(async () => {
  await ctx.undoLoggedMeals([11, 12]);
  assert.deepEqual(fetches.map(f => [f[0], f[1].id]), [['api/meals.php?action=delete_component', 11], ['api/meals.php?action=delete_component', 12]]);
  assert.deepEqual(calls, ['meals', 'nutrition', 'glance']);
  // The server tells the client which component it saved, so Undo can target it.
  const php = fs.readFileSync('api/meals.php', 'utf8');
  assert.ok(/'meal_entry_id' => \$entryId, 'component_id' => \$componentId\]/.test(php), 'log response must include component_id');
  console.log('PASS: toast Undo button, undoLoggedMeals, and component_id in the log response.');
})().catch(e => { console.error(e); process.exit(1); });
