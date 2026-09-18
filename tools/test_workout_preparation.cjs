const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
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
// Exercise the real draft insertion logic: preserve entered results and phase ordering.
const js=fs.readFileSync('public/workouts.js','utf8');
const add=js.slice(js.indexOf(' function add('),js.indexOf(' function history('));
const ctx=vm.createContext({catalog:c.activities,sessions:[],draft:{items:[]},recommendation:a=>a.guidance.general_fitness.beginner,targetText:()=>'',emptySet:()=>({reps:null,weightKg:null,durationSeconds:null})});
vm.runInContext(add,ctx);
ctx.add('a1');ctx.draft.items[0].sets[0].reps=11;
for(const i of presets.find(p=>p.id==='cooldown-full-body').items)ctx.add(i.activityId,i.target,i.setCount);
for(const i of presets.find(p=>p.id==='warmup-full-body').items)ctx.add(i.activityId,i.target,i.setCount);
const phases=Array.from(ctx.draft.items,i=>i.snapshot.phase);
assert.deepEqual(phases,['warmup','warmup','warmup','warmup','main','cooldown','cooldown','cooldown','cooldown','cooldown']);
assert.equal(ctx.draft.items[4].sets[0].reps,11);
assert.equal(ctx.draft.items[0].sets[0].durationSeconds,null,'Targets must not become completed time');
console.log('PASS: 28 phase activities, 12 presets, per-side targets, insertion order, preserved results, and empty completed fields.');
