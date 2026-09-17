const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('public/index.html','utf8');
const code = html.slice(html.indexOf('function foodMeasureOptions('),html.indexOf('function scaledFoodMacros('));
const context = vm.createContext({}); vm.runInContext(code,context);
const food = {canonical_unit:'g', portions:[{portion_id:'three',description:'3 pieces',edible_weight_g:'90'}]};
function measure(amount,unit,weight='') {
  const panel={querySelector:s=>({value:({'.food-amount-input':amount,'.food-unit-input':unit,'.food-weight-input':weight})[s]})};
  return context.foodMeasurement(food,panel);
}
assert.equal(measure(2,'oz').amount,56.7);
assert.equal(measure(2,'portion:three').amount,180);
assert.equal(measure(2,'portion:three').request.portion_id,'three');
assert.equal(measure(2,'personal_piece',75).amount,150);
assert.equal(measure(250,'personal_ml',1.03).amount,257.5);
for(const amount of ['',0,-1,Infinity,NaN,1e10]) assert.throws(()=>measure(amount,'g'));
assert.throws(()=>measure(1,'ml')); assert.throws(()=>measure(1,'personal_piece',''));
assert.equal(context.foodMeasureOptions({canonical_unit:'ml'}).length,1);
assert.equal(context.foodMeasureOptions({canonical_unit:'piece'}).length,1);
console.log('PASS: frontend conversion, serving quantities, personal weights and validation.');
