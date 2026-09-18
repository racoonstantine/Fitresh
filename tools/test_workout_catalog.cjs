const fs=require('node:fs'),assert=require('node:assert/strict');
const catalog=JSON.parse(fs.readFileSync('data/workouts/catalog.json','utf8'));
const byId=new Map(catalog.activities.map(a=>[a.id,a]));
assert.equal(byId.size,catalog.activities.length,'Unique stable IDs');
assert.ok(byId.size>=100);
for(const id of ['a1','a8','b1','b8','walking','basketball','pickleball'])assert.ok(byId.has(id),'Keep existing ID '+id);
for(const part of ['back','legs','shoulders','biceps','triceps','chest','core','glutes','calves','forearms'])assert.ok(catalog.activities.some(a=>a.bodyParts.includes(part)),part);
for(const a of catalog.activities){
 assert.equal(a.schemaVersion,2);assert.ok(a.bodyParts.length);assert.ok(a.equipmentTags.length);
 assert.equal(new Set(a.measurements.map(m=>m.key)).size,a.measurements.length);
 assert.ok(a.measurements.some(m=>m.required));
 for(const m of a.measurements){assert.ok(m.unit);assert.ok(m.min<=m.max);assert.ok(['set','session','activity'].includes(m.scope));}
 for(const goal of Object.values(a.guidance))for(const g of Object.values(goal)){
  assert.equal(g.suggestedWeightKg,null);assert.equal(g.genderAdjustment,false);
  assert.ok(g.loadInstruction);if(g.sets)assert.ok(g.sets[0]<=g.sets[1]);
  if(a.tracking==='hold')assert.equal(g.reps,undefined);
  if(a.tracking==='session')assert.equal(g.sets,undefined);
 }
}
assert.ok(byId.get('swimming').measurements.some(m=>m.key==='laps'));
assert.ok(byId.get('tennis').measurements.some(m=>m.key==='sportSets'));
assert.ok(byId.get('boxing').measurements.some(m=>m.key==='rounds'));
assert.ok(byId.get('basketball-shooting').measurements.some(m=>m.key==='successes'));
assert.ok(!byId.get('pickleball').measurements.some(m=>m.key==='weightKg'));
for(const template of catalog.templates)for(const item of template.items)assert.ok(byId.has(item.activityId));
console.log(`PASS: ${byId.size} catalog entries, stable IDs, body coverage, measurement schemas, guidance and template references.`);
