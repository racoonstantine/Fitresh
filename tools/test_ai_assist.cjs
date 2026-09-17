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
const { buildFoodAiPrompt, parseLabeledReply, firstNumber, buildStatsAiPrompt } = context;

// --- Prompt generation ---
const p1 = buildFoodAiPrompt('Chicken Adobo', '250g', 'home-cooked, extra oil');
assert.ok(p1.includes('Food: Chicken Adobo'));
assert.ok(p1.includes('Weight/quantity: 250g'));
assert.ok(p1.includes('Description: home-cooked, extra oil'));
assert.ok(!p1.includes('attach it to this chat'), 'should NOT ask for a photo when name+amount given');
assert.ok(p1.includes('Reply with ONLY the following lines'));
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
