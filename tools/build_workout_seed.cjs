// Rebuild deterministic SQL from the original starter routines plus curated activity metadata.
const fs = require('node:fs');
const vm = require('node:vm');
const html = require('./app_source.cjs')();
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const dayData ='),html.indexOf('const cardioData ='))+';this.days=dayData;',ctx);
const tags = [
 ['quadriceps, glutes','dumbbell','squat','load'],['back, biceps','dumbbell','pull','load'],['chest, triceps','bodyweight','push','reps'],['shoulders, triceps','dumbbells','push','load'],['hamstrings, glutes','dumbbells','hinge','load'],['core','bodyweight','brace','hold'],['core','bodyweight','rotation','reps'],['core, hip flexors','bodyweight','brace','reps'],
 ['quadriceps, glutes','dumbbells','lunge','load'],['glutes, hamstrings','dumbbells','hinge','load'],['chest, triceps','dumbbells, bench','push','load'],['shoulders','dumbbells','raise','load'],['biceps','dumbbells','curl','load'],['core, glutes','bodyweight','brace','reps'],['core','dumbbell','rotation','load'],['core, conditioning','bodyweight','brace','hold']
];
let n=0;
const activities=[],templates=[];
for(const [key,day] of Object.entries(ctx.days)) {
 const items=[];
 for(const ex of day.exercises) {
  const [focus,equipment,movement,tracking]=tags[n++];
  activities.push({id:ex.id,name:ex.name,category:'strength',focus,equipment,movement,tracking,instructions:ex.cue,loadConvention:tracking==='load'?'Total external load moved in each repetition. For two dumbbells, enter their combined weight. For unilateral exercises, record each side as its own set.':'Record repetitions or seconds; bodyweight is not counted as external load.'});
  items.push({activityId:ex.id,target:ex.scheme,setCount:3});
 }
 templates.push({id:'strength-'+key.toLowerCase(),name:'Strength '+key,style:'straight',items});
}
for(const [id,name,category,focus,equipment] of [
 ['walking','Walking','cardio','Aerobic endurance','None'],['running','Running','cardio','Aerobic endurance','None'],['cycling','Cycling','cardio','Aerobic endurance','Bicycle or stationary bike'],['rowing','Rowing','cardio','Aerobic endurance','Rowing machine'],['swimming','Swimming','cardio','Aerobic endurance','Pool'],['elliptical','Elliptical','cardio','Aerobic endurance','Elliptical'],['jump-rope','Jump rope','cardio','Conditioning, coordination','Jump rope'],
 ['basketball','Basketball','sport','Conditioning, coordination','Ball and court'],['pickleball','Pickleball','sport','Agility, coordination','Paddle, ball and court'],['tennis','Tennis','sport','Agility, coordination','Racket, ball and court'],['badminton','Badminton','sport','Agility, coordination','Racket and court'],['football','Football / soccer','sport','Conditioning, coordination','Ball and field'],['volleyball','Volleyball','sport','Coordination, jumping','Ball and court'],['yoga','Yoga','mobility','Mobility, balance','Mat'],['stretching','Stretching','mobility','Flexibility','None'],['mobility','Mobility practice','mobility','Range of motion','None']
]) activities.push({id,name,category,focus,equipment,movement:category,tracking:'session',instructions:'Record your completed session. Add optional measurements only when available.',loadConvention:''});
const catalog=require('./workout_catalog.cjs').enrich(activities);
templates.push(...require('./workout_preparation.cjs').templates);
catalog.templates=templates;
fs.mkdirSync('data/workouts',{recursive:true});
fs.writeFileSync('data/workouts/catalog.json',JSON.stringify(catalog,null,2)+'\n');
const quote=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"''")+"'";
const sql=['-- Run after 004_workout_library.sql. Rerunnable shared catalog seed.'];
for(const a of activities) sql.push(`INSERT INTO workout_activities (id,name,category,definition) VALUES (${[a.id,a.name,a.category,JSON.stringify(a)].map(quote).join(',')}) ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),definition=VALUES(definition);`);
for(const t of templates) sql.push(`INSERT INTO workout_templates (id,name,definition) VALUES (${[t.id,t.name,JSON.stringify(t)].map(quote).join(',')}) ON DUPLICATE KEY UPDATE name=VALUES(name),definition=VALUES(definition);`);
fs.writeFileSync('db/workout_seed.sql',sql.join('\n')+'\n');
console.log(`${activities.length} activities and ${templates.length} templates generated.`);
