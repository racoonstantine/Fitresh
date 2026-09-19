// The closing status line of a food search: offline note, "nothing matched"
// guidance, and the Manual Log / AI Assist fallbacks.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = require('./app_source.cjs')();
const a = html.indexOf('function foodSearchOutcomeHtml'), b = html.indexOf('async function searchFoodsCombined');
if (a === -1 || b === -1) throw new Error('Could not locate foodSearchOutcomeHtml');
const ctx = vm.createContext({});
vm.runInContext(html.slice(a, b), ctx);
const out = o => ctx.foodSearchOutcomeHtml(o);

// Online and found something: nothing extra (the normal guidance stays).
assert.equal(out({hasResults: true, offline: false, suggestionsHtml: ''}), '');
// Offline but local results exist: say so, no fallback buttons needed.
const offlineWithResults = out({hasResults: true, offline: true, suggestionsHtml: ''});
assert.match(offlineWithResults, /online food search is offline — showing local results only/);
assert.doesNotMatch(offlineWithResults, /data-food-fallback/);
// Offline and nothing found: explain, and offer Manual Log + AI Assist.
const offlineNone = out({hasResults: false, offline: true, suggestionsHtml: ''});
assert.match(offlineNone, /No local match, and the online food search is offline/);
assert.match(offlineNone, /data-food-fallback="manual"/);
assert.match(offlineNone, /data-food-fallback="ai"/);
// Online and nothing found: plain no-match with the same fallbacks.
const noneOnline = out({hasResults: false, offline: false, suggestionsHtml: ''});
assert.match(noneOnline, /No matching foods\./);
assert.doesNotMatch(noneOnline, /offline/);
assert.match(noneOnline, /data-food-fallback="ai"/);
// "Did you mean" suggestions are kept.
assert.match(out({hasResults: false, offline: true, suggestionsHtml: '<b>x</b>'}), /^Did you mean <b>x<\/b>\? /);
assert.match(out({hasResults: true, offline: true, suggestionsHtml: '<b>x</b>'}), /^Did you mean <b>x<\/b>\? /);
console.log('PASS: food search outcome messages (offline note, no-match guidance, Manual Log / AI Assist fallbacks).');
