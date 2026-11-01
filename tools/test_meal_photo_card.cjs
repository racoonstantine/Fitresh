const vm = require('node:vm'), assert = require('node:assert/strict');
const html = require('./app_source.cjs')();
const start = html.indexOf('function mealCardSummary(');
const end = html.indexOf('// A food with a real serving', start);
assert.ok(start > 0 && end > start, 'mealCardSummary not found');
const ctx = vm.createContext({});
vm.runInContext(html.slice(start, end), ctx);

// One gram-based item.
let s = ctx.mealCardSummary([{name: 'Pork soup with pechay', unit: 'g', amount: 380, kcal: 203.4, protein: 21.2, fat: 10.6, carbs: 5.1, fiber: 1}]);
assert.deepEqual({...s}, {title: 'Pork soup with pechay', kcal: 203, protein: 21, fat: 11, carbs: 5, fiber: 1, portion: 'Portion · 380 g'});

// Several items add up; the title counts the rest; missing fiber counts as 0.
s = ctx.mealCardSummary([
  {name: 'Rice', unit: 'g', amount: 150, kcal: 195, protein: 4, fat: 0.4, carbs: 42},
  {name: 'Adobo', unit: 'g', amount: 120, kcal: 240, protein: 20, fat: 16, carbs: 3, fiber: 0.5}
]);
assert.equal(s.title, 'Rice + 1 more');
assert.equal(s.kcal, 435);
assert.equal(s.portion, 'Portion · 270 g');
assert.equal(s.fiber, 1);

// Non-gram units fall back to an item count instead of a wrong weight.
s = ctx.mealCardSummary([{name: 'Halo-halo', unit: 'serving', amount: 1, kcal: 300, protein: 4, fat: 8, carbs: 50}]);
assert.equal(s.portion, '1 item');
assert.equal(ctx.mealCardSummary([]).title, '');

// The card itself never uploads or stores anything: the photo is only kept (api/meal_photo.php) when the meal is saved.
const foodlog = require('node:fs').readFileSync('public/js/foodlog.js', 'utf8');
const card = foodlog.slice(foodlog.indexOf('function showMealPhotoCard('), foodlog.indexOf("document.getElementById('mpcClose')"));
assert.ok(card.includes('createObjectURL') && !/fetch\(|FormData|readAsDataURL|localStorage|toDataURL/.test(card), 'the card only shows the photo from memory; saving it is a separate step after the meal is logged');
console.log('PASS: meal photo card summary (totals, portion label, item counts) and the card never uploads.');
