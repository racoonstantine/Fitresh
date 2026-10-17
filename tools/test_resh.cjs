// Resh (public/js/resh.js): reply parsing, the "has anything changed?" check, run-limits and the prompt.
//   node tools/test_resh.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'resh.js'), 'utf8');
const context = {
  console, Math, JSON, Date, Array, String, Number, Object,
  userHealthTargets: {calorieTarget: 2100, proteinTarget: 120, goalDirection: 'lose', waterGoalMl: 2500},
  GOAL_WEIGHT: 82,
  dateStrForOffset: n => '2026-10-' + String(18 + n).padStart(2, '0'),
  foodSearchEscape: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
};
vm.createContext(context);
vm.runInContext(src + '\n;this.api = {reshParseReply, reshStatus, reshFingerprint, reshBuildPrompt, reshReviewHtml, reshAvatarSvg};', context);
const api = context.api;

// --- parsing a well-formed reply
const reply = [
  'Headline: Steady week, nice work!',
  'Going well:', '- Protein hit target 5 days', '- You logged every day',
  'Needs work:', '- Sleep averaged 5.8 h',
  'Next steps:', '- Be in bed by 10:30 three nights', '- Add a 20 min walk after dinner',
  'Cheer: You are building something real.',
].join('\n');
const p = api.reshParseReply(reply);
assert.strictEqual(p.headline, 'Steady week, nice work!');
assert.strictEqual(JSON.stringify(p.good), JSON.stringify(['Protein hit target 5 days', 'You logged every day']));
assert.strictEqual(p.work.length, 1);
assert.strictEqual(p.next.length, 2);
assert.strictEqual(p.cheer, 'You are building something real.');
// chatter before the format and bullets written as "•" still parse
const p2 = api.reshParseReply('Sure!\nHeadline: Hi\nGoing well: • one\n• two\nCheer: Go');
assert.strictEqual(p2.good.length, 2);
assert.strictEqual(api.reshParseReply('just some words'), null, 'unrecognised text falls back to plain display');

// --- the review is shown escaped, never as HTML
const html = api.reshReviewHtml({at: '2026-10-18T20:00:00Z', review: 'Headline: <img src=x onerror=alert(1)>\nCheer: ok'});
assert.ok(!html.includes('<img'), 'AI text must be escaped');
assert.ok(html.includes('&lt;img'));

// --- when Resh may run again
const same = {fp: 'A', day: '2026-10-17'};
assert.strictEqual(api.reshStatus(null, 'A'), 'ask');
assert.strictEqual(api.reshStatus(same, 'A'), 'same', 'unchanged numbers never re-run, even on a new day');
assert.strictEqual(api.reshStatus(same, 'B'), 'again', 'changed numbers on a new day may re-run');
assert.strictEqual(api.reshStatus({fp: 'A', day: '2026-10-18'}, 'B'), 'tomorrow', 'only once per calendar day');

// --- fingerprint ignores small wobble but notices real change
const rows = (kcal, protein) => Array.from({length: 14}, (_, i) => ({date: 'd' + i, food: i < 10, kcal: kcal + (i % 3) * 7, protein: protein + (i % 2), water: 0, steps: 6000, sleep: 7}));
const snap = (kcal, protein, kg, workouts) => ({rows: rows(kcal, protein), workouts: Array.from({length: workouts}, () => ({})), weights: [{kg}]});
const base = api.reshFingerprint(snap(1900, 100, 90.1, 4));
assert.strictEqual(api.reshFingerprint(snap(1915, 101, 90.2, 4)), base, 'small changes keep the same fingerprint');
assert.notStrictEqual(api.reshFingerprint(snap(2300, 100, 90.1, 4)), base, 'a big calorie shift is a change');
assert.notStrictEqual(api.reshFingerprint(snap(1900, 100, 90.1, 5)), base, 'another workout is a change');
assert.notStrictEqual(api.reshFingerprint(snap(1900, 100, 88.0, 4)), base, 'weight moving 2 kg is a change');

// --- the prompt carries the data and the format
const prompt = api.reshBuildPrompt({
  rows: [{date: '2026-10-17', food: true, kcal: 1850, protein: 95, water: 1800, steps: 7200, sleep: 7.2}],
  workouts: [{date: '2026-10-16', label: 'Strength A', detail: 'duration 45:00'}],
  weights: [{date: '2026-10-01', kg: 90}, {date: '2026-10-17', kg: 89}],
});
assert.ok(prompt.includes('lose weight') && prompt.includes('2100 kcal') && prompt.includes('1850 kcal, 95 g protein'));
assert.ok(prompt.includes('Strength A (duration 45:00)') && prompt.includes('90 kg on 2026-10-01 -> 89 kg on 2026-10-17'));
assert.ok(prompt.includes('Headline:') && prompt.includes('Next steps:') && prompt.includes('Never diagnose'));

assert.ok(api.reshAvatarSvg('happy').includes('<svg') && api.reshAvatarSvg('thinking').includes('resh-thinking'));
console.log('PASS: Resh (reply parsing and escaping, once-a-day and unchanged-data limits, fingerprint, prompt).');
