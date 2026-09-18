const fs=require('node:fs'),assert=require('node:assert/strict');
const c=JSON.parse(fs.readFileSync('data/workouts/catalog.json','utf8'));
const activities=c.activities.filter(a=>['warmup','cooldown'].includes(a.phase));
const presets=c.templates.filter(t=>['warmup','cooldown'].includes(t.phase));
assert.equal(activities.length,28);assert.equal(presets.length,12);
for(const a of activities){
 assert.equal(a.category,a.phase);assert.ok(['hold','reps'].includes(a.tracking));
 assert.equal(a.phaseTarget.sets,a.phaseTarget.perSide?2:1);
 for(const group of Object.values(a.guidance))for(const g of Object.values(group)){
  assert.equal(g.sets[0],a.phaseTarget.sets);
  assert.equal(g.suggestedWeightKg,null);
  if(a.tracking==='hold')assert.equal(g.durationSeconds[0],a.phaseTarget.durationSeconds);
  else assert.equal(g.reps[0],a.phaseTarget.reps);
 }
}
for(const p of presets){
 assert.ok(p.suitableFor.length);assert.ok(p.items.length>=3);
 for(const i of p.items){const a=c.activities.find(a=>a.id===i.activityId);assert.equal(a.phase,p.phase);assert.equal(i.setCount,a.phaseTarget.sets);assert.deepEqual(i.prescription,a.phaseTarget);}
}
// The draft-insertion/phase-ordering UI (public/workouts.js) that used to be
// exercised here was retired along with the standalone session-editor screen
// it belonged to -- see the Train redesign, which reads this same catalog
// data through the Workout Plan Library builder instead. This test now only
// verifies the catalog/preset data contract above, which that builder relies on.
console.log('PASS: 28 phase activities, 12 presets, per-side targets, and guidance data contract.');
