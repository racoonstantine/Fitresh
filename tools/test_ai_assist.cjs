// Extracts the AI prompt-assist logic straight out of public/index.html and
// exercises the prompt-generation + reply-parsing functions in isolation,
// same technique as tools/test_food_icons.cjs.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = require('./app_source.cjs')();
// parseLabeledReply/firstNumber/copyTextToClipboard are shared globals (used
// by both the food and stats AI-assist flows), declared once near
// foodSearchEscape rather than inside either flow's own block.
const startShared = html.indexOf("function parseLabeledReply");
const endShared = html.indexOf("// ====", startShared);
if (startShared === -1 || endShared === -1) throw new Error('Could not locate shared AI-assist helpers in index.html');
const sharedCode = html.slice(startShared, endShared);

const start = html.indexOf("function buildFoodAiPrompt");
const end = html.indexOf("document.getElementById('aiFoodGenerateBtn')");
if (start === -1 || end === -1) throw new Error('Could not locate AI food-assist block in index.html');
const foodCode = html.slice(start, end);

const start2 = html.indexOf("function buildStatsAiPrompt");
const end2 = html.indexOf("document.getElementById('aiStatsGenerateBtn')");
if (start2 === -1 || end2 === -1) throw new Error('Could not locate AI stats-assist block in index.html');
const statsCode = html.slice(start2, end2);

const context = vm.createContext({});
// parseNum/fmtNum live in public/js/numbers.js (minus its DOM listener).
const numbersSrc = fs.readFileSync('public/js/numbers.js', 'utf8');
const numbersCode = numbersSrc.slice(0, numbersSrc.indexOf("document.addEventListener"));
vm.runInContext(numbersCode + '\n' + sharedCode + '\n' + foodCode + '\n' + statsCode, context);
const { buildFoodAiPrompt, parseLabeledReply, firstNumber, buildStatsAiPrompt, splitFoodReplyBlocks } = context;

// --- Prompt generation ---
const p1 = buildFoodAiPrompt('Chicken Adobo', '250g', 'home-cooked, extra oil');
assert.ok(p1.includes('Food: Chicken Adobo'));
assert.ok(p1.includes('Weight/quantity: 250g'));
assert.ok(p1.includes('Description: home-cooked, extra oil'));
assert.ok(!p1.includes('attach it to this chat'), 'should NOT ask for a photo when name+amount given');
assert.ok(p1.includes('Reply with ONLY block(s) in this exact format'));
assert.ok(p1.includes('MORE THAN ONE distinct food item'), 'prompt must instruct the AI to split multi-item meals into separate blocks');
assert.ok(p1.includes('Sodium: <number> mg') && p1.includes('Fiber: <number> g') && p1.includes('Sugar: <number> g'), 'prompt must request sodium/fiber/sugar alongside the core macros');
assert.ok(!p1.toUpperCase().includes('JSON'), 'prompt must not mention JSON per explicit user correction');

const p2 = buildFoodAiPrompt('', '', '');
assert.ok(p2.includes('attach it to this chat'), 'SHOULD ask for a photo when name+amount missing');

