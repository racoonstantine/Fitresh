const STORAGE_PREFIX = 'log:';

// Drop-in replacement for the Claude-artifact window.storage API, backed by
// the /api/data.php endpoint so each logged-in user gets their own data.
function handleUnauthorized(){
  showLoginScreen('Your session expired — log in again.');
}
// fetch() + res.json() assumes the server always returns valid JSON. If it
// ever doesn't -- a proxy/CDN error page, a truncated response, a PHP
// warning printed before the JSON body -- res.json() throws a raw native
// parse error whose wording varies by browser engine and reads as
// meaningless noise to a user (e.g. a cryptic "did not match the expected
// pattern" instead of anything actionable). Read the body as text first so
// we can tell "the server rejected this" apart from "the server broke" and
// surface a clear message either way instead of leaking the native error.
async function safeFetchJson(url, options){
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  if(text){
    try { data = JSON.parse(text); }
    catch(e){
      throw new Error(`The server sent back something unexpected (status ${res.status}) — try again in a moment.`);
    }
  }
  return { ok: res.ok, status: res.status, data };
}
window.storage = {
  async get(key){
    try{
      const resource = key.replace(/^log:/, '');
      const res = await fetch(`api/data.php?resource=${encodeURIComponent(resource)}`, { credentials: 'same-origin' });
      if(res.status === 401){ handleUnauthorized(); return null; }
      if(!res.ok) return null;
      const data = await res.json();
      return (data.value === null || data.value === undefined) ? null : { value: data.value };
    }catch(e){ return null; }
  },
  async set(key, value){
    try{
      const resource = key.replace(/^log:/, '');
      const res = await fetch('api/data.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ resource, value })
      });
      if(res.status === 401){ handleUnauthorized(); return false; }
      return res.ok;
    }catch(e){ return false; }
  }
};

