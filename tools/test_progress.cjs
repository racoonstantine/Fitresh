// Intake status tiers and the "over target" bar fill.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = require('./app_source.cjs')();
const a = html.indexOf('function fmtNum('), b = html.indexOf("document.addEventListener('input'");
const p = html.indexOf('const OVER_COLORS'), q = html.indexOf('function glanceBarHtml');
const ctx = vm.createContext({});
vm.runInContext(html.slice(a, b) + '\n' + html.slice(p, q), ctx);

const t = 2000;
const at = eaten => ctx.intakeInsight(eaten, t);
assert.equal(at(0).level, 'none');
assert.equal(at(800).level, 'under');           // 40%: plenty of room
assert.equal(at(800).headline, '1,200 kcal left');
assert.equal(at(800).icon, '🥗');
assert.equal(at(1500).level, 'under');           // 75%
assert.equal(at(1500).icon, '👍');
assert.equal(at(1800).level, 'met');             // exactly 90% is inside the band
assert.equal(at(2000).level, 'met');
assert.equal(at(2200).level, 'met');             // exactly +10% still meets the target
assert.equal(at(2201).level, 'warn');            // just past 10%
assert.equal(at(2201).headline, '201 kcal over');
assert.equal(at(2500).level, 'warn');            // exactly +25%
assert.equal(at(2501).level, 'alarm');
assert.equal(at(3000).icon, '🚨');
assert.equal(ctx.intakeInsight(1000, 0), null, 'no target, no insight');

// Bars: capped at full width; over target the tip changes colour in proportion.
assert.deepEqual({...ctx.barFillParts(50, 'green', 'bad')}, {width: '50%', background: 'green'});
assert.deepEqual({...ctx.barFillParts(100, 'green', 'bad')}, {width: '100%', background: 'green'});
const over = ctx.barFillParts(125, 'green', 'bad');
assert.equal(over.width, '100%');
assert.match(over.background, /green 80%, #E5484D 80%/);
assert.match(ctx.barFillParts(125, 'blue', 'good').background, /#F5C542/);
assert.match(ctx.barFillParts(1000, 'green', 'bad').background, /green 10%|green 6%/, 'tip stays visible for huge overshoots');
assert.deepEqual({...ctx.barFillParts(180, 'green')}, {width: '100%', background: 'green'}, 'no overKind = plain full bar');
console.log('PASS: intake tiers (under / met within 10% / warn / alarm) and over-target bar fill.');
