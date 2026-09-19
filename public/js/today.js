// ---------- Today at a Glance (Today tab summary dashboard) ----------
const DAILY_QUOTES = [
  'Discipline today builds the healthier you tomorrow.',
  'Small steps, repeated daily, add up to big change.',
  'Consistency beats intensity.',
  "You don't have to be extreme, just consistent.",
  'Progress, not perfection.',
  'Every healthy choice today is a vote for who you want to become.',
  "Showing up is half the battle — you already did that.",
  'Your only competition is who you were yesterday.',
  "Rest when you need to, just don't quit.",
  'Strong is a daily practice, not a destination.',
  'One good habit at a time builds a whole new life.',
  "You won't always be motivated — that's why discipline matters.",
  'The best time to start was earlier. The next best time is now.',
  'Slow progress is still progress.',
  'Take care of your body — it’s the only place you have to live.',
  'Kaya mo yan, isang araw lang muna.', // "You can do it, one day at a time."
  'Maliit na hakbang, malaking pagbabago.', // "Small steps, big change."
  'Huwag kang sumuko, konti na lang.', // "Don't give up, you're almost there."
  'Ang pagbabago ay nagsisimula sa iyo.', // "Change begins with you."
  'Bawat araw, isang pagkakataon para umayos.', // "Every day is a chance to improve."
  'Sama-sama nating abutin ang goal mo.', // "Together, let's reach your goal."
  'Tuloy lang, malapit ka na.', // "Keep going, you're getting close."
  'Ang tagumpay ay sa taong hindi sumusuko.' // "Success belongs to those who don't give up."
];
// Chosen once per session (page load) rather than daily, so it's a fresh
// pick each time you open the app instead of the same quote all day.
const SESSION_QUOTE = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];