const dayData = {
  A: {
    title: "Strength A · 3 sets × 12–15 reps",
    exercises: [
      {id:'a1', name:'Goblet Squat', icon:'goblet-squat', scheme:'3 × 12–15', cue:'Hold one dumbbell vertically at your chest. Feet shoulder-width, sit hips back and down, chest tall. Knees track over toes. Barbell option: front squat or back squat with the bar racked — same tempo, same rep range, don\'t chase heavy weight here.'},
      {id:'a2', name:'Dumbbell Row (bent over)', icon:'dumbbell-row', scheme:'3 × 12–15 per side', cue:'Hinge at the hips, flat back, one dumbbell hanging. Pull elbow back past your ribs, squeeze the shoulder blade. Barbell option: barbell bent-over row, both arms together, same hinge position — good for hitting your back a bit harder.'},
      {id:'a3', name:'Push-up (knees if needed)', icon:'pushup', scheme:'3 × 10–15', cue:'Hands under shoulders, body in a straight line. Drop knees to the floor if a full push-up is too hard. This is your main chest builder — form matters more than the version.'},
      {id:'a4', name:'Dumbbell Shoulder Press', icon:'dumbbell-shoulder-press', scheme:'3 × 12–15', cue:'Seated or standing, press dumbbells overhead without arching your lower back. Barbell option: standing barbell overhead press — brace your core hard, press straight up past your face.'},
      {id:'a5', name:'Romanian Deadlift', icon:'romanian-deadlift', scheme:'3 × 12–15', cue:'Soft knees, hinge at the hips and slide dumbbells down your thighs, back flat. Barbell option: same hinge, bar stays close to your legs the whole way down — this is where a barbell really helps since you can load it more than dumbbells.'},
      {id:'a6', name:'Plank', icon:'plank', scheme:'3 × 30–45 sec', cue:'Forearms down, straight line from head to heels. Squeeze glutes and abs — don\'t let hips sag or pike up.'},
      {id:'a7', name:'Bicycle Crunch', icon:'bicycle-crunch', scheme:'3 × 20 (10 per side)', cue:'Core finisher. Hands behind head, opposite elbow to opposite knee, slow and controlled — don\'t yank your neck. This targets the obliques and lower abs for tone.'},
      {id:'a8', name:'Lying Leg Raise', icon:'lying-leg-raise', scheme:'3 × 12–15', cue:'Core finisher. Lie flat, legs straight, lower back pressed into the floor. Raise legs to 90°, lower slowly without arching your back. Bend knees slightly if your lower back complains.'}
    ]
  },
  B: {
    title: "Strength B · 3 sets × 12–15 reps",
    exercises: [
      {id:'b1', name:'Reverse Lunge (dumbbells)', icon:'reverse-lunge', scheme:'3 × 10–12 per side', cue:'Dumbbells at your sides, step back and lower until both knees hit ~90°. Push through the front heel to return.'},
      {id:'b2', name:'Dumbbell Deadlift', icon:'dumbbell-deadlift', scheme:'3 × 12–15', cue:'Dumbbells in front of thighs, hinge down keeping them close to your legs, flat back throughout. Barbell option: conventional barbell deadlift — bar stays over mid-foot, drive through your heels to stand.'},
      {id:'b3', name:'Incline Press (DB or Barbell)', icon:'incline-press', scheme:'3 × 12–15', cue:'Incline push-up: hands on a sturdy elevated surface. Or lie on an incline bench/pillow wedge and press dumbbells or a barbell up and slightly back — this angle hits the upper chest more than a flat press, good for chest tone.'},
      {id:'b4', name:'Lateral Raise', icon:'lateral-raise', scheme:'3 × 12–15', cue:'Light weight (2–3kg is plenty). Raise arms out to the sides to shoulder height, slight bend in elbows. Control the lowering — that\'s where most of the work happens. This is the move that gives shoulders that rounded, toned look.'},
      {id:'b5', name:'Bicep Curl', icon:'bicep-curl', scheme:'3 × 12–15', cue:'Dumbbell or barbell, elbows pinned to your sides, curl up without swinging your body. Barbell lets both arms work together evenly — good for building visible bicep tone without needing heavy weight.'},
      {id:'b6', name:'Bird-dog', icon:'bird-dog', scheme:'3 × 10 per side', cue:'On hands and knees, extend opposite arm and leg straight out, hold briefly. Keep hips level — don\'t let your torso rotate.'},
      {id:'b7', name:'Weighted Russian Twist', icon:'russian-twist', scheme:'3 × 16 (8 per side)', cue:'Core finisher. Sit with knees bent, lean back slightly, hold one dumbbell or a plate with both hands. Rotate side to side, tapping the weight near the floor. Keep the movement controlled, not fast.'},
      {id:'b8', name:'Mountain Climbers', icon:'mountain-climbers', scheme:'3 × 30 sec', cue:'Core finisher. Plank position, drive knees toward your chest alternating quickly but with control. Keep hips low — this also adds a light cardio hit.'}
    ]
  }
};

const cardioData = {
  steady: {
    title: 'Cardio Steady · Zone 2',
    phases: [
      {phase:'Warm-up walk', detail:'Flat, easy pace', time:'5 min'},
      {phase:'Steady pace', detail:'Incline 2–3%, able to hold a conversation', time:'25–35 min'},
      {phase:'Cool-down walk', detail:'Flat, easy pace, let heart rate settle', time:'5 min'}
    ]
  },
  interval: {
    title: 'Cardio Intervals',
    phases: [
      {phase:'Warm-up walk', detail:'Flat, easy pace', time:'5 min'},
      {phase:'Brisk walk', detail:'Incline 3–4%, purposeful pace', time:'3 min'},
      {phase:'Fast pace', detail:'Push the speed, breathing hard', time:'1 min'},
      {phase:'Repeat brisk/fast', detail:'6–8 rounds total', time:'~24–32 min'},
      {phase:'Cool-down walk', detail:'Flat, easy pace', time:'5 min'}
    ]
  }
};

