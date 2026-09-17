// Extracts the AI prompt-assist logic straight out of public/index.html and
// exercises the prompt-generation + reply-parsing functions in isolation,
// same technique as tools/test_food_icons.cjs.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('public/index.html', 'utf8');
const start = html.indexOf("function buildFoodAiPrompt");
const end = html.indexOf("document.getElementById('aiFoodGenerateBtn')");
if (start === -1 || end === -1) throw new Error('Could not locate AI food-assist block in index.html');
const foodCode = html.slice(start, end);

const start2 = html.indexOf("function buildStatsAiPrompt");
const end2 = html.indexOf("document.getElementById('aiStatsGenerateBtn')");
if (start2 === -1 || end2 === -1) throw new Error('Could not locate AI stats-assist block in index.html');
const statsCode = html.slice(start2, end2);

const context = vm.createContext({});
vm.runInContext(foodCode + '\n' + statsCode, context);
const { buildFoodAiPrompt, parseLabeledReply, firstNumber, buildStatsAiPrompt, splitFoodReplyBlocks } = context;

// --- Prompt generation ---
const p1 = buildFoodAiPrompt('Chicken Adobo', '250g', 'home-cooked, extra oil');
assert.ok(p1.includes('Food: Chicken Adobo'));
assert.ok(p1.includes('Weight/quantity: 250g'));
assert.ok(p1.includes('Description: home-cooked, extra oil'));
assert.ok(!p1.includes('attach it to this chat'), 'should NOT ask for a photo when name+amount given');
assert.ok(p1.includes('Reply with ONLY block(s) in this exact format'));
assert.ok(p1.includes('MORE THAN ONE distinct food item'), 'prompt must instruct the AI to split multi-item meals into separate blocks');
assert.ok(!p1.toUpperCase().includes('JSON'), 'prompt must not mention JSON per explicit user correction');

const p2 = buildFoodAiPrompt('', '', '');
assert.ok(p2.includes('attach it to this chat'), 'SHOULD ask for a photo when name+amount missing');

// --- Reply parsing (food), tolerant of extra AI chatter ---
const reply1 = `Sure, here's my estimate!\n\nFood: Chicken Adobo\nAmount: 250g\nCalories: 410 kcal\nProtein: 32 g\nFat: 22 g\nCarbs: 8 g\n\nLet me know if you need anything else!`;
const f1 = parseLabeledReply(reply1, ['Food','Amount','Calories','Protein','Fat','Carbs']);
assert.equal(f1.Food, 'Chicken Adobo');
assert.equal(f1.Amount, '250g');
assert.equal(firstNumber(f1.Calories), 410);
assert.equal(firstNumber(f1.Protein), 32);
assert.equal(firstNumber(f1.Fat), 22);
assert.equal(firstNumber(f1.Carbs), 8);

// missing calories should be detectable (empty string / NaN)
const reply2 = `Food: Mystery Snack\nAmount: unknown`;
const f2 = parseLabeledReply(reply2, ['Food','Amount','Calories','Protein','Fat','Carbs']);
assert.equal(f2.Food, 'Mystery Snack');
assert.ok(isNaN(firstNumber(f2.Calories)));

// --- Amount -> unit inference regex (same logic used in the parse handler) ---
function inferUnit(amountRaw){
  const m = amountRaw.match(/^([\d.]+)\s*(g|gram|grams|gm|ml|millilit(?:er|re)s?)?/i);
  if(!m) return null;
  const unit = (m[2] || '').toLowerCase();
  return { amount: m[1], unit: unit.startsWith('g') ? 'g' : (unit.startsWith('m') ? 'ml' : 'serving') };
}
assert.deepEqual(inferUnit('250g'), { amount: '250', unit: 'g' });
assert.deepEqual(inferUnit('1 cup'), { amount: '1', unit: 'serving' });
assert.deepEqual(inferUnit('330ml'), { amount: '330', unit: 'ml' });