// ---------- Dedicated-page fun facts (Sleep/Water/Fasting/Steps) ----------
// One random fact per page-open (not per session) so it changes each visit,
// unlike SESSION_QUOTE above which is meant to stay put for the whole session.
const SLEEP_FACTS = [
  "Most adults need 7-9 hours a night — consistency matters as much as total hours.",
  "A regular sleep/wake time trains your body clock better than sleeping in on weekends.",
  "Screens before bed delay melatonin release — dim the lights an hour before sleep.",
  "Deep sleep is when most muscle repair and memory consolidation happens.",
  "Caffeine has a half-life of ~5-6 hours — that 3pm coffee is still in your system at 9pm.",
  "Short naps (20-30 min) can boost alertness without wrecking nighttime sleep.",
  "A cooler room (around 18°C/65°F) generally helps you fall asleep faster."
];
const WATER_FACTS = [
  "Even mild dehydration (as little as 1-2%) can measurably affect mood and focus.",
  "Thirst is a lagging signal — by the time you feel thirsty, you're already a bit behind.",
  "Food contributes roughly 20% of daily water intake, not just what you drink.",
  "Urine that's pale straw-colored is a decent day-to-day hydration signal.",
  "Water needs rise with heat, altitude, and exercise — fixed daily targets are a floor, not a ceiling.",
  "Sipping steadily through the day is easier on the body than chugging it all at once."
];
const FASTING_FACTS = [
  "Insulin levels drop several hours into a fast, making stored fat easier to access for energy.",
  "The 16:8 pattern is popular mostly because it fits a normal sleep schedule with ease.",
  "Black coffee, plain tea, and water typically don't break a fast — added sugar or cream does.",
  "Breaking a long fast with a huge meal can cause more discomfort than easing in gradually.",
  "Consistency in your eating window matters more than nailing the exact hour count.",
  "Fasting affects everyone differently — how you feel matters more than any general rule."
];
const STEPS_FACTS = [
  "10,000 steps/day is a popular round number, not a hard scientific threshold — more steps still help below it.",
  "Short walking breaks after meals can noticeably help post-meal blood sugar levels.",
  "Walking speed (not just step count) is linked to a range of long-term health markers.",
  "Taking the stairs a few times a day adds up to meaningful extra activity over a week.",
  "A short walk is one of the most reliable ways to clear your head during a work day.",
  "Step count varies a lot by stride length — it's most useful as your own personal trend, not a comparison to others."
];
function randomFact(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function updateTodayClock(){
  const el = document.getElementById('todayClock');
  if(!el) return;
  el.textContent = new Date().toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}
setInterval(updateTodayClock, 30000);
// A progress ring. Pass the raw percentage; overKind ('bad' for a limit such as
// carbs/fat, 'good' for a target such as protein/steps) makes going past 100%
// wrap around as a second lap in the over colour, with a round cap at its tip.
function glanceRing(pct, colorVar, size, centerHtml, overKind){
  const raw = Math.max(0, pct || 0);
  const clamped = Math.min(100, raw);
  const over = overKind && raw > 100 ? Math.min(raw - 100, 100) : 0;
  const overColor = OVER_COLORS[overKind];
  const fill = over
    ? `conic-gradient(${overColor} ${over * 3.6}deg, ${colorVar} 0deg)`
    : `conic-gradient(${colorVar} ${clamped * 3.6}deg, var(--line) 0deg)`;
  const cap = over
    ? `<span aria-hidden="true" style="position:absolute;inset:0;transform:rotate(${over * 3.6}deg);pointer-events:none;"><i style="position:absolute;top:-1px;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:${overColor};box-shadow:0 0 0 1.5px var(--paper-raised);"></i></span>`
    : '';
  return `
    <div${over ? ` title="${Math.round(raw - 100)}% over"` : ''} style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${fill};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <div style="width:${size - 12}px;height:${size - 12}px;border-radius:50%;background:var(--paper-raised);display:flex;flex-direction:column;align-items:center;justify-content:center;">
        ${centerHtml}
      </div>
      ${cap}
    </div>
  `;
}
let glanceFastTickInterval = null;
let nutriFastTickInterval = null;

async function renderTodayGlance(){
  const grid = document.getElementById('glanceGridTop');
  if(!grid) return;
  clearInterval(glanceFastTickInterval);

  updateTodayClock();
  const quoteEl = document.getElementById('glanceQuote');
  if(quoteEl) quoteEl.textContent = '“' + SESSION_QUOTE + '”';

  const today = dateStrForOffset(0);
  const nutriEntry = nutritionLog.find(e => e.date === today);
  let dayRes = {entries: [], totals: {}};
  try{
    const res = await fetch(`api/meals.php?action=day&date=${today}`, {credentials: 'same-origin'});
    dayRes = await res.json();
  }catch(e){}
  const mealTotals = dayRes.totals || {};
  const combined = {
    calories: (nutriEntry ? parseNum(nutriEntry.calories) || 0 : 0) + (mealTotals.ENERC_KCAL || 0),
    protein: (nutriEntry ? parseNum(nutriEntry.protein) || 0 : 0) + (mealTotals.PROCNT || 0),
    fat: (nutriEntry ? parseNum(nutriEntry.fat) || 0 : 0) + (mealTotals.FAT || 0),
    carbs: (nutriEntry ? parseNum(nutriEntry.carbs) || 0 : 0) + (mealTotals.CHOCDF || 0)
  };
  const hasFoodToday = !!nutriEntry || (dayRes.entries || []).some(e => e.components.length);

  const t = getTargets(today);
  const calTarget = (userHealthTargets && userHealthTargets.calorieTarget) || t.calMax;
  const proteinTarget = (userHealthTargets && userHealthTargets.proteinTarget) || t.proteinMax;
  const fatTarget = t.fatMax;
  const carbsTarget = t.carbsMax;
  const waterTarget = (userHealthTargets && userHealthTargets.waterGoalMl) || 2500;
  const waterMl = waterLog[today] || 0;
  const fmtL = ml => (ml / 1000).toFixed(2).replace(/\.?0+$/, '') || '0';

  const sortedWeighs = [...weighIns].sort((a,b)=> a.date < b.date ? -1 : 1);
  const latestW = sortedWeighs.length ? sortedWeighs[sortedWeighs.length - 1] : null;
  const prevW = sortedWeighs.length > 1 ? sortedWeighs[sortedWeighs.length - 2] : null;
  const weightDelta = (latestW && prevW) ? (latestW.kg - prevW.kg) : null;

  const todayIdx = new Date().getDay();
  const scheduledPlanToday = scheduledPlanFor(todayIdx, today);
  const loggedToday = historyLog.filter(e => e.date === today);
  const realLoggedToday = loggedToday.filter(isRealSessionEntry);
  // "Done" just means something real was actually logged today, whether or
  // not it was scheduled -- Open-mode days have no scheduledPlanToday at
  // all, so gating on that alone left them stuck showing "not done" even
  // after logging a custom plan or manual exercise.
  const exerciseDone = realLoggedToday.length > 0;
  const todayPlanState = dayPlanState(today);
  const planLabel = scheduledPlanToday ? scheduledPlanToday.name : (loggedToday.length ? loggedToday[0].label : todayPlanState.label);

  const caloriesBurned = historyLog.filter(e => e.date === today)
    .reduce((sum,e)=> sum + (e.stats && e.stats.calories ? parseNum(e.stats.calories) || 0 : 0), 0);
  const calorieBurnTarget = (userProfile && userProfile.calorieBurnGoal) || 400;
  const sleepGoalHours = (userProfile && userProfile.sleepGoalHours) || 8;

  const sleepEntry = sleepLog[today] || null;
  const fmtClock = iso => new Date(iso).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  const stepsToday = stepsLog[today] || 0;
  const stepsTarget = (userHealthTargets && userHealthTargets.stepsGoal) || 10000;

  // Workout tile: always an icon + title + one line, whatever the day is.
  const planEmoji = /cardio|run|walk|cycl|swim|row/i.test(planLabel) ? activityEmoji(planLabel, 'cardio') : activityEmoji(planLabel, 'strength');
  const workoutTile = (scheduledPlanToday || realLoggedToday.length)
    ? {icon: exerciseDone ? '✅' : planEmoji, title: planLabel, sub: exerciseDone ? 'Completed' : 'Not done yet', done: exerciseDone}
    : todayPlanState.state === 'rest' ? {icon: '😴', title: 'Rest day', sub: 'Recharge — nothing planned', done: false}
    : todayPlanState.state === 'other' ? {icon: '📝', title: todayPlanState.label, sub: 'Planned for today', done: false}
    : {icon: '🧭', title: 'Open', sub: 'Nothing planned — log what you do', done: false};
  const intake = intakeInsight(combined.calories, calTarget);
  grid.innerHTML = `
    <div class="glance-card" data-nav-view="body" style="cursor:pointer;">
      <div class="glance-card-head"><span class="glance-card-label">\u{1F4E6} Weight</span></div>
      <div class="glance-card-value">${latestW ? formatWeightKg(latestW.kg) : '—'}</div>
      ${weightDelta !== null
        ? `<div class="glance-card-sub" style="color:${weightDelta<=0?'var(--forest-dark)':'#B4472A'};">${weightDelta<=0?'▼':'▲'} ${formatWeightKg(Math.abs(weightDelta))}</div>`
        : `<div class="glance-card-sub">${latestW ? 'First weigh-in logged' : 'No weigh-ins yet'}</div>`}
      <div class="glance-card-sub">${latestW ? 'Last: ' + formatWeightKg(latestW.kg) + ' (' + formatDateLabel(latestW.date) + ')' : ''}</div>
    </div>
    <div class="glance-card open-fasting-screen-link" style="cursor:pointer;">
      <div class="glance-card-head"><span class="glance-card-label">⏱ Fasting</span></div>
      <div class="glance-card-value" id="glanceFastValue">—</div>
      ${glanceBarHtml(0, 'var(--forest)', 'good', 'glanceFastBar')}
      <div class="glance-card-sub" id="glanceFastSub">Goal: ${fastingState.goalHours || 16} hours</div>
    </div>
    <div class="glance-card" data-nav-view="food" style="cursor:pointer;">
      <div class="glance-card-head"><span class="glance-card-label">\u{1F37D} Food Intake</span></div>
      <div class="glance-card-value">${fmtNum(combined.calories)} kcal</div>
      ${glanceBarHtml(calTarget ? combined.calories/calTarget*100 : 0, 'var(--ochre)', 'bad')}
      <div class="glance-card-sub">Target: ${fmtNum(calTarget)} kcal</div>
      ${intake ? `<div class="glance-insight" style="color:${intake.color};"><span class="glance-insight-icon">${intake.icon}</span><div><strong>${foodSearchEscape(intake.headline)}</strong><div class="glance-card-sub">${foodSearchEscape(intake.comment)}</div></div></div>` : ''}
    </div>
    <div class="glance-card" data-nav-view="food" style="cursor:pointer;">
      <div class="glance-card-label" style="margin-bottom:4px;">\u{1F3AF} Macronutrients</div>
      <div style="display:flex;justify-content:space-around;">
        <div class="glance-ring-row">
          <div class="glance-card-sub" style="margin-bottom:2px;">Carbs</div>
          ${glanceRing(carbsTarget ? combined.carbs/carbsTarget*100 : 0, 'var(--ochre)', 64, `<div style="font-weight:700;font-size:13px;">${Math.round(combined.carbs)}g</div>`, 'bad')}
          <div class="glance-card-sub" style="margin-top:2px;">/ ${carbsTarget}g</div>
        </div>
        <div class="glance-ring-row">
          <div class="glance-card-sub" style="margin-bottom:2px;">Protein</div>
          ${glanceRing(proteinTarget ? combined.protein/proteinTarget*100 : 0, 'var(--forest)', 64, `<div style="font-weight:700;font-size:13px;">${Math.round(combined.protein)}g</div>`, 'good')}
          <div class="glance-card-sub" style="margin-top:2px;">/ ${proteinTarget}g</div>
        </div>
        <div class="glance-ring-row">
          <div class="glance-card-sub" style="margin-bottom:2px;">Fat</div>
          ${glanceRing(fatTarget ? combined.fat/fatTarget*100 : 0, '#B4472A', 64, `<div style="font-weight:700;font-size:13px;">${Math.round(combined.fat)}g</div>`, 'bad')}
          <div class="glance-card-sub" style="margin-top:2px;">/ ${fatTarget}g</div>
        </div>
      </div>
    </div>
  `;

  const updateGlanceFast = ()=>{
    const valEl = document.getElementById('glanceFastValue');
    const barEl = document.getElementById('glanceFastBar');
    const subEl = document.getElementById('glanceFastSub');
    if(!valEl) return;
    const lastFast = nutriEntry && nutriEntry.fastHours ? parseNum(nutriEntry.fastHours) : null;
    const info = fastingSummaryText(lastFast);
    valEl.textContent = info.value;
    applyBarFill(barEl, info.rawPct !== undefined ? info.rawPct : info.pct, 'var(--forest)', 'good');
    subEl.textContent = info.sub;
  };

  const midGrid = document.getElementById('glanceGridMid');
  midGrid.innerHTML = `
    <div class="glance-card open-water-screen-link" style="cursor:pointer;">
      <div class="glance-card-head">
        <span class="glance-card-label">\u{1F4A7} Water</span>
        <div style="display:flex;gap:5px;">
          <button class="glance-water-btn" id="glanceWaterMinus" type="button" ${waterMl<=0?'disabled':''}>−</button>
          <button class="glance-water-btn" id="glanceWaterPlus" type="button">+</button>
        </div>
      </div>
      <div class="glance-card-value">${fmtL(waterMl)} L</div>
      ${glanceBarHtml(waterTarget ? waterMl/waterTarget*100 : 0, '#4A90D9', 'good')}
      <div class="glance-card-sub">Target: ${(waterTarget/1000).toFixed(1)} L · +/− adds a glass (250ml)</div>
    </div>
    <div class="glance-card" data-nav-view="train" style="cursor:pointer;">
      <div class="glance-card-head"><span class="glance-card-label">\u{1F3C3} Workout</span></div>
      <div style="background:${workoutTile.done ? 'rgba(47,111,78,0.12)' : 'var(--paper)'};border:1px solid ${workoutTile.done ? 'var(--forest)' : 'var(--line)'};border-radius:8px;padding:10px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:22px;line-height:1;">${workoutTile.icon}</span>
        <div>
          <div style="font-weight:700;font-size:13px;">${foodSearchEscape(workoutTile.title)}</div>
          <div class="glance-card-sub">${foodSearchEscape(workoutTile.sub)}</div>
        </div>
      </div>
    </div>
    <div class="glance-card" data-nav-view="train" style="align-items:center;cursor:pointer;">
      <div class="glance-card-label" style="align-self:flex-start;">\u{1F525} Calories Burned</div>
      ${glanceRing(calorieBurnTarget ? caloriesBurned/calorieBurnTarget*100 : 0, '#B4472A', 84, `<div style="font-family:var(--font-heading);font-size:20px;">${fmtNum(caloriesBurned)}</div><div style="font-size:9.5px;color:var(--ink-soft);">kcal</div>`, 'good')}
      <div class="glance-card-sub">Target: ${fmtNum(calorieBurnTarget)} kcal</div>
    </div>
    <div class="glance-card open-sleep-screen-link" style="cursor:pointer;">
      <div class="glance-card-head"><span class="glance-card-label">\u{1F634} Sleep</span></div>
      ${sleepEntry ? `
        <div class="glance-card-value">${formatSleepHours(sleepEntry.hours)}</div>
        <div class="glance-card-sub">${sleepEntry.startIso && sleepEntry.endIso ? `${fmtClock(sleepEntry.startIso)} – ${fmtClock(sleepEntry.endIso)}` : 'Logged'}</div>
        <div class="glance-card-sub">Goal: ${sleepGoalHours}h${sleepEntry.hours >= sleepGoalHours ? ' ✓' : ''}</div>
      ` : `
        <div class="glance-card-value">—</div>
        <div class="glance-card-sub">Not logged yet</div>
        <div class="glance-card-sub">Goal: ${sleepGoalHours}h</div>
      `}
    </div>
    <div class="glance-card open-steps-screen-link" style="align-items:center;cursor:pointer;">
      <div class="glance-card-label" style="align-self:flex-start;">\u{1F463} Steps</div>
      ${glanceRing(stepsTarget ? stepsToday/stepsTarget*100 : 0, '#4A90D9', 84, `<div style="font-family:var(--font-heading);font-size:18px;">${fmtNum(stepsToday)}</div><div style="font-size:9.5px;color:var(--ink-soft);">steps</div>`, 'good')}
      <div class="glance-card-sub">Target: ${fmtNum(stepsTarget)}</div>
    </div>
  `;
  document.getElementById('glanceWaterPlus').addEventListener('click', ()=> addWaterMl(250));
  document.getElementById('glanceWaterMinus').addEventListener('click', ()=> addWaterMl(-250));

  const qaGrid = document.getElementById('quickActionsGrid');
  qaGrid.innerHTML = `
    <button class="qa-tile" data-qa="food" type="button"><span class="qa-tile-icon">\u{1F37D}</span><span class="qa-tile-title">Log Food</span><span class="qa-tile-sub">Track your meals and nutrients</span></button>
    <button class="qa-tile" data-qa="weight" type="button"><span class="qa-tile-icon">\u{1F4CB}</span><span class="qa-tile-title">Log Weight</span><span class="qa-tile-sub">Update your weight today</span></button>
    <button class="qa-tile" data-qa="workout" type="button"><span class="qa-tile-icon">\u{1F3C3}</span><span class="qa-tile-title">Start Workout</span><span class="qa-tile-sub">Follow your plan or log activity</span></button>
    <button class="qa-tile" data-qa="about" type="button"><span class="qa-tile-icon">\u{1F464}</span><span class="qa-tile-title">About Me</span><span class="qa-tile-sub">Update your profile and health info</span></button>
    <button class="qa-tile" data-qa="goals" type="button"><span class="qa-tile-icon">\u{1F3AF}</span><span class="qa-tile-title">My Goals</span><span class="qa-tile-sub">Set and track your goals</span></button>
  `;
  qaGrid.querySelectorAll('[data-qa]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const kind = btn.dataset.qa;
      if(kind === 'food'){ window.openLogMealScreen(); }
      else if(kind === 'weight'){
        window.showView('body');
        setTimeout(()=>{ const el=document.getElementById('weighInKg'); if(el){ if(el.scrollIntoView) el.scrollIntoView({behavior:'smooth', block:'center'}); el.focus(); } }, 80);
      }
      else if(kind === 'workout'){ window.showView('train'); setTimeout(scrollToWorkout, 80); }
      else if(kind === 'about'){ window.showView('account'); window.showAccountView('snapshot'); }
      else if(kind === 'goals'){ window.showView('account'); window.showAccountView('goals'); }
    });
  });

  const viewDetailsLink = document.getElementById('glanceViewDetails');
  if(viewDetailsLink && !viewDetailsLink._wired){
    viewDetailsLink._wired = true;
    viewDetailsLink.addEventListener('click', (e)=>{ e.preventDefault(); window.showView('insights'); });
  }

  updateGlanceFast();
  if(fastingState.startIso){
    glanceFastTickInterval = setInterval(updateGlanceFast, 1000);
  }
}