// --- Reply parsing (food), tolerant of extra AI chatter ---
const reply1 = `Sure, here's my estimate!\n\nFood: Chicken Adobo\nAmount: 250g\nCalories: 410 kcal\nProtein: 32 g\nFat: 22 g\nCarbs: 8 g\nSodium: 780 mg\nFiber: 2 g\nSugar: 3 g\n\nLet me know if you need anything else!`;
const f1 = parseLabeledReply(reply1, ['Food','Amount','Calories','Protein','Fat','Carbs','Sodium','Fiber','Sugar']);
assert.equal(f1.Food, 'Chicken Adobo');
assert.equal(f1.Amount, '250g');
assert.equal(firstNumber(f1.Calories), 410);
assert.equal(firstNumber(f1.Protein), 32);
assert.equal(firstNumber(f1.Fat), 22);
assert.equal(firstNumber(f1.Carbs), 8);
assert.equal(firstNumber(f1.Sodium), 780);
assert.equal(firstNumber(f1.Fiber), 2);
assert.equal(firstNumber(f1.Sugar), 3);

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
// A reply with no "Item N:" headers, just consecutive Food: blocks, including
// the sodium/fiber/sugar lines added alongside the core macros.
const multiReply = `Here you go!\n\nFood: Rice\nAmount: 1 cup\nCalories: 205 kcal\nProtein: 4 g\nFat: 0.4 g\nCarbs: 45 g\nSodium: 2 mg\nFiber: 0.6 g\nSugar: 0 g\n\nFood: Chicken Adobo\nAmount: 200g\nCalories: 320 kcal\nProtein: 28 g\nFat: 18 g\nCarbs: 6 g\nSodium: 900 mg\nFiber: 0.5 g\nSugar: 4 g\n\nFood: Fried Egg\nAmount: 1 piece\nCalories: 90 kcal\nProtein: 6 g\nFat: 7 g\nCarbs: 0.5 g\nSodium: 95 mg\nFiber: 0 g\nSugar: 0.2 g\n\nEnjoy your meal!`;
const multiItems = splitFoodReplyBlocks(multiReply);
assert.equal(multiItems.length, 3, 'should split into exactly 3 item blocks');
assert.equal(multiItems[0].Food, 'Rice');
assert.equal(firstNumber(multiItems[0].Calories), 205);
assert.equal(firstNumber(multiItems[0].Sodium), 2);
assert.equal(multiItems[1].Food, 'Chicken Adobo');
assert.equal(firstNumber(multiItems[1].Calories), 320);
assert.equal(firstNumber(multiItems[1].Sodium), 900);
assert.equal(firstNumber(multiItems[1].Sugar), 4);
assert.equal(multiItems[2].Food, 'Fried Egg');
assert.equal(firstNumber(multiItems[2].Calories), 90);
assert.equal(firstNumber(multiItems[2].Fiber), 0);

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
assert.ok(sp1.includes('Additional details from the user: 30 minute easy jog outdoors'));
assert.ok(!sp1.includes('please attach it to this chat'), 'should not ask for photo when description given');
const sp2 = buildStatsAiPrompt('');
assert.ok(sp2.includes('please attach it to this chat'));
assert.ok(sp2.includes('ASK ME for it before estimating'), 'prompt must tell the AI to ask for duration if missing, per explicit user request');

// Workout details (exercises actually done) must be woven into the prompt,
// not just whatever free text the user typed -- this was the reported
// "prompt looks incomplete" issue.
const sp3 = buildStatsAiPrompt('', 'Strength A: Goblet Squat, Push-up');
assert.ok(sp3.includes('Workout logged in the app: Strength A: Goblet Squat, Push-up'));

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

// --- Thousands separators in AI replies / typed numbers ---
assert.equal(firstNumber('1,234 kcal'), 1234, 'comma thousands in a reply');
assert.equal(firstNumber('about 12,345.6 steps'), 12345.6);
assert.equal(firstNumber('2,500'), 2500);
assert.equal(firstNumber('~350 kcal'), 350);
assert.equal(firstNumber('.5 g'), 0.5);
assert.equal(firstNumber('-3.2'), -3.2);
assert.ok(Number.isNaN(firstNumber('n/a')));
assert.equal(context.parseNum('1,200.5'), 1200.5);
assert.equal(context.parseNum(' 1 200 '), 1200);
assert.ok(Number.isNaN(context.parseNum('')));
assert.equal(context.fmtNum(1234567), '1,234,567');
assert.equal(context.fmtNum(1234.5, 1), '1,234.5');
assert.equal(context.fmtNum(999), '999');
assert.equal(context.fmtNum(null), '—');
assert.equal(context.fmtNum('2,500'), '2,500');
assert.equal(context.fmtNumMax(1200.5), '1,200.5');
assert.equal(context.fmtNumMax(1200), '1,200');
assert.equal(context.fmtNumMax(0.25, 2), '0.25');
// Typed/pasted input is reduced to a plain number.
assert.equal(context.sanitizeNumText('1,234.5'), '1234.5');
assert.equal(context.sanitizeNumText('12abc,000'), '12000');
assert.equal(context.sanitizeNumText(' 2 500 '), '2500');
assert.equal(context.sanitizeNumText('1.2.3'), '1.23');
assert.equal(context.sanitizeNumText('--5'), '-5');
assert.equal(context.sanitizeNumText('5-'), '5');
console.log('PASS: thousands-separator parsing and formatting.');
