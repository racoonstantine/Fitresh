// ---------- Today's scheduled session (Workout Routine, legacy or custom) ----------
// Replaces manual day-tab switching: the Train page now always shows whatever
// the Training Plan (with today's override applied) says is scheduled, so
// there's nothing for the user to pick -- just what's actually planned.
// Which "Log a Session" option is active -- 'plan' (use/pick a Workout
// Routine), 'rest', 'manual' (free-form exercise entry) or 'ai' (AI Assist /
// watch stats). See log-session-panel.js.
let logSessionMode = 'plan';
// A routine picked one-off via "Select Workout Routine", separate from the
// Training Plan schedule -- nothing is saved until the user actually logs
// against it. On today it swaps the checklist below; on any other date it
// drives the "which did you do?" logger inside the panel.
let logSessionSelectedPlanId = null;

// The date the whole "Log a Session" / checklist / Logged Training section
// operates on -- follows the Workout Dashboard's Daily-view day nav
// (dashSelectedDate) instead of always being today.
function activeSessionDate(){ return dashSelectedDate || dateStrForOffset(0); }

// "Log a Session" is collapsed behind a button, like "Log a meal (full
// page)" on Food -- collapseLogSessionPanel() is also called when leaving
// the Train tab, so it's never left open (or pointed at a stale
// selection) when the user comes back.
function collapseLogSessionPanel(){
  const panel = document.getElementById('logSessionPanel');
  const btn = document.getElementById('logSessionToggleBtn');
  if(panel) panel.style.display = 'none';
  if(btn) btn.textContent = '+ Log a Session';
  logSessionMode = 'plan';
  logSessionSelectedPlanId = null;
  // Wipe the panel's fields too, so nothing typed lingers after a save or a
  // move to another tab.
  if(typeof resetLogSessionPanel === 'function') resetLogSessionPanel();
}
document.getElementById('logSessionToggleBtn').addEventListener('click', ()=>{
  const panel = document.getElementById('logSessionPanel');
  const btn = document.getElementById('logSessionToggleBtn');
  const showing = panel.style.display !== 'none';
  if(showing){
    collapseLogSessionPanel();
  } else {
    panel.style.display = 'block';
    btn.textContent = '− Log a Session';
    renderTodaysSession();
  }
});

function renderTodaysSession(){
  const dStr = activeSessionDate();
  const isToday = dStr === dateStrForOffset(0);
  const dayIdx = new Date(dStr + 'T00:00:00').getDay();
  const hasSchedule = !!(userTrainingPlan && userTrainingPlan.presetKey && userTrainingPlan.presetKey !== 'open');
  if(!renderTodaysSession._initialized){
    renderTodaysSession._initialized = true;
    if(hasSchedule){
      const seedEntry = effectiveDayEntry(dStr, dayIdx);
      logSessionMode = (seedEntry && seedEntry.type === 'rest') ? 'rest' : 'plan';
    }
  }
  renderLogSessionOptions(hasSchedule, dStr, isToday);

  const titleEl = document.getElementById('loggedTodayTitle');
  if(titleEl) titleEl.textContent = isToday ? 'Logged Training Today' : `Logged Training — ${formatDateLabel(dStr)}`;

  const heading = document.getElementById('sessionPlanHeading');
  const warmup = document.getElementById('warmupBlock');
  const strengthBlock = document.getElementById('strengthBlock');
  const cardioBlock = document.getElementById('cardioBlock');
  const customBlock = document.getElementById('customPlanBlock');
  const hideAllExerciseBlocks = ()=>{
    if(warmup) warmup.style.display = 'none';
    if(strengthBlock) strengthBlock.style.display = 'none';
    if(cardioBlock) cardioBlock.style.display = 'none';
    if(customBlock) customBlock.style.display = 'none';
  };

  if(!isToday){
    // Past/future day: the tick-to-complete checklist only ever applies to
    // today, so the panel's "Select Workout Routine" logs from a checklist
    // inside the panel, and actually editing that day's logged exercises
    // happens in "Logged Training" below, which supports any date.
    hideAllExerciseBlocks();
    if(heading){
      heading.style.display = '';
      const entry = hasSchedule ? effectiveDayEntry(dStr, dayIdx) : (userTrainingPlan && userTrainingPlan.presetKey === 'open' ? window.openModeDayEntry(dStr) : null);
      heading.textContent = `${formatDateLabel(dStr)}: ${entry ? window.planDayLabel(entry) : dayPlanState(dStr).label}`;
    }
    renderLoggedToday();
    return;
  }

  if(logSessionMode === 'rest'){
    if(heading){ heading.textContent = 'Rest day'; heading.style.display = ''; }
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }
  if(logSessionMode === 'manual' || logSessionMode === 'ai'){
    // These panels sit right under the option buttons -- a plan heading with
    // nothing below it just left a stray floating heading.
    if(heading) heading.style.display = 'none';
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }

  // logSessionMode === 'plan'
  if(heading) heading.style.display = '';
  let entry;
  if(logSessionSelectedPlanId){
    entry = {type: 'workoutPlan', planId: logSessionSelectedPlanId};
  } else if(hasSchedule){
    entry = effectiveDayEntry(dStr, dayIdx);
  } else {
    entry = null;
  }

  if(!entry || entry.type !== 'workoutPlan'){
    if(heading) heading.textContent = entry && entry.type === 'rest' ? "Today: Rest day" : (hasSchedule ? "No workout scheduled today" : "Pick a workout routine above to get started");
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }
  const plan = getWorkoutPlan(entry.planId);
  if(!plan){
    if(heading) heading.textContent = "Today's routine was removed";
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }

  if(heading) heading.textContent = "Today's Routine: " + plan.name;
  if(plan.kind === 'legacy'){
    if(customBlock) customBlock.style.display = 'none';
    if(warmup) warmup.style.display = 'block';
    setDay(plan.legacyKey);
  } else {
    if(warmup) warmup.style.display = 'block';
    if(strengthBlock) strengthBlock.style.display = 'none';
    if(cardioBlock) cardioBlock.style.display = 'none';
    if(customBlock) customBlock.style.display = 'block';
    renderCustomPlanSession(plan);
  }
  renderLoggedToday();
}