let userProfile = null; // {gender, age, heightCm, goalWeightKg, activityLevel}
let userHealthTargets = null; // computed by computeHealthTargets()

async function loadProfile(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'profile', false);
    userProfile = res && res.value ? JSON.parse(res.value) : null;
  }catch(e){ userProfile = null; }
  updateWeightGoalsFromProfile();
  recomputeHealthTargets();
}
async function saveProfile(profile){
  userProfile = profile;
  try{ await window.storage.set(STORAGE_PREFIX + 'profile', JSON.stringify(profile), false); }catch(e){}
  updateWeightGoalsFromProfile();
  recomputeHealthTargets();
}
function updateWeightGoalsFromProfile(){
  if(userProfile && userProfile.goalWeightKg){
    GOAL_WEIGHT = userProfile.goalWeightKg;
  }
}
function currentWeightKg(){
  if(!weighIns.length) return userProfile && userProfile.currentWeightKg ? userProfile.currentWeightKg : null;
  const sorted = [...weighIns].sort((a,b)=> a.date < b.date ? -1 : 1);
  return sorted[sorted.length - 1].kg;
}
function computeHealthTargets(profile, weightKg){
  if(!profile || !profile.heightCm || !profile.age || !weightKg) return null;
  const heightM = profile.heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let bmiCategory;
  if(bmi < 18.5) bmiCategory = 'Underweight';
  else if(bmi < 25) bmiCategory = 'Normal';
  else if(bmi < 30) bmiCategory = 'Overweight';
  else bmiCategory = 'Obese';

  let bmr;
  if(profile.gender === 'male') bmr = 10*weightKg + 6.25*profile.heightCm - 5*profile.age + 5;
  else if(profile.gender === 'female') bmr = 10*weightKg + 6.25*profile.heightCm - 5*profile.age - 161;
  else bmr = 10*weightKg + 6.25*profile.heightCm - 5*profile.age - 78;

  const activityMultipliers = {sedentary:1.2, light:1.375, moderate:1.55, active:1.725};
  const multiplier = activityMultipliers[profile.activityLevel] || 1.375;
  const tdee = bmr * multiplier;

  const goalWeight = profile.goalWeightKg || weightKg;
  let recommendedCalorieTarget = tdee, goalDirection = 'maintain';
  if(goalWeight < weightKg - 0.5){ recommendedCalorieTarget = tdee - 500; goalDirection = 'lose'; }
  else if(goalWeight > weightKg + 0.5){ recommendedCalorieTarget = tdee + 300; goalDirection = 'gain'; }
  recommendedCalorieTarget = Math.max(1200, recommendedCalorieTarget);
  const recommendedProteinTarget = Math.round(weightKg * 1.8);

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goalDirection,
    recommendedCalorieTarget: Math.round(recommendedCalorieTarget),
    recommendedProteinTarget,
    // "Your target" overrides from the Goals screen, falling back to the recommended number
    calorieTarget: Math.round(profile.customCalorieTarget || recommendedCalorieTarget),
    proteinTarget: Math.round(profile.customProteinTarget || recommendedProteinTarget),
    stepsGoal: profile.stepsGoal || 10000,
    waterGoalMl: profile.waterGoalMl || Math.round(weightKg * 35)
  };
}
function recomputeHealthTargets(){
  userHealthTargets = computeHealthTargets(userProfile, currentWeightKg());
  updateTargetsFromProfile();
}

