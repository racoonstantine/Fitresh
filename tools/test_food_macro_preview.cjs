// Checks the food-result macro preview: sodium/fiber/cholesterol are shown,
// scaled by amount, and a null (unknown) value stays "n/a" instead of 0.
const assert = require('assert');
const vm = require('vm');
const html = require('./app_source.cjs')();

const start = html.indexOf('function scaledFoodMacros(');
const end = html.indexOf('// Shared "close search results" bar');
if (start === -1 || end === -1) throw new Error('Could not locate scaledFoodMacros/macroPreviewText block');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(start, end), ctx);

const food = { canonical_amount: 100, nutrients: { ENERC_KCAL: 200, PROCNT: 10, FAT: 5, CHOCDF: 30, NA: 400, FIBTG: 3, CHOLE: 20 } };
assert.strictEqual(ctx.macroPreviewText(food, 100),
  '200 kcal · 10g protein · 5g fat · 30g carbs · 400mg sodium · 3g fiber · 20mg cholesterol');
assert.strictEqual(ctx.macroPreviewText(food, 50),
  '100 kcal · 5g protein · 2.5g fat · 15g carbs · 200mg sodium · 1.5g fiber · 10mg cholesterol');

const unknown = { canonical_amount: 100, nutrients: { ENERC_KCAL: 100, PROCNT: 1, FAT: 1, CHOCDF: 1, NA: null, FIBTG: 0 } };
const text = ctx.macroPreviewText(unknown, 100);
assert.ok(text.includes('sodium n/a'), 'null sodium must read n/a: ' + text);
assert.ok(text.includes('0g fiber'), 'a real zero must stay 0: ' + text);
assert.ok(text.includes('cholesterol n/a'), 'missing cholesterol must read n/a: ' + text);

assert.ok(html.includes('id="foodIncludeEstimates" checked') && html.includes('id="lmIncludeEstimates" checked'), 'Include estimates should default on');
console.log('PASS: macro preview shows sodium/fiber/cholesterol, scales by amount, keeps unknown vs zero; estimates default on.');