const weekPlan = [
  {name:'Sun', label:'Rest', day:null},
  {name:'Mon', label:'Strength A + Treadmill', day:'A'},
  {name:'Tue', label:'Cardio Steady', day:'steady'},
  {name:'Wed', label:'Rest / light walk', day:null},
  {name:'Thu', label:'Strength B + Treadmill', day:'B'},
  {name:'Fri', label:'Cardio Intervals', day:'interval'},
  {name:'Sat', label:'Strength A + Treadmill', day:'A'}
];
const tabLabels = {A:'Strength A', B:'Strength B', steady:'Cardio Steady', interval:'Cardio Intervals'};

// ============================================================================
// Entity model, three levels (per the app's own definitions):
//   Exercise/Activity -- a single movement (the 32-item library, unchanged).
//   Workout Plan      -- one training session: one or more exercises/
//                         activities with their sets/reps/target. Presets
//                         reuse the existing Strength A/B + Cardio Steady/
//                         Interval content untouched and aren't editable;
//                         Custom ones are user-built from the library, named,
//                         saved, and editable.
//   Training Plan     -- a weekly schedule (day-of-week -> which Workout
//                         Plan, or Rest/Other), replacing the old
//                         always-the-same-for-everyone `weekPlan` above with
//                         something each account picks/builds for itself.
// Training Program (multi-week phases) is a future addition, not built yet.
// ============================================================================

// ---- Workout Plan (session-level) ----
const WORKOUT_PLAN_PRESETS = {
  strengthA: {id: 'strengthA', name: 'Strength A', kind: 'legacy', legacyKey: 'A'},
  strengthB: {id: 'strengthB', name: 'Strength B', kind: 'legacy', legacyKey: 'B'},
  cardioSteady: {id: 'cardioSteady', name: 'Cardio Steady', kind: 'legacy', legacyKey: 'steady'},
  cardioInterval: {id: 'cardioInterval', name: 'Cardio Intervals', kind: 'legacy', legacyKey: 'interval'}
};
// Custom workout plans: [{id, name, items:[{activityId, target, setCount}]}]
let customWorkoutPlans = [];
async function loadCustomWorkoutPlans(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'customWorkoutPlans', false);
    customWorkoutPlans = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){ customWorkoutPlans = []; }
}
async function saveCustomWorkoutPlans(){
  try{ await window.storage.set(STORAGE_PREFIX + 'customWorkoutPlans', JSON.stringify(customWorkoutPlans), false); }catch(e){}
}
function getWorkoutPlan(id){
  if(!id) return null;
  return WORKOUT_PLAN_PRESETS[id] || customWorkoutPlans.find(p => p.id === id) || null;
}
function allWorkoutPlans(){
  return [...Object.values(WORKOUT_PLAN_PRESETS), ...customWorkoutPlans];
}