async function loadWeighIns(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'weighins', false);
    weighIns = res ? JSON.parse(res.value) : [];
  }catch(e){ weighIns = []; }
}
async function saveWeighIns(){
  try{ await window.storage.set(STORAGE_PREFIX + 'weighins', JSON.stringify(weighIns), false); }catch(e){}
}
function addWeighIn(dateStr, kg){
  weighIns = weighIns.filter(w => w.date !== dateStr);
  weighIns.push({date: dateStr, kg: kg});
  weighIns.sort((a,b)=> a.date < b.date ? -1 : 1);
  saveWeighIns();
  recomputeHealthTargets();
}
function removeWeighIn(dateStr){
  weighIns = weighIns.filter(w => w.date !== dateStr);
  saveWeighIns();
}

async function loadHistory(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'history', false);
    historyLog = res ? JSON.parse(res.value) : [];
  }catch(e){ historyLog = []; }
}
async function saveHistory(){
  try{ await window.storage.set(STORAGE_PREFIX + 'history', JSON.stringify(historyLog), false); }catch(e){}
}

function upsertSessionLog(dateStr, dayId, exercisesSnapshot, notes, stats, labelOverride){
  const existing = historyLog.find(e => e.date === dateStr && e.day === dayId);
  const finalNotes = notes !== undefined ? notes : (existing ? existing.notes : '');
  const finalStats = stats !== undefined ? stats : (existing ? existing.stats : null);
  historyLog = historyLog.filter(e => !(e.date === dateStr && e.day === dayId));
  historyLog.push({
    date: dateStr,
    day: dayId,
    label: labelOverride || tabLabels[dayId] || 'Custom / Deviation',
    exercises: exercisesSnapshot,
    notes: finalNotes || '',
    stats: finalStats || null,
    loggedAt: new Date().toISOString()
  });
  historyLog.sort((a,b)=> a.date < b.date ? 1 : -1);
  saveHistory();
}
function removeSessionLog(dateStr, dayId){
  historyLog = historyLog.filter(e => !(e.date === dateStr && e.day === dayId));
  saveHistory();
}
function logCustomEntry(dateStr, notes){
  historyLog.push({
    date: dateStr,
    day: 'custom',
    label: 'Custom / Deviation',
    exercises: [],
    notes: notes || '',
    loggedAt: new Date().toISOString()
  });
  historyLog.sort((a,b)=> a.date < b.date ? 1 : -1);
  saveHistory();
}

