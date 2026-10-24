const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = require('./app_source.cjs')();

// ---- data: the live snapshot ----
const active = JSON.parse(fs.readFileSync('api/catalog-active.json', 'utf8')).version;
const snap = JSON.parse(fs.readFileSync(`api/catalog-history/${active}.json`, 'utf8'));
const withServing = Object.values(snap.estimate_foods).filter(f => f.portions.length);
assert.equal(withServing.length, 50, 'the 50 home-style Filipino dishes get an estimated serving');
for (const f of withServing) {
  assert.equal(f.portions.length, 1, f.food_id + ': exactly one estimated serving');
  const p = f.portions[0];
  assert.equal(p.data_status, 'ESTIMATED_SERVING', f.food_id);
  assert.equal(p.source_url, '', f.food_id + ': an assumption has no source link');
  assert.match(p.notes, /^Assumption, not a measurement/, f.food_id);
  const grams = Number(p.edible_weight_g);
  assert.ok(grams >= 100 && grams <= 450, f.food_id + ': serving ' + grams + ' g is outside a plausible single serving');
}
// Estimated servings never appear on verified foods, and sourced portions keep their own status.
for (const f of Object.values(snap.foods)) for (const p of f.portions) assert.equal(p.data_status, 'OTHER_SOURCE_PORTION', f.food_id);
// Restaurant and branded estimates stay without an inferred serving mass.
for (const f of Object.values(snap.estimate_foods)) {
  if (/Philippines|Jollibee|Lucky Me|Goldilocks|Starbucks/.test(f.name)) assert.equal(f.portions.length, 0, f.name);
}

// ---- client: the Measure list says "estimated" and the default is 1 serving ----
const code = html.slice(html.indexOf('function foodMeasureOptions('), html.indexOf('function scaledFoodMacros('));
const ctx = vm.createContext({}); vm.runInContext(code, ctx);
const adobo = snap.estimate_foods['FC001260'];
const opts = ctx.foodMeasureOptions(adobo);
const serving = opts.find(o => o.value.startsWith('portion:'));
assert.equal(serving.label, 'Serving: 1 typical serving (estimated)');
assert.equal(serving.factor, 175);
const def = ctx.foodDefaultMeasure(adobo, 100);
assert.deepEqual({...def}, {amount: 1, value: 'portion:FC001260_SERVING_EST', grams: 175});
// A sourced portion keeps its plain label.
assert.equal(ctx.foodMeasureOptions({canonical_unit: 'g', portions: [{portion_id: 'x', description: '3 oz', edible_weight_g: '85', data_status: 'OTHER_SOURCE_PORTION'}]}).find(o => o.value === 'portion:x').label, 'Serving: 3 oz');
console.log('PASS: 50 labelled estimated servings, no inferred branded masses, client labels and default.');