// ---- Training Plan (weekly schedule) ----
// days[] indexed like Date.getDay() (0=Sun..6=Sat), matching weekPlan's order.
// dayEntry is one of:
//   {type:'workoutPlan', planId}  -- references a Workout Plan (preset or custom).
//   {type:'rest'} | {type:'other', note:string} | null (nothing set)
// overrides{'YYYY-MM-DD': dayEntry} corrects a single date without touching
// the recurring weekly pattern (e.g. "planned Rest, actually did Strength B").
const TRAINING_PLAN_PRESETS = {
  moderate: {label: 'Moderate', name: 'Moderate', days: [
    {type:'rest'}, {type:'workoutPlan', planId:'strengthA'}, {type:'workoutPlan', planId:'cardioSteady'}, {type:'rest'},
    {type:'workoutPlan', planId:'strengthB'}, {type:'workoutPlan', planId:'cardioInterval'}, {type:'workoutPlan', planId:'strengthA'}
  ]},
  intense: {label: 'Intense', name: 'Intense', days: [
    {type:'rest'}, {type:'workoutPlan', planId:'strengthA'}, {type:'workoutPlan', planId:'strengthB'}, {type:'workoutPlan', planId:'cardioInterval'},
    {type:'workoutPlan', planId:'strengthA'}, {type:'workoutPlan', planId:'strengthB'}, {type:'workoutPlan', planId:'cardioInterval'}
  ]},
  cardioFocused: {label: 'Cardio Focused', name: 'CardioFcs', days: [
    {type:'rest'}, {type:'workoutPlan', planId:'cardioSteady'}, {type:'rest'}, {type:'workoutPlan', planId:'cardioInterval'},
    {type:'rest'}, {type:'workoutPlan', planId:'cardioSteady'}, {type:'workoutPlan', planId:'cardioInterval'}
  ]},
  loseWeight: {label: 'Lose Weight', name: 'LoseWt', days: [
    {type:'rest'}, {type:'workoutPlan', planId:'cardioSteady'}, {type:'workoutPlan', planId:'strengthA'}, {type:'workoutPlan', planId:'cardioInterval'},
    {type:'rest'}, {type:'workoutPlan', planId:'strengthB'}, {type:'workoutPlan', planId:'cardioSteady'}
  ]}
};
let userTrainingPlan = null; // null until loadTrainingPlan() resolves
async function loadTrainingPlan(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'trainingPlan', false);
    if(res && res.value){
      userTrainingPlan = JSON.parse(res.value);
      return;
    }
  }catch(e){}
  // Never saved before -- decide once. An account with prior activity keeps
  // exactly its old always-on schedule (Moderate matches it) as its starting
  // plan, so nothing changes for anyone already using the app; a genuinely
  // new account starts blank.
  const hasPriorActivity = historyLog.length > 0 || Object.keys(checkedState).length > 0;
  userTrainingPlan = hasPriorActivity
    ? { presetKey: 'moderate', name: TRAINING_PLAN_PRESETS.moderate.name, days: TRAINING_PLAN_PRESETS.moderate.days.slice(), overrides: {} }
    : { presetKey: null, name: '', days: [null,null,null,null,null,null,null], overrides: {} };
  await saveTrainingPlan();
}
async function saveTrainingPlan(){
  try{ await window.storage.set(STORAGE_PREFIX + 'trainingPlan', JSON.stringify(userTrainingPlan), false); }catch(e){}
}
// The entry actually in effect for a specific date: a per-date override wins
// over the recurring weekly pattern, so logging something different than
// planned on one day doesn't require editing the whole week.
function effectiveDayEntry(dStr, dayIdx){
  const plan = userTrainingPlan;
  if(!plan) return null;
  if(plan.overrides && plan.overrides[dStr]) return plan.overrides[dStr];
  return (plan.days || [])[dayIdx] || null;
}
// Effective legacy-day key for a given date, for every place that still only
// understands the old 'A'/'B'/'steady'/'interval' concept (dashboard cards,
// insights, history). Custom-plan/rest/other/unset days read as null (a rest
// day) at these call sites for now -- richer custom-plan dashboard
// integration is a follow-up, not part of this pass.
function planDayFor(dayIdx, dStr){
  const entry = effectiveDayEntry(dStr || dateStrForOffset(dayIdx - new Date().getDay()), dayIdx);
  if(!entry || entry.type !== 'workoutPlan') return null;
  const plan = getWorkoutPlan(entry.planId);
  return (plan && plan.kind === 'legacy') ? plan.legacyKey : null;
}
// Same lookup as planDayFor, but returns the scheduled Workout Plan itself
// (legacy or custom) rather than only a legacy key -- used wherever the
// dashboard needs to say what's planned regardless of plan kind.
function scheduledPlanFor(dayIdx, dStr){
  const entry = effectiveDayEntry(dStr, dayIdx);
  if(!entry || entry.type !== 'workoutPlan') return null;
  return getWorkoutPlan(entry.planId);
}