function exportLogCSV(){
  let rows = [['Date','Day Type','Exercise','Weight (kg)','Distance (km)','Duration','Calories','Avg HR','Avg Pace','Steps','Notes','Logged At']];
  historyLog.forEach(entry=>{
    const s = entry.stats || {};
    if(entry.exercises && entry.exercises.length){
      entry.exercises.forEach((ex, i)=>{
        rows.push([entry.date, entry.label, ex.name, ex.weight || '',
          i===0 ? (s.distance||'') : '', i===0 ? (s.duration||'') : '', i===0 ? (s.calories||'') : '',
          i===0 ? (s.hr||'') : '', i===0 ? (s.pace||'') : '', i===0 ? (s.steps||'') : '',
          i === 0 ? (entry.notes || '') : '', entry.loggedAt]);
      });
    } else {
      rows.push([entry.date, entry.label, '', '',
        s.distance||'', s.duration||'', s.calories||'', s.hr||'', s.pace||'', s.steps||'',
        entry.notes || '', entry.loggedAt]);
    }
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'strength-and-miles-log.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

async function loadState(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'checked', false);
    checkedState = res ? JSON.parse(res.value) : {};
  }catch(e){ checkedState = {}; }
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'weights', false);
    window.savedWeights = res ? JSON.parse(res.value) : {};
  }catch(e){ window.savedWeights = {}; }
}

