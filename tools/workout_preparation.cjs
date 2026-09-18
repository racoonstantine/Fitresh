// Phase-specific activities and composable presets. Targets are app defaults.
const source={id:'aha-warm-cool',title:'American Heart Association: Warm Up, Cool Down',url:'https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/warm-up-cool-down'};
const rows=[
 ['wu-march','Easy March / Walk','warmup','full_body','hold',300,false,'Begin gently and gradually increase your pace while keeping breathing comfortable.'],
 ['wu-cycle','Easy Cycle','warmup','legs','hold',300,false,'Pedal with light resistance and gradually increase cadence.'],
 ['wu-arm-circles','Arm Circles','warmup','shoulders','reps',10,false,'Make small controlled circles, then reverse direction. One circle is one rep; count both directions in the total.'],
 ['wu-shoulder-rolls','Shoulder Rolls','warmup','shoulders,back','reps',10,false,'Roll shoulders gently upward, backward and down without forcing the range.'],
 ['wu-leg-swings','Supported Leg Swings','warmup','legs,glutes','reps',10,true,'Hold a stable support and swing one leg gently forward and back. One forward-and-back cycle is one rep.'],
 ['wu-hip-circles','Hip Circles','warmup','legs,glutes','reps',10,false,'With a stable stance, make comfortable circles at the hips. Count both directions in the total.'],
 ['wu-ankle-rocks','Supported Ankle Rocks','warmup','calves,legs','reps',10,true,'With one foot forward, gently move the knee over the toes while keeping the heel down.'],
 ['wu-squat','Easy Bodyweight Squat','warmup','legs,glutes','reps',8,false,'Sit the hips down and back through a comfortable range, then stand smoothly.'],
 ['wu-hinge','Unloaded Hip Hinge','warmup','legs,glutes,back','reps',8,false,'Keep knees soft, send hips back and return to standing with a controlled torso.'],
 ['wu-reverse-lunge','Supported Reverse Lunge','warmup','legs,glutes','reps',6,true,'Use stable support if needed. Step back into a shallow comfortable lunge and return.'],
 ['wu-cat-cow','Gentle Cat–Cow','warmup','back,core','reps',8,false,'On hands and knees, alternate a gentle rounded and extended spine. One full cycle is one rep.'],
 ['wu-thoracic-rotation','Standing Thoracic Rotation','warmup','back,core','reps',8,true,'Rotate your upper torso gently to one side while keeping hips comfortable and stable.'],
 ['wu-wall-slide','Wall Slides','warmup','shoulders,back','reps',8,false,'Slide your arms upward along a wall within a comfortable range without forcing contact.'],
 ['wu-wrist-circles','Wrist Circles','warmup','forearms','reps',10,false,'Circle both wrists gently together. Count circles across both directions.'],
 ['wu-side-step','Easy Lateral Steps','warmup','legs,glutes','hold',60,false,'Take controlled side steps in a clear space. Keep the pace easy; no sharp cuts.'],
 ['wu-shadow-swing','Easy Racket Shadow Swings','warmup','shoulders,forearms,core','reps',10,false,'Rehearse slow forehand and backhand swings in a clear space. Count each swing as one rep.'],
 ['cd-walk','Gradually Slower Walk','cooldown','full_body','hold',300,false,'Walk gently and gradually reduce your pace rather than stopping abruptly.'],
 ['cd-cycle','Gradually Slower Cycle','cooldown','legs','hold',300,false,'Reduce resistance and cadence gradually while continuing to pedal gently.'],
 ['cd-calf','Supported Calf Stretch','cooldown','calves,legs','hold',20,true,'Step one foot back, keep its heel down and lean forward gently. Hold without bouncing or pain.'],
 ['cd-quad','Supported Quadriceps Stretch','cooldown','legs','hold',20,true,'Hold stable support. Bend one knee and gently bring the heel toward the seat without forcing it.'],
 ['cd-hamstring','Seated Hamstring Stretch','cooldown','legs','hold',20,true,'Sit securely with one leg extended and hinge forward gently from the hips. Keep the stretch comfortable.'],
 ['cd-glute','Seated Figure-four Stretch','cooldown','glutes','hold',20,true,'On a stable chair, rest one ankle over the opposite thigh and lean forward gently if comfortable.'],
 ['cd-hip-flexor','Standing Hip-flexor Stretch','cooldown','legs,glutes','hold',20,true,'Use a split stance, gently tuck the pelvis and shift forward without arching the lower back.'],
 ['cd-chest','Doorway Chest Stretch','cooldown','chest,shoulders','hold',20,true,'Rest one forearm against a doorway and turn away gently within a comfortable shoulder range.'],
 ['cd-shoulder','Cross-body Shoulder Stretch','cooldown','shoulders','hold',20,true,'Bring one arm across the chest and support it gently with the opposite arm.'],
 ['cd-triceps','Overhead Triceps Stretch','cooldown','triceps,shoulders','hold',20,true,'Bend one elbow overhead and use light support from the opposite hand without forcing the shoulder.'],
 ['cd-forearm','Gentle Forearm Stretch','cooldown','forearms','hold',20,true,'Extend one arm and gently draw the fingers back with the other hand; keep pressure light.'],
 ['cd-back','Supported Back Stretch','cooldown','back','hold',20,false,'Rest hands on a stable surface and hinge back gently, keeping knees soft and breathing normally.']
];
const activities=rows.map(([id,name,phase,parts,tracking,target,perSide,instructions])=>({id,name,category:phase,phase,bodyParts:parts.split(','),primaryMuscles:[],secondaryMuscles:[],equipmentTags:id.includes('cycle')?['stationary_bike']:['bodyweight'],movement:phase==='warmup'?'preparation':'recovery',tracking,instructions,loadConvention:perSide?'Log left and right sides as separate sets. The target is per side.':'Record actual repetitions or seconds; no external load is required.',phaseTarget:{sets:perSide?2:1,...(tracking==='reps'?{reps:target}:{durationSeconds:target}),perSide},sourceIds:[source.id]}));
const map=new Map(activities.map(a=>[a.id,a]));
const specs=[
 ['warmup-full-body','Full-body Warm-up','warmup',['strength','general_fitness'],['wu-march','wu-arm-circles','wu-squat','wu-hinge']],
 ['warmup-upper-body','Upper-body Warm-up','warmup',['upper_body','strength'],['wu-march','wu-shoulder-rolls','wu-wall-slide','wu-thoracic-rotation','wu-wrist-circles']],
 ['warmup-lower-body','Lower-body Warm-up','warmup',['lower_body','strength'],['wu-march','wu-leg-swings','wu-ankle-rocks','wu-squat']],
 ['warmup-running','Walking / Running Warm-up','warmup',['walking','running'],['wu-march','wu-ankle-rocks','wu-leg-swings']],
 ['warmup-cycling','Cycling Warm-up','warmup',['cycling','indoor-cycling'],['wu-cycle','wu-hip-circles','wu-shoulder-rolls']],
 ['warmup-court','Basketball / Court-sport Warm-up','warmup',['basketball','volleyball'],['wu-march','wu-side-step','wu-squat','wu-arm-circles']],
 ['warmup-racket','Pickleball / Racket-sport Warm-up','warmup',['pickleball','tennis','badminton','padel'],['wu-march','wu-side-step','wu-wrist-circles','wu-shadow-swing']],
 ['cooldown-full-body','Full-body Cooldown','cooldown',['strength','general_fitness'],['cd-walk','cd-calf','cd-hamstring','cd-chest','cd-back']],
 ['cooldown-upper-body','Upper-body Cooldown','cooldown',['upper_body','strength'],['cd-walk','cd-chest','cd-shoulder','cd-triceps','cd-back']],
 ['cooldown-lower-body','Lower-body Cooldown','cooldown',['lower_body','running'],['cd-walk','cd-calf','cd-quad','cd-hamstring','cd-glute']],
 ['cooldown-cycling','Cycling Cooldown','cooldown',['cycling','indoor-cycling'],['cd-cycle','cd-quad','cd-hip-flexor','cd-back']],
 ['cooldown-court','Court / Racket-sport Cooldown','cooldown',['basketball','pickleball','tennis','badminton'],['cd-walk','cd-calf','cd-shoulder','cd-forearm']]
];
const templates=specs.map(([id,name,phase,suitableFor,ids])=>({id,name,phase,style:'steady',suitableFor,sourceIds:[source.id],description:'Editable app preset. Move comfortably; do not force or bounce stretches. Adjust duration to your activity and ability.',items:ids.map(activityId=>{const a=map.get(activityId),p=a.phaseTarget;return {activityId,phase,setCount:p.sets,prescription:{...p},target:`${p.sets} set${p.sets>1?'s':''} × ${p.reps?`${p.reps} reps`:`${p.durationSeconds} sec`}${p.perSide?' (one set per side)':''}`};})}));
module.exports={activities,templates,source};