function toLocalDateStr(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function dateStrForOffset(offsetFromToday){
  const d = new Date();
  d.setDate(d.getDate() + offsetFromToday);
  return toLocalDateStr(d);
}
function addDaysToDate(dateStr, delta){
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toLocalDateStr(d);
}
function formatDateLabel(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
}
let nutriSelectedDate = null; // set on init to today; navigable via prev/next
let dashSelectedDate = null; // workout dashboard day-view selected date
let weighInHistPage = 0; // Weigh-in History pagination -- 0 = most recent 5
let weekStripAnchorDate = null; // which week the Training Plan calendar strip shows; null = today's week
function scrollToWorkout(){
  try{
    const el = document.getElementById('sessionPlanHeading');
    if(el && el.scrollIntoView) el.scrollIntoView({behavior:'smooth', block:'start'});
  }catch(e){}
}

let currentDay = 'A';
let checkedState = {};
let historyLog = [];
// 'custom' is a free-text note/deviation with no workout implied; 'rest' is
// an explicit rest-day log (no workout done). Neither should count as a
// completed session for streaks, dashboards, or the workout-vs-sedentary
// nutrition target split.
function isRealSessionEntry(e){ return e.day !== 'custom' && e.day !== 'rest'; }
// Formats an exercise entry's name plus whichever metrics it actually has
// (weight/sets/reps for strength, duration/distance for cardio, intensity
// for sports) -- every field is optional, so only present ones show.
function exerciseSummaryText(ex){
  const parts = [];
  if(ex.weight) parts.push(ex.weight + 'kg');
  if(ex.sets) parts.push(ex.sets + ' sets');
  if(ex.reps) parts.push(ex.reps + ' reps');
  if(ex.duration) parts.push(ex.duration + ' min');
  if(ex.distance) parts.push(ex.distance + ' km');
  if(ex.intensity) parts.push('intensity ' + ex.intensity);
  return ex.name + (parts.length ? ' — ' + parts.join(' · ') : '');
}
let weighIns = []; // [{date:'YYYY-MM-DD', kg: number}]
// Generic fallback goal until a profile with its own goalWeightKg is set (see updateWeightGoalsFromProfile).
let GOAL_WEIGHT = 85;

// ---------- Unit preferences (weight kg/lb, height cm/ft-in) ----------
// Weight and height are always stored canonically in kg/cm everywhere
// (weighIns, profile.currentWeightKg/goalWeightKg/heightCm) -- these helpers
// only convert at the display/input boundary based on the user's
// profile.weightUnit/heightUnit preference (default kg/cm).
const KG_PER_LB = 0.45359237;
function kgToLbs(kg){ return kg / KG_PER_LB; }
function lbsToKg(lbs){ return lbs * KG_PER_LB; }
function cmToFeetInches(cm){
  const totalIn = cm / 2.54;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round((totalIn - feet * 12) * 10) / 10;
  if(inches >= 12){ feet += 1; inches = 0; }
  return {feet, inches};
}
function feetInchesToCm(feet, inches){
  const ft = parseFloat(feet) || 0;
  const inch = parseFloat(inches) || 0;
  if(!ft && !inch) return null;
  return (ft * 12 + inch) * 2.54;
}
function weightUnit(){ return (userProfile && userProfile.weightUnit) || 'kg'; }
function heightUnit(){ return (userProfile && userProfile.heightUnit) || 'cm'; }
function weightUnitLabel(){ return weightUnit() === 'lbs' ? 'lb' : 'kg'; }
function kgToDisplayWeight(kg){
  if(kg === null || kg === undefined || isNaN(kg)) return null;
  return weightUnit() === 'lbs' ? kgToLbs(kg) : kg;
}
function displayWeightToKg(value){
  const num = parseFloat(value);
  if(isNaN(num)) return null;
  return weightUnit() === 'lbs' ? lbsToKg(num) : num;
}
function formatWeightKg(kg, decimals){
  if(kg === null || kg === undefined || isNaN(kg)) return '—';
  const d = decimals === undefined ? 1 : decimals;
  return kgToDisplayWeight(kg).toFixed(d) + ' ' + weightUnitLabel();
}
function formatHeightCm(cm){
  if(!cm) return '—';
  if(heightUnit() === 'ft'){
    const {feet, inches} = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return (cm / 100).toFixed(2) + ' m';
}

let nutritionLog = []; // [{date, fastHours, meal, calories, protein, fat, carbs, notes}]

async function loadNutrition(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'nutrition', false);
    nutritionLog = res ? JSON.parse(res.value) : [];
  }catch(e){ nutritionLog = []; }
}
async function saveNutrition(){
  try{ await window.storage.set(STORAGE_PREFIX + 'nutrition', JSON.stringify(nutritionLog), false); }catch(e){}
}
function formatFastHours(hrs){
  if(hrs === null || hrs === undefined || hrs === '') return '';
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h${m > 0 ? m + 'm' : ''}`;
}
function formatClockTime(d){
  return d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
}
// Shared elapsed/target-end/percent text for the fasting tiles on Today at a Glance
// and the Nutrition Dashboard's "Today's fast" card -- both tick live off the same
// fastingState, so this keeps their wording and math in one place.
function fastingSummaryText(lastLoggedHours){
  if(fastingState.startIso){
    const start = new Date(fastingState.startIso);
    const elapsedMs = Math.max(0, Date.now() - start.getTime());
    const elapsedHrs = elapsedMs / 3600000;
    const goalHrs = fastingState.goalHours || 16;
    const targetEnd = new Date(start.getTime() + goalHrs * 3600000);
    const h = Math.floor(elapsedMs/3600000), m = Math.floor((elapsedMs%3600000)/60000), s = Math.floor((elapsedMs%60000)/1000);
    const pct = elapsedHrs / goalHrs * 100;
    return {
      active: true,
      value: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`,
      sub: `${pct.toFixed(0)}% of ${goalHrs}h · ends ~${formatClockTime(targetEnd)}`,
      pct: Math.min(100, pct)
    };
  }
  const goalHrs = fastingState.goalHours || 16;
  if(lastLoggedHours){
    const pct = lastLoggedHours / goalHrs * 100;
    return {
      active: false,
      value: formatFastHours(lastLoggedHours),
      sub: `${pct.toFixed(0)}% of ${goalHrs}h goal`,
      pct: Math.min(100, pct)
    };
  }
  return {active: false, value: 'Not started', sub: `Goal: ${goalHrs} hours`, pct: 0};
}
function saveNutritionDay(entry){
  nutritionLog = nutritionLog.filter(e => e.date !== entry.date);
  nutritionLog.push(entry);
  nutritionLog.sort((a,b)=> a.date < b.date ? 1 : -1);
  saveNutrition();
}
function removeNutritionDay(dateStr){
  nutritionLog = nutritionLog.filter(e => e.date !== dateStr);
  saveNutrition();
}
// Merges fields into a day's nutritionLog entry without clobbering the rest
// of it (unlike saveNutritionDay, which replaces the whole entry) -- used by
// the fasting timer to write just fastHours onto whatever else is logged that day.
function upsertNutritionFields(dateStr, fields){
  const existing = nutritionLog.find(e => e.date === dateStr);
  const merged = Object.assign({date: dateStr, fastHours:'', meal:'', calories:'', protein:'', fat:'', carbs:'', notes:''}, existing || {}, fields);
  nutritionLog = nutritionLog.filter(e => e.date !== dateStr);
  nutritionLog.push(merged);
  nutritionLog.sort((a,b)=> a.date < b.date ? 1 : -1);
  saveNutrition();
}