// --- Multi-item reply parsing ---
// A reply with no "Item N:" headers, just consecutive Food: blocks.
const multiReply = `Here you go!\n\nFood: Rice\nAmount: 1 cup\nCalories: 205 kcal\nProtein: 4 g\nFat: 0.4 g\nCarbs: 45 g\n\nFood: Chicken Adobo\nAmount: 200g\nCalories: 320 kcal\nProtein: 28 g\nFat: 18 g\nCarbs: 6 g\n\nFood: Fried Egg\nAmount: 1 piece\nCalories: 90 kcal\nProtein: 6 g\nFat: 7 g\nCarbs: 0.5 g\n\nEnjoy your meal!`;
const multiItems = splitFoodReplyBlocks(multiReply);
assert.equal(multiItems.length, 3, 'should split into exactly 3 item blocks');
assert.equal(multiItems[0].Food, 'Rice');
assert.equal(firstNumber(multiItems[0].Calories), 205);
assert.equal(multiItems[1].Food, 'Chicken Adobo');
assert.equal(firstNumber(multiItems[1].Calories), 320);
assert.equal(multiItems[2].Food, 'Fried Egg');
assert.equal(firstNumber(multiItems[2].Calories), 90);

// A reply WITH "Item N:" style headers should still parse correctly, since
// splitFoodReplyBlocks anchors on "Food:" lines regardless of headers.
const multiReplyWithHeaders = `Item 1:\nFood: Rice\nAmount: 1 cup\nCalories: 205 kcal\nProtein: 4 g\nFat: 0.4 g\nCarbs: 45 g\n\nItem 2:\nFood: Chicken Adobo\nAmount: 200g\nCalories: 320 kcal\nProtein: 28 g\nFat: 18 g\nCarbs: 6 g`;
const multiItems2 = splitFoodReplyBlocks(multiReplyWithHeaders);
assert.equal(multiItems2.length, 2);
assert.equal(multiItems2[0].Food, 'Rice');
assert.equal(multiItems2[1].Food, 'Chicken Adobo');

// A single-item reply (backward compatible) should still yield exactly 1 block.
const singleReply = `Food: Chicken Adobo\nAmount: 250g\nCalories: 410 kcal\nProtein: 32 g\nFat: 22 g\nCarbs: 8 g`;
assert.equal(splitFoodReplyBlocks(singleReply).length, 1);

// Chatter with no "Food:" line at all should yield zero blocks (triggers the error path).
assert.equal(splitFoodReplyBlocks("Sorry, I can't help with that.").length, 0);

// --- Prompt generation + parsing (workout) ---
const sp1 = buildStatsAiPrompt('30 minute easy jog outdoors');
assert.ok(sp1.includes('Activity: 30 minute easy jog outdoors'));
assert.ok(!sp1.includes('please attach it to this chat'), 'should not ask for photo when description given');
const sp2 = buildStatsAiPrompt('');
assert.ok(sp2.includes('please attach it to this chat'));

const statsReply = `Here's my best guess based on that description:\nDistance: 5.0\nDuration: 30:00\nCalories: 300 kcal\nAvg HR: 140 bpm\nAvg Pace: 6'00"\nSteps: 4500\nMax HR: 155 bpm\nElevation gain: 20 m`;
const sf = parseLabeledReply(statsReply, ['Distance','Duration','Calories','Avg HR','Avg Pace','Steps','Max HR','Elevation gain']);
assert.equal(firstNumber(sf.Distance), 5.0);
assert.equal(sf.Duration, '30:00');
assert.equal(firstNumber(sf.Calories), 300);
assert.equal(firstNumber(sf['Avg HR']), 140);
assert.equal(firstNumber(sf.Steps), 4500);
assert.equal(firstNumber(sf['Max HR']), 155);
assert.equal(firstNumber(sf['Elevation gain']), 20);

console.log('PASS: AI prompt-assist generation + parsing (food + workout), incl. photo-hint and no-JSON checks.');
