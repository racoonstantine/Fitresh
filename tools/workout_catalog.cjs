// Structured catalog enrichment, shared by the SQL and JSON catalog outputs.
const source='https://acsm.org/resistance-training-guidelines-update-2026/';
const metric=(key,label,unit,min,max,integer=false,required=false)=>({key,label,unit,min,max,integer,required,scope:'session'});
const metrics={
 durationSeconds:metric('durationSeconds','Duration','seconds',1,604800,false,true),
 distanceKm:metric('distanceKm','Distance','km',0,10000),
 calories:metric('calories','Calories','kcal',0,100000),
 avgHr:metric('avgHr','Average heart rate','bpm',20,300),
 effort:metric('effort','Perceived effort','1–10',1,10),
 rounds:metric('rounds','Rounds completed','rounds',0,1000,true),
 games:metric('games','Games played','games',0,1000,true),
 sportSets:metric('sportSets','Sport sets played','sets',0,1000,true),
 laps:metric('laps','Pool lengths completed','lengths',0,10000,true),
 elevationMeters:metric('elevationMeters','Elevation gain','m',0,20000),
 steps:metric('steps','Steps','steps',0,500000,true),
 attempts:metric('attempts','Attempts','attempts',0,100000,true),
 successes:metric('successes','Successful attempts','attempts',0,100000,true),
 holes:metric('holes','Holes played','holes',0,200,true),
 routes:metric('routes','Routes completed','routes',0,1000,true),
 jumps:metric('jumps','Jumps completed','jumps',0,100000,true)
};
const strengthRows=[
 ['barbell-back-squat','Barbell Back Squat','legs,glutes','quadriceps,glutes','core','barbell,rack','squat'],
 ['barbell-front-squat','Barbell Front Squat','legs,glutes','quadriceps,glutes','core','barbell,rack','squat'],
 ['bodyweight-squat','Bodyweight Squat','legs,glutes','quadriceps,glutes','core','bodyweight','squat','reps'],
 ['leg-press','Leg Press','legs,glutes','quadriceps,glutes','hamstrings','machine','squat'],
 ['leg-extension','Leg Extension','legs','quadriceps','','machine','extension'],
 ['seated-leg-curl','Seated Leg Curl','legs','hamstrings','','machine','curl'],
 ['lying-leg-curl','Lying Leg Curl','legs','hamstrings','','machine','curl'],
 ['split-squat','Dumbbell Split Squat','legs,glutes','quadriceps,glutes','core','dumbbells','lunge'],
 ['step-up','Dumbbell Step-up','legs,glutes','quadriceps,glutes','calves','dumbbells,box','step'],
 ['barbell-deadlift','Barbell Deadlift','legs,glutes,back','glutes,hamstrings','back,core','barbell','hinge'],
 ['barbell-rdl','Barbell Romanian Deadlift','legs,glutes','hamstrings,glutes','back','barbell','hinge'],
 ['hip-thrust','Barbell Hip Thrust','glutes','glutes','hamstrings','barbell,bench','hip_extension'],
 ['glute-bridge','Glute Bridge','glutes','glutes','hamstrings','bodyweight','hip_extension','reps'],
 ['cable-kickback','Cable Glute Kickback','glutes','glutes','','cable','hip_extension'],
 ['standing-calf-raise','Standing Calf Raise Machine','calves,legs','calves','','machine','plantar_flexion'],
 ['seated-calf-raise','Seated Calf Raise','calves,legs','calves','','machine','plantar_flexion'],
 ['lat-pulldown','Lat Pulldown','back','lats','biceps','cable','vertical_pull'],
 ['seated-cable-row','Seated Cable Row','back','lats,upper_back','biceps','cable','horizontal_pull'],
 ['barbell-row','Barbell Bent-over Row','back','lats,upper_back','biceps,core','barbell','horizontal_pull'],
 ['chest-supported-row','Chest-supported Dumbbell Row','back','upper_back,lats','biceps','dumbbells,bench','horizontal_pull'],
 ['pull-up','Pull-up','back','lats','biceps','pull_up_bar','vertical_pull','reps'],
 ['chin-up','Chin-up','back,biceps','lats,biceps','','pull_up_bar','vertical_pull','reps'],
 ['straight-arm-pulldown','Straight-arm Cable Pulldown','back','lats','triceps','cable','pulldown'],
 ['back-extension','Bodyweight Back Extension','back','lower_back','glutes,hamstrings','roman_chair','extension','reps'],
 ['barbell-bench-press','Barbell Bench Press','chest','chest','triceps,shoulders','barbell,bench','horizontal_push'],
 ['dumbbell-bench-press','Dumbbell Bench Press','chest','chest','triceps,shoulders','dumbbells,bench','horizontal_push'],
 ['machine-chest-press','Machine Chest Press','chest','chest','triceps,shoulders','machine','horizontal_push'],
 ['cable-chest-fly','Cable Chest Fly','chest','chest','shoulders','cable','fly'],
 ['incline-push-up','Incline Push-up','chest','chest','triceps,core','bench','horizontal_push','reps'],
 ['barbell-overhead-press','Barbell Overhead Press','shoulders','deltoids','triceps,core','barbell','vertical_push'],
 ['machine-shoulder-press','Machine Shoulder Press','shoulders','deltoids','triceps','machine','vertical_push'],
 ['rear-delt-fly','Dumbbell Rear Delt Fly','shoulders,back','rear_deltoids','upper_back','dumbbells','fly'],
 ['face-pull','Cable Face Pull','shoulders,back','rear_deltoids,upper_back','','cable','pull'],
 ['dumbbell-shrug','Dumbbell Shrug','back','trapezius','forearms','dumbbells','shrug'],
 ['hammer-curl','Dumbbell Hammer Curl','biceps,forearms','biceps,brachialis','forearms','dumbbells','curl'],
 ['barbell-curl','Barbell Curl','biceps','biceps','forearms','barbell','curl'],
 ['preacher-curl','Machine Preacher Curl','biceps','biceps','','machine','curl'],
 ['cable-curl','Cable Biceps Curl','biceps','biceps','','cable','curl'],
 ['triceps-pushdown','Cable Triceps Pushdown','triceps','triceps','','cable','extension'],
 ['overhead-triceps-extension','Dumbbell Overhead Triceps Extension','triceps','triceps','','dumbbell','extension'],
 ['lying-triceps-extension','EZ-bar Lying Triceps Extension','triceps','triceps','','ez_bar,bench','extension'],
 ['wrist-curl','Dumbbell Wrist Curl','forearms','forearms','','dumbbells','curl'],
 ['reverse-curl','EZ-bar Reverse Curl','forearms,biceps','forearms,brachialis','biceps','ez_bar','curl'],
 ['dead-bug','Dead Bug','core','abdominals','hip_flexors','bodyweight','brace','reps'],
 ['side-plank','Side Plank','core','obliques','shoulders','bodyweight','brace','hold'],
 ['cable-crunch','Cable Crunch','core','abdominals','','cable','flexion'],
 ['pallof-press','Cable Pallof Press','core','abdominals,obliques','','cable','anti_rotation'],
 ['hanging-knee-raise','Hanging Knee Raise','core','abdominals','hip_flexors','pull_up_bar','flexion','reps'],
 ['wall-sit','Wall Sit','legs','quadriceps','glutes','bodyweight','isometric','hold']
];
const sessionRows=[
 ['hiking','Hiking','cardio','legs,glutes','outdoors','distanceKm,elevationMeters,steps'],
 ['treadmill','Treadmill Walking / Running','cardio','legs','treadmill','distanceKm,steps'],
 ['stair-climber','Stair Climber','cardio','legs,glutes','machine','steps'],
 ['indoor-cycling','Indoor Cycling','cardio','legs','stationary_bike','distanceKm'],
 ['dance','Dance Fitness','cardio','full_body','none','steps'],
 ['boxing','Boxing Training','sport','full_body','gloves','rounds'],
 ['kickboxing','Kickboxing Training','sport','full_body','gloves','rounds'],
 ['martial-arts','Martial Arts Practice','sport','full_body','none','rounds'],
 ['table-tennis','Table Tennis','sport','full_body','paddle,table','games,sportSets'],
 ['squash','Squash','sport','full_body','racket,court','games'],
 ['padel','Padel','sport','full_body','racket,court','games,sportSets'],
 ['golf','Golf','sport','full_body','clubs','holes,distanceKm,steps'],
 ['baseball','Baseball / Softball','sport','full_body','bat,ball','attempts,successes'],
 ['rugby','Rugby','sport','full_body','ball,field','distanceKm'],
 ['field-hockey','Field Hockey','sport','full_body','stick,field','distanceKm'],
 ['ice-hockey','Ice Hockey','sport','full_body','skates,stick','distanceKm'],
 ['climbing','Indoor Climbing','sport','back,forearms,legs','climbing_wall','routes'],
 ['kayaking','Kayaking','sport','back,core','kayak','distanceKm'],
 ['paddleboarding','Stand-up Paddleboarding','sport','core,full_body','paddleboard','distanceKm'],
 ['surfing','Surfing','sport','full_body','surfboard','attempts,successes'],
 ['skating','Inline / Ice Skating','sport','legs,glutes','skates','distanceKm'],
 ['skiing','Skiing','sport','legs,core','skis','distanceKm,elevationMeters'],
 ['snowboarding','Snowboarding','sport','legs,core','snowboard','distanceKm'],
 ['basketball-shooting','Basketball Shooting Practice','sport','full_body','basketball,hoop','attempts,successes'],
 ['pilates','Pilates','mobility','core,full_body','mat',''],
 ['tai-chi','Tai Chi','mobility','full_body','none',''],
 ['shoulder-mobility','Shoulder Mobility Practice','mobility','shoulders','none',''],
 ['hip-mobility','Hip Mobility Practice','mobility','legs,glutes','mat',''],
 ['ankle-mobility','Ankle Mobility Practice','mobility','calves,legs','none','']
];
const split=s=>s?s.split(','):[];
function guidance(a){
 const result={};
 for(const goal of ['general_fitness','muscle_gain','strength','muscular_endurance','weight_management']) {
  result[goal]={};
  for(const experience of ['beginner','experienced']) {
   const novice=experience==='beginner';
   let reps=goal==='muscular_endurance'?[12,20]:goal==='strength'&&!novice?[4,6]:[8,12];
   const isolation=['curl','extension','raise','fly','plantar_flexion','shrug'].includes(a.movement);
   if(isolation&&goal==='strength')reps=[8,12];
   const g={goal,experience,kind:'editable_starting_point',sets:novice?[1,2]:[2,3],reps,restSeconds:goal==='strength'?[120,180]:[60,120],suggestedWeightKg:null,weightMethod:a.tracking==='load'?'calibrate_to_target_reps':'not_applicable',loadInstruction:a.tracking==='load'?'Start with a light load you can control throughout the target range. Aim to finish with about 2–3 good repetitions still possible. Record the actual load; adjust next time based on performance.':'Choose a variation that lets you complete the target with control.',genderAdjustment:false,sourceIds:['acsm-2026'],rationale:'App starting defaults, not a personalized prescription. Adjust for ability, technique, equipment and recovery.'};
   if(a.tracking==='hold'){delete g.reps;g.durationSeconds=[15,30];}
   if(a.tracking==='session'){delete g.sets;delete g.reps;delete g.restSeconds;g.durationSeconds=a.category==='mobility'?[300,900]:[600,1800];g.loadInstruction='Choose a duration and intensity you can sustain comfortably. This is an editable planning duration, not a sport-specific performance target.';g.sourceIds=[];}
   result[goal][experience]=g;
  }
 }
 return result;
}
function enrich(activities){
 const preparation=require('./workout_preparation.cjs');
 activities.push(...preparation.activities);
 for(const [id,name,parts,primary,secondary,equipment,movement,tracking='load'] of strengthRows)activities.push({id,name,category:'strength',bodyParts:split(parts),primaryMuscles:split(primary),secondaryMuscles:split(secondary),equipmentTags:split(equipment),movement,tracking,instructions:'Use a controlled movement through a comfortable range. Stop the set when you can no longer maintain your technique.',loadConvention:tracking==='load'?'Record total external load moved per repetition; combine paired dumbbells. Record unilateral sides as separate sets. Machine loads are comparable only on the same machine.':'Record repetitions or seconds. Body mass is not external lifting volume.'});
 for(const [id,name,category,parts,equipment,extra] of sessionRows)activities.push({id,name,category,bodyParts:split(parts),primaryMuscles:[],secondaryMuscles:[],equipmentTags:split(equipment),movement:category,tracking:'session',extraMetrics:split(extra),instructions:'Record completed activity time and available measurements. Count successful attempts only within the attempts recorded for this session.',loadConvention:''});
 const legacyParts={a1:['legs','glutes'],a2:['back','biceps'],a3:['chest','triceps'],a4:['shoulders','triceps'],a5:['legs','glutes'],a6:['core'],a7:['core'],a8:['core'],b1:['legs','glutes'],b2:['legs','glutes'],b3:['chest'],b4:['shoulders'],b5:['biceps'],b6:['core'],b7:['core'],b8:['core']};
 const sportsMetrics={basketball:['distanceKm','games'],pickleball:['games'],tennis:['games','sportSets'],badminton:['games','sportSets'],volleyball:['sportSets'],football:['distanceKm'],swimming:['distanceKm','laps'],'jump-rope':['jumps'],walking:['distanceKm','steps'],running:['distanceKm'],cycling:['distanceKm'],rowing:['distanceKm'],elliptical:['distanceKm']};
 for(const a of activities){
  a.schemaVersion=2;a.bodyParts??=legacyParts[a.id]||['full_body'];
  a.primaryMuscles??=a.category==='strength'?(a.focus||'').split(', ').filter(v=>v!=='conditioning'):[];a.secondaryMuscles??=[];
  a.equipmentTags??=(a.equipment||'none').toLowerCase().split(/, | or /).map(s=>s.replaceAll(' ','_'));
  a.equipmentTags=[...new Set(a.equipmentTags.flatMap(v=>({dumbbell:['dumbbells'],ball_and_court:['ball','court'],ball_and_field:['ball','field'],racket_and_court:['racket','court']}[v]||[v])))];
  a.primaryMuscles=a.primaryMuscles.map(v=>v.toLowerCase().replaceAll(' ','_'));
  a.focus??=a.primaryMuscles.join(', ')||a.bodyParts.join(', ');a.equipment??=a.equipmentTags.join(', ');
  a.experienceLevels=['beginner','experienced'];a.goals=['general_fitness','muscle_gain','strength','muscular_endurance','weight_management'];
  if(a.category!=='strength')a.goals=['general_fitness','weight_management',a.category==='mobility'?'mobility':'cardiorespiratory_endurance'];
  a.measurements=a.tracking==='session'?['durationSeconds',...(a.extraMetrics||sportsMetrics[a.id]||[]),'calories','avgHr','effort'].map(k=>metrics[k]):[
   {key:'sets',scope:'activity',unit:'sets',derived:true,required:true,min:1,max:50,integer:true},
   ...(a.tracking==='hold'?[{key:'durationSeconds',scope:'set',unit:'seconds',required:true,min:1,max:86400,integer:true}]:[{key:'reps',scope:'set',unit:'reps',required:true,min:1,max:10000,integer:true}]),
   ...(a.tracking==='load'?[{key:'weightKg',scope:'set',unit:'kg',required:true,min:0,max:2000,integer:false}]:[])
  ];
  a.guidance=guidance(a);a.guidanceVersion=1;
  a.phase??='main';
  if(a.phaseTarget){
   a.goals=[a.phase==='warmup'?'preparation':'recovery'];
   for(const group of Object.values(a.guidance))for(const g of Object.values(group)){
    const p=a.phaseTarget;g.sets=[p.sets,p.sets];g.restSeconds=[0,30];
    if(p.reps)g.reps=[p.reps,p.reps];else{delete g.reps;g.durationSeconds=[p.durationSeconds,p.durationSeconds];}
    g.loadInstruction=a.instructions;g.sourceIds=[preparation.source.id];g.perSide=p.perSide;
   }
  }
  delete a.extraMetrics;
 }
 return {schemaVersion:2,sources:[{id:'acsm-2026',url:source,title:'ACSM 2026 resistance training guidance'},preparation.source],recommendationPolicy:{audience:'generally healthy adults',genderBasedLoading:false,absoluteStartingLoads:false,note:'Use goals, experience and observed performance. Gender alone does not determine an appropriate working weight. Defaults are editable application choices.'},activities};
}
module.exports={enrich,metrics};