// ---------- Search-logged meal totals, merged into the nutritionLog-driven dashboard ----------
let mealTotalsByDate = {};
let mealTotalsGeneration = 0;
async function fetchMealTotals(dateList){
  // Rapid day-nav clicks fire overlapping requests; only the response from
  // the LAST call started is allowed to write mealTotalsByDate, so a slower
  // older request can't overwrite it with stale data after the fact.
  const generation = ++mealTotalsGeneration;
  const uniq = [...new Set(dateList)];
  if(!uniq.length){ if(generation === mealTotalsGeneration) mealTotalsByDate = {}; return; }
  const start = uniq.reduce((a,b)=> a < b ? a : b);
  const end = uniq.reduce((a,b)=> a > b ? a : b);
  try{
    const res = await fetch(`api/meals.php?action=range_totals&start=${start}&end=${end}`, {credentials:'same-origin'});
    const data = await res.json();
    if(generation !== mealTotalsGeneration) return;
    mealTotalsByDate = data.totals || {};
  }catch(e){
    if(generation !== mealTotalsGeneration) return;
    mealTotalsByDate = {};
  }
}
function combinedDayTotals(dateStr, nutriEntry){
  const m = mealTotalsByDate[dateStr] || {};
  return {
    calories: (nutriEntry ? (parseFloat(nutriEntry.calories) || 0) : 0) + (m.ENERC_KCAL || 0),
    protein: (nutriEntry ? (parseFloat(nutriEntry.protein) || 0) : 0) + (m.PROCNT || 0),
    fat: (nutriEntry ? (parseFloat(nutriEntry.fat) || 0) : 0) + (m.FAT || 0),
    carbs: (nutriEntry ? (parseFloat(nutriEntry.carbs) || 0) : 0) + (m.CHOCDF || 0),
    // Sodium/fiber/sugar only ever come from itemized food-search logging (m.*) --
    // the legacy quick-log day entry never captured these.
    sodium: m.NA || 0,
    fiber: m.FIBTG || 0,
    sugar: m.SUGAR || 0,
    hasAny: !!nutriEntry || !!mealTotalsByDate[dateStr]
  };
}