const GENERIC_EXERCISE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11M4 9l3-3M17 20l3-3M2 11l3.5-3.5M18.5 7.5L22 4M3 21l4-4M17 3l4 4"/><circle cx="6" cy="6" r="1.8"/><circle cx="18" cy="18" r="1.8"/></svg>`;
function customItemId(plan, idx){ return 'custom_' + plan.id + '_' + idx; }
let activeCustomPlan = null;
function renderCustomPlanSession(plan){
  activeCustomPlan = plan;
  document.getElementById('customPlanTitle').textContent = plan.name + ' · custom routine';
  const list = document.getElementById('customPlanList');
  list.innerHTML = '';
  (plan.items || []).forEach((item, idx)=>{
    const id = customItemId(plan, idx);
    const name = item.name || (window.workoutActivityName ? window.workoutActivityName(item.activityId) : item.activityId) || 'Exercise';
    const cue = (window.workoutActivityInstructions ? window.workoutActivityInstructions(item.activityId) : '') || 'No form notes yet for this exercise -- check "See example photos" below for proper technique.';
    const isDone = !!checkedState[id];
    const savedW = (window.savedWeights && window.savedWeights[id]) || '';
    const card = document.createElement('div');
    card.className = 'ex-card';
    card.innerHTML = `
      <div class="ex-head" data-id="${id}">
        <div class="ex-icon" style="display:flex;align-items:center;justify-content:center;color:var(--forest-dark);width:52px;height:52px;">${GENERIC_EXERCISE_ICON.replace('<svg ', '<svg style="width:28px;height:28px;" ')}</div>
        <div class="ex-info">
          <div class="ex-name">${foodSearchEscape(name)}</div>
          <div class="ex-scheme">${foodSearchEscape(item.target || '')}</div>
        </div>
        <svg class="caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        <button class="ex-check ${isDone?'done':''}" data-check="${id}">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
      </div>
      <div class="ex-detail" data-detail="${id}">
        <div class="ex-detail-inner">
          <div class="ex-icon-large" style="display:flex;align-items:center;justify-content:center;color:var(--forest-dark);">${GENERIC_EXERCISE_ICON.replace('<svg ', '<svg style="width:64px;height:64px;" ')}</div>
          <strong>Form cue:</strong> ${foodSearchEscape(cue)}
          <div>
            <a class="img-link" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name + ' proper form exercise')}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              See example photos
            </a>
          </div>
          <div class="weight-row">
            <label for="w-${id}">Weight used (kg):</label>
            <input type="text" inputmode="decimal" data-num id="w-${id}" data-weight="${id}" value="${savedW}" placeholder="e.g. 8" min="0" step="0.5">
          </div>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.ex-head').forEach(head=>{
    head.addEventListener('click', (e)=>{
      if(e.target.closest('[data-check]')) return;
      const id = head.dataset.id;
      const detail = list.querySelector(`[data-detail="${id}"]`);
      const open = detail.classList.toggle('open');
      head.classList.toggle('expanded', open);
    });
  });
  list.querySelectorAll('[data-check]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = btn.dataset.check;
      checkedState[id] = !checkedState[id];
      btn.classList.toggle('done', checkedState[id]);
      saveChecked();
    });
  });
  list.querySelectorAll('[data-weight]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      window.savedWeights = window.savedWeights || {};
      window.savedWeights[inp.dataset.weight] = inp.value;
      saveWeights();
    });
  });

  const dStr = dateStrForOffset(0);
  const dayId = 'plan:' + plan.id;
  const existing = historyLog.find(e => e.date === dStr && e.day === dayId);
  document.getElementById('customPlanLoggedNote').textContent = existing
    ? `Logged today at ${new Date(existing.loggedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} (${existing.exercises.length} exercise${existing.exercises.length===1?'':'s'})`
    : '';
  renderExtraExercises('custom');

  const customStats = existing ? existing.stats : null;
  const customStatsEl = document.getElementById('customPlanStatsBlock');
  customStatsEl.innerHTML = `
    ${customStats ? `
    <div class="cardio-row" style="border-bottom:none;flex-wrap:wrap;gap:6px 14px;padding-bottom:8px;">
      ${customStats.duration ? `<span style="font-size:12px;color:var(--ink-soft);">⏱ ${customStats.duration}</span>` : ''}
      ${customStats.calories ? `<span style="font-size:12px;color:var(--ink-soft);">🔥 ${fmtNum(customStats.calories)} kcal</span>` : ''}
      ${customStats.hr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ ${customStats.hr} bpm</span>` : ''}
      ${customStats.maxHr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ max ${customStats.maxHr} bpm</span>` : ''}
      ${customStats.trainingStress ? `<span style="font-size:12px;color:var(--ink-soft);">📈 TSS ${customStats.trainingStress}</span>` : ''}
      ${customStats.recoveryHr ? `<span style="font-size:12px;color:var(--ink-soft);">↘ HR recovery ${customStats.recoveryHr} bpm</span>` : ''}
    </div>` : ''}
    <button class="img-link" id="logCustomPlanStatsBtn" style="cursor:pointer;">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      ${customStats ? 'Edit watch stats' : 'Log stats from watch'}
    </button>
  `;
  document.getElementById('logCustomPlanStatsBtn').addEventListener('click', ()=> openStatsForm(dayId));
}
document.getElementById('customPlanCompleteLogBtn').addEventListener('click', ()=>{
  const plan = activeCustomPlan;
  if(!plan) return;
  const dStr = dateStrForOffset(0);
  const dayId = 'plan:' + plan.id;
  const doneItems = (plan.items || []).filter((item, idx)=> checkedState[customItemId(plan, idx)]);
  const snapshot = doneItems.map((item)=>{
    const idx = plan.items.indexOf(item);
    return {
      name: item.name || (window.workoutActivityName ? window.workoutActivityName(item.activityId) : item.activityId),
      weight: (window.savedWeights && window.savedWeights[customItemId(plan, idx)]) || ''
    };
  });
  const extraKey = extraExKey('custom');
  const extras = extraExercisesByPlanDay[extraKey] || [];
  snapshot.push(...extras);
  checkedState[dStr + '_' + dayId + '_done'] = snapshot.length > 0;
  saveChecked();
  upsertSessionLog(dStr, dayId, snapshot, undefined, undefined, plan.name);
  delete extraExercisesByPlanDay[extraKey];
  renderTally();
  renderDashboard();
  renderHistory();
  renderWeekPlan();
  renderCustomPlanSession(plan);
  renderLoggedToday();
  renderTodayGlance();
});
document.getElementById('strengthCompleteLogBtn').addEventListener('click', ()=>{
  const day = currentDay;
  if(!dayData[day]) return;
  const dStr = dateStrForOffset(0);
  const doneExercises = dayData[day].exercises.filter(ex=>checkedState[ex.id]).map(ex=>({
    name: ex.name,
    weight: (window.savedWeights && window.savedWeights[ex.id]) || ''
  }));
  const extraKey = extraExKey('strength');
  const extras = extraExercisesByPlanDay[extraKey] || [];
  doneExercises.push(...extras);
  checkedState[dStr + '_' + day + '_done'] = doneExercises.length > 0;
  saveChecked();
  upsertSessionLog(dStr, day, doneExercises);
  delete extraExercisesByPlanDay[extraKey];
  renderTally();
  renderDashboard();
  renderHistory();
  renderWeekPlan();
  renderStrength(day);
  renderLoggedToday();
  renderTodayGlance();
});

