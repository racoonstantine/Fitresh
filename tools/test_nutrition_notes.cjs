// Extracts the pure macro-bar-color and guidance-note logic straight out of
// public/index.html and exercises it in isolation, same technique as
// tools/test_food_icons.cjs.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('public/index.html', 'utf8');
const start = html.indexOf('function macroBarRow');
const end = html.indexOf('let foodSearchResultsCache');
if (start === -1 || end === -1) throw new Error('Could not locate macroBarRow/buildNutritionNotes block in index.html');
const code = html.slice(start, end);

const context = vm.createContext({});
vm.runInContext(code, context);
const { macroBarRow, buildNutritionNotes } = context;

// --- macroBarRow: range mode must flag red both under the floor AND over the ceiling ---
// Under floor.
assert.ok(macroBarRow('Protein', 80, 120, 140, 'g', 'range').includes('#B4472A'), 'range mode should be red when under the floor');
// Within range.
assert.ok(macroBarRow('Protein', 130, 120, 140, 'g', 'range').includes('var(--forest)'), 'range mode should be green within range');
assert.ok(!macroBarRow('Protein', 130, 120, 140, 'g', 'range').includes('#B4472A'));
// Over the ceiling -- this was the reported bug (stayed green when exceeding max).
const overCeiling = macroBarRow('Fat', 100, 60, 75, 'g', 'range');
assert.ok(overCeiling.includes('#B4472A'), 'range mode should turn red when exceeding the ceiling (the reported bug)');
assert.ok(!overCeiling.includes('background:var(--forest)'));

// --- macroBarRow: ceiling mode unaffected (already worked correctly) ---
assert.ok(macroBarRow('Carbs', 55, 0, 30, 'g', 'ceiling').includes('#B4472A'), 'ceiling mode should be red when exceeding max');
assert.ok(macroBarRow('Carbs', 20, 0, 30, 'g', 'ceiling').includes('var(--forest)'), 'ceiling mode should be green under max');

// --- buildNutritionNotes ---
const targets = {calMin: 1300, calMax: 1600, proteinMin: 120, proteinMax: 140, fatMin: 40, fatMax: 75, carbsMax: 30, sodiumMax: 2300, fiberTarget: 30, sugarMax: 50};

// Matches the screenshot: calories/protein slightly over, fat way over, carbs way over.
const notes1 = buildNutritionNotes({cal: 1690, protein: 145, fat: 100, carbs: 55, sodium: 0, fiber: 0, sugar: 0}, targets, false);
const joined1 = notes1.map(n => n.text).join(' | ');
assert.ok(joined1.includes('Calories'), 'should flag calories over ceiling');
assert.ok(joined1.includes('Fat'), 'should flag fat over ceiling');
assert.ok(joined1.includes('Carbs'), 'should flag carbs over ceiling');
assert.ok(!joined1.toLowerCase().includes('sodium'), 'sodium should not be flagged when hasItemized is false');

// All within range -> a single positive note, nothing flagged.
const notes2 = buildNutritionNotes({cal: 1450, protein: 130, fat: 60, carbs: 20, sodium: 0, fiber: 0, sugar: 0}, targets, false);
assert.equal(notes2.length, 1);
assert.ok(notes2[0].text.includes('Nothing to flag'));

// Itemized data present -> sodium/sugar over limit and fiber under target should be flagged.
const notes3 = buildNutritionNotes({cal: 1450, protein: 130, fat: 60, carbs: 20, sodium: 2600, fiber: 10, sugar: 70}, targets, true);
const joined3 = notes3.map(n => n.text).join(' | ');
assert.ok(joined3.includes('Sodium'));
assert.ok(joined3.includes('Sugar'));
assert.ok(joined3.includes('Fiber'));

// Calories under the floor -> informational note, not a warning icon.
const notes4 = buildNutritionNotes({cal: 900, protein: 130, fat: 60, carbs: 20, sodium: 0, fiber: 0, sugar: 0}, targets, false);
assert.ok(notes4.some(n => n.text.includes('under today\'s target') && n.icon === 'ℹ️'));

console.log('PASS: macro-bar range-mode ceiling fix + nutrition guidance notes.');