async function saveChecked(){
  try{ await window.storage.set(STORAGE_PREFIX + 'checked', JSON.stringify(checkedState), false); }catch(e){}
}
async function saveWeights(){
  try{ await window.storage.set(STORAGE_PREFIX + 'weights', JSON.stringify(window.savedWeights || {}), false); }catch(e){}
}

function markSessionDone(dateStr, tabId){
  checkedState[dateStr + '_' + tabId + '_done'] = true;
  saveChecked();
  renderTally();
  renderDashboard();
      renderHistory();
  renderWeekPlan();
}

// Generic, sensible defaults for anyone who hasn't set up a health profile yet.
// Once a profile exists, updateTargetsFromProfile() overwrites these with
// numbers computed from that person's own weight/height/age/activity/goal —
// these are deliberately NOT tuned to any one person's diet.
let TARGETS = {
  workout:   {calMin:1900, calMax:2200, proteinMin:110, proteinMax:160, fatMin:50, fatMax:90, carbsMax:180, sodiumMax:2300, fiberTarget:30, sugarMax:50},
  sedentary: {calMin:1600, calMax:1900, proteinMin:90,  proteinMax:140, fatMin:45, fatMax:80, carbsMax:180, sodiumMax:2300, fiberTarget:30, sugarMax:50}
};
function isWorkoutDay(dateStr){
  return historyLog.some(e => e.date === dateStr && isRealSessionEntry(e));
}
function getTargets(dateStr){
  return isWorkoutDay(dateStr) ? TARGETS.workout : TARGETS.sedentary;
}
// Reference "floor" numbers used for chart lines and simple pass/fail checks — workout-day numbers (the higher bar)
let CAL_TARGET_MIN = TARGETS.workout.calMin;
let PROTEIN_TARGET_MIN = TARGETS.workout.proteinMin;

function updateTargetsFromProfile(){
  if(!userHealthTargets) return;
  const profile = userProfile || {};
  const cal = userHealthTargets.calorieTarget;
  const protein = userHealthTargets.proteinTarget;
  const fatCals = cal * 0.3;
  const sodium = profile.customSodiumTarget || 2300;
  const fiber = profile.customFiberTarget || 30;
  const sugar = profile.customSugarTarget || 50;
  // A custom carb/fat target (manual, or filled in from a diet-style preset on the
  // Goals page) applies to both day types alike -- only the min band scales down
  // for a "less to hit" feel, rather than asking for four separate numbers.
  const workoutFatMax = profile.customFatTarget || Math.round(fatCals * 1.2 / 9);
  const workoutFatMin = profile.customFatTarget ? Math.round(profile.customFatTarget * 0.8) : Math.round(fatCals * 0.7 / 9);
  const sedentaryFatMax = profile.customFatTarget || Math.round(fatCals * 1.0 / 9);
  const sedentaryFatMin = profile.customFatTarget ? Math.round(profile.customFatTarget * 0.8) : Math.round(fatCals * 0.6 / 9);
  const workoutCarbsMax = profile.customCarbTarget || 180;
  const sedentaryCarbsMax = profile.customCarbTarget || 150;
  TARGETS = {
    workout: {
      calMin: cal, calMax: cal + 250,
      proteinMin: protein, proteinMax: protein + 20,
      fatMin: workoutFatMin, fatMax: workoutFatMax,
      carbsMax: workoutCarbsMax,
      sodiumMax: sodium, fiberTarget: fiber, sugarMax: sugar
    },
    sedentary: {
      calMin: Math.max(1200, cal - 300), calMax: cal,
      proteinMin: Math.max(60, protein - 20), proteinMax: protein,
      fatMin: sedentaryFatMin, fatMax: sedentaryFatMax,
      carbsMax: sedentaryCarbsMax,
      sodiumMax: sodium, fiberTarget: fiber, sugarMax: sugar
    }
  };
  CAL_TARGET_MIN = TARGETS.workout.calMin;
  PROTEIN_TARGET_MIN = TARGETS.workout.proteinMin;
}

