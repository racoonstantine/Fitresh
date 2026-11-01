// Photo meal card v2: the AI's whole-meal lines (Dish / Summary / Confidence), the card's derived
// numbers (energy shares, highlights, confidence) and the edits (calories, amount) that feed the totals.
const vm = require('node:vm'), assert = require('node:assert/strict'), fs = require('node:fs');
const html = require('./app_source.cjs')();
const same = (actual, expected, msg) => assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);

const slice = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, from + ' not found');
  return html.slice(a, b);
};
const ctx = vm.createContext({ Math, Number, String, Array, Object, JSON });
vm.runInContext(fs.readFileSync('public/js/numbers.js', 'utf8').split('document.addEventListener')[0], ctx);
vm.runInContext(slice('function parseLabeledReply(', 'function firstNumber('), ctx);
vm.runInContext(slice('function mealCardSummary(', '// A food with a real serving'), ctx);
vm.runInContext(slice('function parseFoodReplyMeta(', "document.getElementById('aiFoodGenerateBtn')"), ctx);
vm.runInContext(slice('const OZ_IN_G', "document.getElementById('lmMealItems').addEventListener"), ctx);

// --- Dish / Summary / Confidence are read from above the first "Food:" line ---
const reply = `Dish: Mixed Seafood\nSummary: A seafood plate with crab, prawns and vegetables, likely stir-fried.\nConfidence: High\n\nFood: Prawns\nAmount: 100g\nCalories: 99 kcal\nSummary: not this one`;
same(ctx.parseFoodReplyMeta(reply), { dish: 'Mixed Seafood', summary: 'A seafood plate with crab, prawns and vegetables, likely stir-fried.', confidence: 'High' });
same(ctx.parseFoodReplyMeta('Food: Rice\nCalories: 200 kcal'), { dish: '', summary: '', confidence: '' }, 'old-style replies still work');
same(ctx.parseFoodReplyMeta('Sure!\nDish: Soup\nConfidence: moderate - hard to see\nFood: Soup'), { dish: 'Soup', summary: '', confidence: 'Medium' });
assert.equal(ctx.mealCardConfidence('LOW (blurry photo)'), 'Low');
assert.equal(ctx.mealCardConfidence('not sure'), '');

// --- the prompt asks for them, and still asks for the per-item blocks ---
const prompt = vm.runInContext(slice('function buildFoodAiPrompt', "document.getElementById('aiFoodGenerateBtn')") + ';buildFoodAiPrompt("", "", "rice", 1)', ctx);
assert.ok(prompt.includes('Dish: <short name for the whole meal>') && prompt.includes('Summary: <') && prompt.includes('Confidence: <High, Medium or Low>'));
assert.ok(prompt.indexOf('Dish:') < prompt.indexOf('Food: <food name>'), 'whole-meal lines come first');

// --- energy share adds to 100 and highlights follow the totals ---
const items = [
  { name: 'Prawns', unit: 'g', amount: 100, kcal: 99, protein: 20, fat: 1.5, carbs: 0.2, fiber: 0 },
  { name: 'Crab', unit: 'g', amount: 100, kcal: 83, protein: 17, fat: 1, carbs: 0, fiber: 0 },
  { name: 'Sauce', unit: 'g', amount: 15, kcal: 70, protein: 0, fat: 7, carbs: 1, fiber: 0 }
];
const share = ctx.mealCardEnergyShare(items);
assert.equal(share.protein + share.fat + share.carbs, 100);
assert.ok(share.protein > share.fat && share.carbs <= 2);
same(ctx.mealCardEnergyShare([]), { protein: 0, fat: 0, carbs: 0 });
const hl = ctx.mealCardHighlights(items).map(h => h.title);
assert.ok(hl.includes('High protein') && hl.includes('Lower carb') && hl.length <= 3, hl.join());
same(ctx.mealCardHighlights([]), []);
assert.ok(ctx.mealCardHighlights([{ name: 'Rice', unit: 'g', amount: 300, kcal: 390, protein: 7, fat: 1, carbs: 85, fiber: 2 }]).some(h => h.title === 'Carb-heavy'));
assert.equal(ctx.mealCardSubtitle(items), 'Prawns, Crab, Sauce');
assert.equal(ctx.mealCardSubtitle(Array.from({ length: 6 }, (_, i) => ({ name: 'F' + i }))), 'F0, F1, F2, F3 and more');

// --- editing calories scales every number together; editing amount afterwards scales from the corrected ones ---
const it = { name: 'Prawns', amount: 100, unit: 'g', kcal: 100, protein: 20, fat: 2, carbs: 1, sodium: 200, fiber: null, sugar: 0 };
ctx.lmSetItemKcal(it, 150);
same([it.kcal, it.protein, it.fat, it.carbs, it.sodium, it.fiber, it.sugar], [150, 30, 3, 1.5, 300, null, 0]);
assert.equal(it.amount, 100, 'calorie correction does not touch the amount');
ctx.lmSetItemAmount(it, 200);
same([it.amount, it.kcal, it.protein], [200, 300, 60], 'amount edit builds on the corrected numbers');
ctx.lmSetItemAmount(it, 100);
same([it.kcal, it.protein], [150, 30], 'and returns to them without drifting');
const zero = { name: 'Water', amount: 250, unit: 'ml', kcal: 0, protein: 0, fat: 0, carbs: 0 };
ctx.lmSetItemKcal(zero, 10);
assert.equal(zero.kcal, 10, 'a zero-calorie item can be given calories without dividing by zero');

// --- the card edits the same items the meal list shows, and the photo still never leaves the tab ---
const foodlog = fs.readFileSync('public/js/foodlog.js', 'utf8');
const wiring = foodlog.slice(foodlog.indexOf('function showMealPhotoCard('), foodlog.indexOf("document.getElementById('mpcAdd')"));
assert.ok(wiring.includes('lmSetItemAmount(it, typed)') && wiring.includes('lmSetItemKcal(it, typed)') && wiring.includes('renderLmMealItems()'), 'ingredient edits go to the shared meal items');
assert.ok(wiring.includes('lmItems.splice(at, 1)'), 'removing an ingredient removes it from the meal too');
assert.ok(!/fetch\(|FormData|readAsDataURL|localStorage|toDataURL/.test(wiring), 'no photo storage in this change');
console.log('meal card edit tests passed');