// ---------- Fasting timer ----------
let fastingState = { startIso: null, goalHours: 16 };
let fastingTickInterval = null;
async function loadFasting(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'fasting', false);
    fastingState = res && res.value ? JSON.parse(res.value) : { startIso: null, goalHours: 16 };
  }catch(e){ fastingState = { startIso: null, goalHours: 16 }; }
}
async function saveFasting(){
  try{ await window.storage.set(STORAGE_PREFIX + 'fasting', JSON.stringify(fastingState), false); }catch(e){}
}

// ---------- Water intake (running ml total per day) ----------
let waterLog = {}; // {dateStr: ml}
async function loadWater(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'water', false);
    waterLog = res && res.value ? JSON.parse(res.value) : {};
  }catch(e){ waterLog = {}; }
}
async function saveWater(){
  try{ await window.storage.set(STORAGE_PREFIX + 'water', JSON.stringify(waterLog), false); }catch(e){}
}
function addWaterMl(deltaMl){
  const d = dateStrForOffset(0);
  waterLog[d] = Math.max(0, (waterLog[d] || 0) + deltaMl);
  saveWater();
  renderTodayGlance();
}

// ---------- Sleep (manual last-night bedtime/wake-time entry) ----------
let sleepLog = {}; // {dateStr (wake date): {startIso, endIso, hours}}
async function loadSleep(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'sleep', false);
    sleepLog = res && res.value ? JSON.parse(res.value) : {};
  }catch(e){ sleepLog = {}; }
}
async function saveSleepLog(){
  try{ await window.storage.set(STORAGE_PREFIX + 'sleep', JSON.stringify(sleepLog), false); }catch(e){}
}
function formatSleepHours(hrs){
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
}

// ---------- Steps (manual daily entry; watch sync is a future improvement) ----------
let stepsLog = {}; // {dateStr: count}
async function loadSteps(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'steps', false);
    stepsLog = res && res.value ? JSON.parse(res.value) : {};
  }catch(e){ stepsLog = {}; }
}
async function saveStepsLog(){
  try{ await window.storage.set(STORAGE_PREFIX + 'steps', JSON.stringify(stepsLog), false); }catch(e){}
}