// Illustrative macro splits (% of daily energy) for common eating styles, offered as an
// editable starting point on the Goals page -- not medical prescriptions. carbsPct/proteinPct/
// fatPct null means "no inherent split" (Open/Custom): leave whatever's already in the fields.
const DIET_PRESETS = {
  open:          {label: 'No specific diet', carbsPct: null, proteinPct: null, fatPct: null, note: 'No macro split is assigned automatically. Set your own targets below if you’d like, or leave them at the general recommendation.'},
  balanced:      {label: 'Balanced', carbsPct: 0.45, proteinPct: 0.25, fatPct: 0.30, note: 'A flexible starting point: 45% carbs / 25% protein / 30% fat of your daily energy. Illustrative default, not a medical prescription -- adjust below as you like.'},
  lowcarb:       {label: 'Low-Carb', carbsPct: 0.25, proteinPct: 0.35, fatPct: 0.40, note: 'Fewer carbs, more protein and fat: 25% / 35% / 40%. Low-carb definitions vary -- this is one example, not a universal threshold.'},
  keto:          {label: 'Keto', carbsPct: 0.05, proteinPct: 0.25, fatPct: 0.70, note: 'Very low-carb, high-fat: 5% / 25% / 70%. A percentage split alone doesn’t guarantee ketosis.'},
  highprotein:   {label: 'High-Protein', carbsPct: 0.35, proteinPct: 0.35, fatPct: 0.30, note: 'Protein-forward: 35% / 35% / 30%. Protein needs vary by person -- not a universal target.'},
  mediterranean: {label: 'Mediterranean', carbsPct: 0.45, proteinPct: 0.20, fatPct: 0.35, note: 'Vegetables, legumes, whole grains, olive oil, nuts and fish: 45% / 20% / 35%. Food choices define this style more than the macro split does.'},
  vegetarian:    {label: 'Vegetarian', carbsPct: 0.50, proteinPct: 0.20, fatPct: 0.30, note: 'Plant-forward, eggs and dairy optional: 50% / 20% / 30%, an authored example -- macros vary widely in practice.'},
  vegan:         {label: 'Vegan', carbsPct: 0.50, proteinPct: 0.20, fatPct: 0.30, note: 'Plant foods only, no animal-derived ingredients: 50% / 20% / 30%, an authored example.'},
  custom:        {label: 'Custom split', carbsPct: null, proteinPct: null, fatPct: null, note: 'Set your own protein, carb, and fat targets below -- nothing is filled in for you.'}
};
function renderDietPresetNote(key){
  const el = document.getElementById('goalDietPresetNote');
  if(!el) return;
  const preset = DIET_PRESETS[key] || DIET_PRESETS.open;
  el.textContent = preset.note;
}
// Fills Protein/Carbs/Fat fields from the preset's % split x the current calorie target --
// only on an explicit style change (never silently on page render), matching "preview the
// example, require acceptance or customization" rather than overwriting a manual entry.
function applyDietPreset(key){
  renderDietPresetNote(key);
  const preset = DIET_PRESETS[key] || DIET_PRESETS.open;
  if(preset.carbsPct == null) return;
  const calEl = document.getElementById('goalEnergyCustom');
  const cal = parseNum(calEl.value) || (userHealthTargets ? userHealthTargets.recommendedCalorieTarget : 2000);
  document.getElementById('goalProteinCustom').value = Math.round(cal * preset.proteinPct / 4);
  document.getElementById('goalCarbsCustom').value = Math.round(cal * preset.carbsPct / 4);
  document.getElementById('goalFatCustom').value = Math.round(cal * preset.fatPct / 9);
}

function macroBarRow(label, value, min, max, unit, mode){
  const scaleMax = mode === 'ceiling' ? max * 2 : max * 1.3;
  const zoneLeftPct = mode === 'ceiling' ? 0 : (min / scaleMax * 100);
  const zoneWidthPct = mode === 'ceiling' ? (max / scaleMax * 100) : ((max - min) / scaleMax * 100);
  const fillPct = Math.min(100, (value / scaleMax) * 100);
  // Range mode (calories/protein/fat) has three states: under the floor
  // (orange -- still room to go), inside the healthy range (green), or past
  // the ceiling (red). Ceiling-only macros (carbs/sodium/sugar) have no
  // floor, so they're just under (green) or over (red).
  const state = mode === 'ceiling'
    ? (value <= max ? 'met' : 'over')
    : (value < min ? 'under' : (value <= max ? 'met' : 'over'));
  const fillColor = state === 'met' ? 'var(--forest)' : (state === 'under' ? 'var(--ochre)' : '#B4472A');
  const textColor = state === 'met' ? 'var(--forest-dark)' : (state === 'under' ? 'var(--ochre)' : '#B4472A');
  const rangeLabel = mode === 'ceiling' ? `under ${fmtNum(max)}${unit}` : `${fmtNum(min)}-${fmtNum(max)}${unit}`;
  // Round for display -- summed floats (e.g. 29.2 + 0.4) can otherwise print as 29.599999999999998.
  const displayValue = Math.round(value * 10) / 10;
  return `
    <div class="macro-target-row">
      <div class="macro-target-label">
        <span>${label}</span>
        <span style="font-weight:600;color:${textColor};">${fmtNumMax(displayValue)}${unit} <span style="color:var(--ink-soft);font-weight:400;">/ ${rangeLabel}</span></span>
      </div>
      <div class="macro-target-track">
        <div class="macro-target-zone" style="left:${zoneLeftPct}%;width:${zoneWidthPct}%;"></div>
        <div class="macro-target-fill" style="width:${fillPct}%;background:${fillColor};"></div>
      </div>
    </div>
  `;
}

// Compact one-line stat chip (value / target), for secondary macros where a full
// progress bar per nutrient (as macroBarRow draws) would take up too much space.
function macroChip(label, value, target, unit, mode){
  const displayValue = Math.round(value * 10) / 10;
  // Ceiling (sodium/sugar): green under target, red over -- no floor to be
  // "under". Floor (fiber): orange while still short of target, green once met.
  const met = mode === 'ceiling' ? value <= target : value >= target;
  const color = met ? 'var(--forest-dark)' : (mode === 'ceiling' ? '#B4472A' : 'var(--ochre)');
  return `
    <div style="flex:1;background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:6px 4px;text-align:center;">
      <div style="font-size:9.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;">${label}</div>
      <div style="font-size:12px;font-weight:600;color:${color};">${fmtNumMax(displayValue)}<span style="font-weight:400;color:var(--ink-soft);">/${fmtNum(target)}${unit}</span></div>
    </div>
  `;
}

