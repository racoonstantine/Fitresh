// Cardio "List the activity in my log": duration parsing and syncing the
// auto-listed activity into a session's exercise list.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = require('./app_source.cjs')();

const start = html.indexOf('const CARDIO_ACTIVITY_FALLBACK');
const end = html.indexOf('function cardioActivityControlsHtml');
if (start === -1 || end === -1) throw new Error('Could not locate cardio activity helpers');

const store = {};
const ctx = vm.createContext({
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  window: {},
});
vm.runInContext(html.slice(start, end), ctx);
const { durationToMinutes, syncCardioExercise, saveCardioPrefs } = ctx;

assert.equal(durationToMinutes('40:00'), 40);
assert.equal(durationToMinutes('1:05:00'), 65);
assert.equal(durationToMinutes('0:45'), 1, 'seconds round to the nearest minute');
assert.equal(durationToMinutes(''), 0);
assert.equal(durationToMinutes('abc'), 0);
assert.equal(durationToMinutes('45'), 0, 'a bare number is not a duration string');

// Default: on, Walking.
let list = syncCardioExercise([], { duration: '40:00', distance: '5' });
assert.equal(list.length, 1);
assert.deepEqual({ ...list[0] }, { category: 'cardio', fromCardio: true, activityId: 'walking', name: 'Walking', duration: '40', distance: '5' });

// No stats yet: still lists the activity, without made-up numbers.
list = syncCardioExercise([], null);
assert.equal(list[0].name, 'Walking');
assert.ok(!('duration' in list[0]) && !('distance' in list[0]));

// Switching activity renames the auto item but keeps manual exercises and hand-edited fields.
saveCardioPrefs(true, 'running');
const manual = { name: 'Stretching', duration: '5' };
list = syncCardioExercise([{ ...list[0], distance: '4.2' }, manual], null);
assert.equal(list.length, 2);
assert.equal(list[0].name, 'Running');
assert.equal(list[0].distance, '4.2', 'hand-edited distance survives when no stats value overrides it');
assert.equal(list[1].name, 'Stretching');

// Stats value wins on refresh.
list = syncCardioExercise(list, { duration: '30:00', distance: '6' });
assert.equal(list[0].duration, '30');
assert.equal(list[0].distance, '6');

// Option off removes the auto item and keeps the rest.
saveCardioPrefs(false, 'running');
list = syncCardioExercise(list, { duration: '30:00' });
assert.equal(JSON.stringify(list.map(e => e.name)), JSON.stringify(['Stretching']));

console.log('PASS: cardio activity listing (duration parsing, create/refresh/rename/remove, manual exercises kept).');