function renderFasting(){
  const card = document.getElementById('fastingCard');
  if(!card) return;
  clearInterval(fastingTickInterval);

  if(!fastingState.startIso){
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;"><div class="block-title" style="margin:0;">Fasting Timer</div><button type="button" class="open-fasting-screen-link" style="background:none;border:none;color:var(--ochre);font-size:12px;font-weight:600;cursor:pointer;padding:0;">Details →</button></div>
      <div style="text-align:center;padding:6px 0;">
        <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:12px;">Not fasting right now.</div>
        <label style="font-size:11px;color:var(--ink-soft);">Goal</label>
        <select id="fastGoalSelect" style="display:block;width:100%;margin:4px 0 14px;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);">
          <option value="12">12:12</option>
          <option value="14">14:10</option>
          <option value="16">16:8</option>
          <option value="18">18:6</option>
          <option value="20">20:4</option>
          <option value="24">24:0 (OMAD)</option>
        </select>
        <button class="timer-btn start" id="startFastBtn" type="button" style="width:100%;">Start Fasting</button>
      </div>
    `;
    const sel = document.getElementById('fastGoalSelect');
    sel.value = String(fastingState.goalHours || 16);
    document.getElementById('startFastBtn').addEventListener('click', ()=>{
      fastingState = { startIso: new Date().toISOString(), goalHours: parseFloat(sel.value) || 16 };
      saveFasting();
      renderFasting();
    });
    return;
  }

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;"><div class="block-title" style="margin:0;">Fasting Timer</div><button type="button" class="open-fasting-screen-link" style="background:none;border:none;color:var(--ochre);font-size:12px;font-weight:600;cursor:pointer;padding:0;">Details →</button></div>
    <div style="text-align:center;">
      <div id="fastElapsed" style="font-family:var(--font-heading);font-size:34px;letter-spacing:.02em;">00:00:00</div>
      <div id="fastPct" style="font-size:12px;color:var(--ink-soft);margin-top:2px;">—</div>
      <div style="height:10px;border-radius:5px;background:var(--paper-raised);border:1px solid var(--line);overflow:hidden;margin:12px 0;">
        <div id="fastProgressBar" style="height:100%;width:0%;background:var(--forest);transition:width .3s;"></div>
      </div>
      <div style="font-size:11px;color:var(--ink-soft);margin-bottom:14px;">Started <span id="fastStartedLabel"></span></div>
      <label style="font-size:11px;color:var(--ink-soft);display:block;text-align:left;">Edit start time</label>
      <input type="datetime-local" id="fastStartEdit" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);margin:2px 0 14px;box-sizing:border-box;">
      <button class="timer-btn reset" id="endFastBtn" type="button" style="width:100%;">End Fast</button>
    </div>
  `;

  const pad = n => String(n).padStart(2,'0');
  const startEditInput = document.getElementById('fastStartEdit');
  const syncStartEditInput = ()=>{
    const d = new Date(fastingState.startIso);
    startEditInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    document.getElementById('fastStartedLabel').textContent = d.toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
  };
  syncStartEditInput();

  const renderTick = ()=>{
    const start = new Date(fastingState.startIso);
    const now = new Date();
    const elapsedMs = Math.max(0, now - start);
    const elapsedHrs = elapsedMs / 3600000;
    const goalHrs = fastingState.goalHours || 16;
    const pct = Math.min(100, (elapsedHrs / goalHrs) * 100);
    const h = Math.floor(elapsedMs / 3600000);
    const m = Math.floor((elapsedMs % 3600000) / 60000);
    const s = Math.floor((elapsedMs % 60000) / 1000);
    document.getElementById('fastElapsed').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    document.getElementById('fastProgressBar').style.width = pct + '%';
    document.getElementById('fastPct').textContent = `${pct.toFixed(0)}% of ${goalHrs}h goal${pct >= 100 ? ' — goal reached!' : ''}`;
  };
  renderTick();
  fastingTickInterval = setInterval(renderTick, 1000);

  startEditInput.addEventListener('change', ()=>{
    const v = startEditInput.value;
    if(!v) return;
    const d = new Date(v);
    if(isNaN(d.getTime()) || d.getTime() > Date.now()) { syncStartEditInput(); return; }
    fastingState.startIso = d.toISOString();
    saveFasting();
    syncStartEditInput();
    renderTick();
  });

  document.getElementById('endFastBtn').addEventListener('click', ()=>{
    const start = new Date(fastingState.startIso);
    const elapsedHrs = (Date.now() - start.getTime()) / 3600000;
    upsertNutritionFields(dateStrForOffset(0), { fastHours: elapsedHrs.toFixed(2) });
    fastingState = { startIso: null, goalHours: fastingState.goalHours || 16 };
    saveFasting();
    renderFasting();
    renderNutrition();
    renderTodayGlance();
  });

  renderTodayGlance();
}