// Short, plain-language guidance notes based on how a day's totals compare
// to that day's targets -- e.g. flagging high sodium/sugar/carbs, low
// protein/fiber, or calories outside the target range, with a brief
// suggestion of what to do about it. sodium/fiber/sugar checks are skipped
// entirely when hasItemized is false, since those totals only ever come
// from itemized food-search logging (see combinedDayTotals) -- a plain
// day-log entry with no items would otherwise look like "0 sodium", which
// is "not tracked" rather than a genuine zero.
function buildNutritionNotes(vals, t, hasItemized){
  const notes = [];
  if(vals.cal > t.calMax){
    notes.push({icon: '⚠️', text: `Calories are ${fmtNum(vals.cal - t.calMax)} kcal over today's ceiling — fine occasionally, but worth watching if it becomes a pattern.`});
  } else if(vals.cal < t.calMin){
    notes.push({icon: 'ℹ️', text: `Calories are under today's target — make sure you're eating enough to fuel the day.`});
  }
  if(vals.protein < t.proteinMin){
    notes.push({icon: 'ℹ️', text: `Protein is under target — a protein-rich snack (eggs, chicken, tofu, dairy) would help close the gap.`});
  }
  if(vals.fat > t.fatMax){
    notes.push({icon: '⚠️', text: `Fat is above target (${Math.round(vals.fat)}g vs ${t.fatMax}g) — consider leaner protein or less added oil for your next meal.`});
  }
  if(vals.carbs > t.carbsMax){
    notes.push({icon: '⚠️', text: `Carbs are above today's ceiling (${Math.round(vals.carbs)}g vs under ${t.carbsMax}g) — watch portions of rice, bread, or sugary drinks for the rest of the day.`});
  }
  if(hasItemized){
    if(vals.sodium > t.sodiumMax){
      notes.push({icon: '⚠️', text: `Sodium is above today's limit (${fmtNum(vals.sodium)}mg vs ${fmtNum(t.sodiumMax)}mg) — go easy on processed, canned, or salty foods and drink extra water.`});
    }
    if(vals.sugar > t.sugarMax){
      notes.push({icon: '⚠️', text: `Sugar is above today's limit (${Math.round(vals.sugar)}g vs ${t.sugarMax}g) — sodas, desserts, and sweetened drinks are the usual culprits.`});
    }
    if(vals.fiber > 0 && vals.fiber < t.fiberTarget){
      notes.push({icon: 'ℹ️', text: `Fiber is under target (${Math.round(vals.fiber)}g vs ${t.fiberTarget}g) — more veggies, fruit, or whole grains would help.`});
    }
  }
  if(!notes.length){
    notes.push({icon: '✓', text: `Nothing to flag — today's numbers are within a healthy range.`});
  }
  return notes;
}

let foodSearchResultsCache = [];
let foodSearchGeneration = 0;
function foodDisplayName(row){
  const name=String(row.name || ''), local=String(row.local_name || '').trim();
  return local && local.toLocaleLowerCase()!==name.trim().toLocaleLowerCase() ? `${local} · ${name}` : name;
}
function foodSearchEscape(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Shared by both the food and workout-stats AI prompt-assist flows -- these
// used to be declared inside the Log Meal IIFE, which meant the stats
// version of "Copy prompt"/"Parse & fill in fields" (declared outside that
// IIFE) silently threw a ReferenceError and did nothing on click.
function parseLabeledReply(text, labels){
  const out = {};
  labels.forEach(label => {
    const re = new RegExp('(?:^|\\n)\\s*' + label.replace(/\s+/g,'\\s+') + '\\s*:\\s*([^\\n\\r]+)', 'i');
    const m = text.match(re);
    out[label] = m ? m[1].trim() : '';
  });
  return out;
}
function firstNumber(str){
  // Accepts thousands separators ("1,234 kcal" -> 1234) as well as plain and decimal numbers.
  const m = (str || '').match(/-?\d[\d,]*(?:\.\d+)?|-?\.\d+/);
  return m ? parseNum(m[0]) : NaN;
}
// True when the text pasted as "the AI's reply" is really the prompt we
// generated (or a chunk of it) -- an easy slip, since the prompt sits right
// above the reply box. Telltales: unfilled template placeholders such as
// "<number>", phrases only the prompt contains, or text that is a slice of it.
const PASTED_PROMPT_MESSAGE = "This looks like the prompt itself, not your AI's reply. Paste the prompt into your AI chat (ChatGPT, Gemini, etc.) first, then copy the answer it gives you and paste that here.";
function looksLikePastedPrompt(reply, promptText){
  const text = String(reply || '').trim();
  if(!text) return false;
  if(/<\s*(number|food name|estimated weight|km|hh:mm:ss|per km|short name)/i.test(text)) return true;
  if(/estimation assistant|reply with only/i.test(text)) return true;
  const squash = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const prompt = squash(promptText), body = squash(text);
  return !!prompt && body.length >= 40 && prompt.includes(body.slice(0, 80));
}
function copyTextToClipboard(text, btnEl){
  const done = ()=>{
    const original = btnEl.textContent;
    btnEl.textContent = 'Copied!';
    setTimeout(()=>{ btnEl.textContent = original; }, 1500);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>{
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch(e){}
      document.body.removeChild(ta);
      done();
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e){}
    document.body.removeChild(ta);
    done();
  }
}

