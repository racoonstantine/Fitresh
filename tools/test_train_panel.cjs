// Pure logic behind the Train panel: library search, icons, stats line,
// metrics text, and the Open/Rest/Planned day state.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = require('./app_source.cjs')();
const slice = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('Could not locate ' + from);
  return html.slice(a, b);
};

const catalog = [
  {id: 'running', name: 'Running', category: 'cardio', phase: 'main'},
  {id: 'walking', name: 'Walking', category: 'cardio', phase: 'main'},
  {id: 'squat', name: 'Goblet Squat', category: 'strength', phase: 'main'},
  {id: 'wu-march', name: 'Easy March / Walk', category: 'warmup', phase: 'warmup'},
  {id: 'rugby', name: 'Rugby', category: 'sport'}
];
const ctx = vm.createContext({window: {getWorkoutCatalog: () => catalog}, foodSearchEscape: s => String(s)});
const numbers = html.slice(html.indexOf('function fmtNum('), html.indexOf("document.addEventListener('input'"));
vm.runInContext(numbers, ctx);
vm.runInContext(slice('const MANUAL_CATEGORIES', '// ---- state shared with the stats form'), ctx);
vm.runInContext(slice('function exerciseMetricsText', 'let loggedTodayOpen'), ctx);
vm.runInContext(slice('function loggedStatsLine', 'function exerciseMetricsText'), ctx);
const c = ctx;
const names = list => JSON.stringify(list.map(a => a.name));

// Library search: by category, "main" phase only (warm-ups excluded), needs a query unless forced.
assert.equal(names(c.librarySearchMatches('ru', 'cardio', false)), names([{name: 'Running'}]));
assert.equal(names(c.librarySearchMatches('walk', 'cardio', false)), names([{name: 'Walking'}]), 'warm-up "Easy March / Walk" must not show up');
assert.equal(c.librarySearchMatches('', 'cardio', false).length, 0, 'empty query without force returns nothing');
assert.equal(names(c.librarySearchMatches('', 'cardio', true)), names([{name: 'Running'}, {name: 'Walking'}]), 'force lists the category alphabetically');
assert.equal(c.librarySearchMatches('squat', 'cardio', false).length, 0, 'category filter applies');
assert.equal(names(c.librarySearchMatches('rug', 'sport', false)), names([{name: 'Rugby'}]), 'phase-less catalog entries still count');
assert.equal(c.manualCategoryForCatalog('sport'), 'sport');
assert.equal(c.manualCategoryForCatalog('warmup'), null);

// Icons
assert.equal(c.activityEmoji('Walking', 'cardio'), '🚶');
assert.equal(c.activityEmoji('Running', 'cardio'), '🏃');
assert.equal(c.activityEmoji('Cycling', 'cardio'), '🚴');
assert.equal(c.activityEmoji('Goblet Squat', 'strength'), '🏋️');
assert.equal(c.activityEmoji('Mystery', 'sports'), '⚽');
assert.equal(c.activityEmoji('Mystery', 'other'), '🧘');

// Stats line shows only what exists, with thousands separators.
assert.equal(c.loggedStatsLine(null), '');
assert.equal(c.loggedStatsLine({}), '');
assert.equal(c.loggedStatsLine({duration: '45:00', calories: '1180', distance: '5.2', steps: '6800', hr: '132'}),
  '⏱ 45:00 · 🔥 1,180 kcal · 📍 5.2 km · 👟 6,800 steps · ♥ 132 bpm');
assert.equal(c.loggedStatsLine({calories: '320'}), '🔥 320 kcal');

// Metrics text
assert.equal(c.exerciseMetricsText({sets: '3', reps: '10', weight: '20'}), '3 × 10 · 20 kg');
assert.equal(c.exerciseMetricsText({duration: '30', distance: '4.1'}), '30 min · 4.1 km');
assert.equal(c.exerciseMetricsText({name: 'x'}), '');

// dayPlanState: planned / rest / other / open
const state = vm.createContext({
  historyLog: [], userTrainingPlan: null,
  scheduledPlanFor: (idx, d) => (state.__plan ? {name: state.__plan} : null),
  effectiveDayEntry: (d, idx) => state.__entry || null,
});
vm.runInContext(slice('function dayPlanState', 'function toLocalDateStr'), state);
state.__plan = 'Strength A';
assert.deepEqual({...state.dayPlanState('2026-09-19')}, {state: 'planned', plan: {name: 'Strength A'}, label: 'Strength A'});
state.__plan = null;
state.__entry = {type: 'rest'};
assert.equal(state.dayPlanState('2026-09-19').state, 'rest');
state.__entry = {type: 'other', note: 'Football'};
assert.equal(state.dayPlanState('2026-09-19').label, 'Football');
state.__entry = null;
assert.equal(state.dayPlanState('2026-09-19').state, 'open');
assert.equal(state.dayPlanState('2026-09-19').label, 'Open — nothing planned');
state.historyLog = [{date: '2026-09-19', day: 'rest'}];
assert.equal(state.dayPlanState('2026-09-19').state, 'rest', 'a logged Rest counts as rest');
assert.equal(state.dayPlanState('2026-09-20').state, 'open', 'other dates are unaffected');

// AI Assist session prompt: the shared stats prompt plus a short workout-name line.
const aiCtx = vm.createContext({buildStatsAiPrompt: (d, w) => 'intro\nDistance: <km, e.g. 5.2>\nDuration: <x>' + (d ? '\nDESC ' + d : '')});
vm.runInContext(slice('function buildSessionAiPrompt', 'function resetAiSessionFlow'), aiCtx);
const sessionPrompt = aiCtx.buildSessionAiPrompt('45 min jog', '');
assert.match(sessionPrompt, /Workout: <short name, e\.g\. Evening jog>\nDistance: <km/, 'asks for a workout name just before Distance');
assert.match(sessionPrompt, /DESC 45 min jog/);
assert.equal(sessionPrompt.split('Workout:').length, 2, 'name line added exactly once');

console.log('PASS: Train panel logic (library search, icons, stats line, metrics, Open/Rest/Planned state).');
