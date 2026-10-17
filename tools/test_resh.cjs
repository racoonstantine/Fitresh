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
  formatWeightKg: kg => kg.toFixed(1) + ' kg',
  weightUnitLabel: () => 'kg',
};
vm.createContext(context);
vm.runInContext(src + '\n;this.api = {reshParseReply, reshStatus, reshFingerprint, reshBuildPrompt, reshReviewHtml, reshAvatarSvg, reshWeightProgress, reshTrainingProgress, reshProgressChips, reshPickMove};', context);
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

// --- the Progress line is parsed (and may wrap onto a second line)
const p3 = api.reshParseReply(['Headline: Hi', 'Progress: Weight is down 0.4 kg a week,', 'right on track. Training 3 of 4.', 'Cheer: Go'].join('\n'));
assert.strictEqual(p3.progress, 'Weight is down 0.4 kg a week, right on track. Training 3 of 4.');
assert.ok(api.reshReviewHtml({at: '2026-10-18T20:00:00Z', review: ['Headline: Hi', 'Progress: On track.', 'Cheer: Go'].join('\n')}).includes('Weight &amp; training'));

// --- weight vs goal
const day = n => '2026-09-' + String(n).padStart(2, '0');
let w = api.reshWeightProgress([{date: day(1), kg: 90}, {date: day(15), kg: 88.6}], 82, 'lose');
assert.strictEqual(w.toGo, 6.6);
assert.ok(Math.abs(w.perWeek - -0.7) < 0.01, 'pace is kg per week');
assert.strictEqual(w.moving, true);
assert.strictEqual(w.weeksToGo, 9, '6.6 kg at 0.7 kg/week is about 9 weeks');
w = api.reshWeightProgress([{date: day(1), kg: 90}, {date: day(15), kg: 91}], 82, 'lose');
assert.strictEqual(w.moving, false, 'gaining while trying to lose is flagged');
assert.strictEqual(w.weeksToGo, null);
w = api.reshWeightProgress([{date: day(1), kg: 82.2}, {date: day(15), kg: 82.1}], 82, 'lose');
assert.strictEqual(w.atGoal, true, 'within 0.5 kg counts as at goal');
w = api.reshWeightProgress([{date: day(1), kg: 90}, {date: day(4), kg: 89}], 82, 'lose');
assert.strictEqual(w.perWeek, null, 'under a week of weigh-ins: no pace yet');
assert.strictEqual(api.reshWeightProgress([], 82, 'lose'), null);
assert.strictEqual(api.reshWeightProgress([{date: day(1), kg: 80}], 85, undefined).direction, 'gain', 'direction inferred from the goal when not set');

// --- training vs plan: past planned days are judged, today only counts once done
const dates = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
const planned = new Set(['2026-10-14', '2026-10-16', '2026-10-18']);
let tr = api.reshTrainingProgress(dates, '2026-10-18', d => planned.has(d), d => d === '2026-10-14' || d === '2026-10-15');
assert.strictEqual(JSON.stringify([tr.planned, tr.done, tr.extra, tr.missed]), JSON.stringify([2, 1, 1, ['2026-10-16']]), 'today is not yet missed; the 15th was an unplanned extra');
tr = api.reshTrainingProgress(dates, '2026-10-18', d => planned.has(d), d => d === '2026-10-18');
assert.strictEqual(tr.done, 1); assert.strictEqual(tr.planned, 3, 'a session done today on a planned day counts');
tr = api.reshTrainingProgress(dates, '2026-10-18', () => false, d => d === '2026-10-15');
assert.strictEqual(tr.planned, 0); assert.strictEqual(tr.extra, 1, 'no plan: sessions are just logged');

// --- chips and the facts given to the AI
const chips = api.reshProgressChips({weight: api.reshWeightProgress([{date: day(1), kg: 90}, {date: day(15), kg: 88.6}], 82, 'lose'), training: {planned: 4, done: 3, extra: 1, missed: ['x']}});
assert.ok(chips[0].text.includes('88.6 kg') && chips[0].text.includes('6.6 kg to lose') && chips[0].good === true);
assert.ok(chips[1].text === '3 of 4 planned sessions' && chips[1].good === false && chips[1].sub.includes('plus 1 extra'));
const facts = api.reshBuildPrompt({rows: [], workouts: [], weights: [], progress: {weight: api.reshWeightProgress([{date: day(1), kg: 90}, {date: day(15), kg: 91}], 82, 'lose'), training: {planned: 4, done: 1, extra: 0, missed: ['2026-10-10']}}});
assert.ok(facts.includes('NOT the direction they want') && facts.includes('1 of 4 planned sessions done') && facts.includes('missed on 2026-10-10'), 'the AI is told the facts, not asked to work them out');
assert.ok(facts.includes('Progress: <two short sentences'), 'reply format asks for a progress line');

// --- poking Resh: three moves, never the same twice in a row
assert.strictEqual(api.reshPickMove('', 0)[0], 'wave');
const seen = new Set(); for (let i = 0; i < 30; i++) seen.add(api.reshPickMove('jump', i / 30)[0]);
assert.strictEqual(JSON.stringify([...seen].sort()), JSON.stringify(['spin', 'wave']), 'after a jump only wave or spin come up');

assert.ok(api.reshAvatarSvg('happy').includes('<svg') && api.reshAvatarSvg('thinking').includes('resh-thinking'));
console.log('PASS: Resh (reply parsing and escaping, once-a-day and unchanged-data limits, fingerprint, prompt).');
