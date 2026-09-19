// ---------- Shared "log stats from watch" form (used by both strength and cardio days) ----------
let activeStatsContext = null; // 'A'|'B'|'steady'|'interval' -- which session the shared form is currently editing
let activeStatsDate = null; // defaults to today; set when editing a past day's stats from History Log
// Hours/minutes/seconds dropdowns instead of a free-text "mm:ss" field --
// avoids unparseable/garbled input and supports workouts over an hour.
(function(){
  const h = document.getElementById('statDurationH'), m = document.getElementById('statDurationM'), s = document.getElementById('statDurationS');
  if(!h || !m || !s) return;
  h.innerHTML = Array.from({length: 24}, (_, i) => `<option value="${i}">${i}</option>`).join('');
  const pad2 = n => `<option value="${n}">${String(n).padStart(2,'0')}</option>`;
  m.innerHTML = Array.from({length: 60}, (_, i) => pad2(i)).join('');
  s.innerHTML = Array.from({length: 60}, (_, i) => pad2(i)).join('');
})();
function setDurationFields(durationStr){
  const parts = (durationStr || '').split(':').map(p => parseInt(p, 10)).filter(n => !isNaN(n));
  let hh = 0, mm = 0, ss = 0;
  if(parts.length === 3){ [hh, mm, ss] = parts; }
  else if(parts.length === 2){ [mm, ss] = parts; }
  document.getElementById('statDurationH').value = hh || 0;
  document.getElementById('statDurationM').value = mm || 0;
  document.getElementById('statDurationS').value = ss || 0;
}
function getDurationString(){
  const hh = parseInt(document.getElementById('statDurationH').value, 10) || 0;
  const mm = parseInt(document.getElementById('statDurationM').value, 10) || 0;
  const ss = parseInt(document.getElementById('statDurationS').value, 10) || 0;
  if(!hh && !mm && !ss) return '';
  return hh > 0 ? `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${mm}:${String(ss).padStart(2,'0')}`;
}
// Builds a plain-text summary of the workout the stats form is currently
// attached to, so the AI-assist prompt carries real workout details
// (exercise names, sets/reps/weight) instead of relying solely on
// whatever the user happens to type in the free-text description.
function currentWorkoutSummaryForStats(){
  const contextId = activeStatsContext;
  if(!contextId) return '';
  if(contextId === 'manual-pending'){
    return manualExPending.map(ex => exerciseSummaryText(ex)).join(', ');
  }
  if(dayData[contextId]){
    const done = dayData[contextId].exercises.filter(ex => checkedState[ex.id]).map(ex => {
      const w = (window.savedWeights && window.savedWeights[ex.id]) || '';
      return exerciseSummaryText({name: ex.name, weight: w});
    });
    return dayData[contextId].title + (done.length ? ': ' + done.join(', ') : '');
  }
  if(cardioData[contextId]) return cardioData[contextId].title;
  if(activeCustomPlan && contextId === 'plan:' + activeCustomPlan.id){
    const done = (activeCustomPlan.items || []).filter((item, idx) => checkedState[customItemId(activeCustomPlan, idx)]).map(item =>
      item.name || (window.workoutActivityName ? window.workoutActivityName(item.activityId) : item.activityId));
    return activeCustomPlan.name + (done.length ? ': ' + done.join(', ') : '');
  }
  return '';
}
function openStatsForm(contextId, dateOverride){
  activeStatsContext = contextId;
  activeStatsDate = dateOverride || dateStrForOffset(0);
  const existing = historyLog.find(e => e.date === activeStatsDate && e.day === contextId);
  const stats = existing ? existing.stats : (contextId === 'manual-pending' ? manualExPendingStats : null);
  document.getElementById('statDistance').value = stats ? (stats.distance || '') : '';
  setDurationFields(stats ? stats.duration : '');
  document.getElementById('statCalories').value = stats ? (stats.calories || '') : '';
  document.getElementById('statHR').value = stats ? (stats.hr || '') : '';
  document.getElementById('statPace').value = stats ? (stats.pace || '') : '';
  document.getElementById('statSteps').value = stats ? (stats.steps || '') : '';
  document.getElementById('statMaxHR').value = stats ? (stats.maxHr || '') : '';
  document.getElementById('statElevation').value = stats ? (stats.elevation || '') : '';
  document.getElementById('statTrainingStress').value = stats ? (stats.trainingStress || '') : '';
  document.getElementById('statRecoveryHr').value = stats ? (stats.recoveryHr || '') : '';
  const hz = (stats && stats.hrZones) || {};
  document.getElementById('statHrZoneWarmup').value = hz.warmup || '';
  document.getElementById('statHrZoneFatBurn').value = hz.fatBurn || '';
  document.getElementById('statHrZoneAerobic').value = hz.aerobic || '';
  document.getElementById('statHrZoneAnaerobic').value = hz.anaerobic || '';
  // Clear the AI prompt-assist round trip too, so a previous session's
  // generated prompt or pasted reply doesn't linger into this one.
  document.getElementById('aiStatsDesc').value = '';
  document.getElementById('aiStatsPromptOut').value = '';
  document.getElementById('aiStatsReplyIn').value = '';
  document.getElementById('aiStatsPromptWrap').style.display = 'none';
  document.getElementById('aiStatsParseError').style.display = 'none';
  document.getElementById('statsError').style.display = 'none';
  document.querySelector('[data-ai-detail="stats"]').style.display = 'none';
  const statsForm = document.getElementById('cardioStatsForm');
  statsForm.style.display = statsForm.style.display === 'none' ? 'block' : 'none';
  if(statsForm.style.display === 'block' && statsForm.scrollIntoView) statsForm.scrollIntoView({behavior:'smooth', block:'center'});
}
document.getElementById('saveStatsBtn').onclick = ()=>{
  const contextId = activeStatsContext;
  if(!contextId) return;
  const targetDate = activeStatsDate || dateStrForOffset(0);
  const isToday = targetDate === dateStrForOffset(0);
  const hrZones = {
    warmup: document.getElementById('statHrZoneWarmup').value,
    fatBurn: document.getElementById('statHrZoneFatBurn').value,
    aerobic: document.getElementById('statHrZoneAerobic').value,
    anaerobic: document.getElementById('statHrZoneAnaerobic').value
  };
  const newStats = {
    distance: document.getElementById('statDistance').value,
    duration: getDurationString(),
    calories: document.getElementById('statCalories').value,
    hr: document.getElementById('statHR').value,
    pace: document.getElementById('statPace').value,
    steps: document.getElementById('statSteps').value,
    maxHr: document.getElementById('statMaxHR').value,
    elevation: document.getElementById('statElevation').value,
    trainingStress: document.getElementById('statTrainingStress').value,
    recoveryHr: document.getElementById('statRecoveryHr').value,
    hrZones
  };
  const errEl = document.getElementById('statsError');
  errEl.style.display = 'none';
  const numericChecks = [
    ['Distance', newStats.distance, 0, 1000],
    ['Calories', newStats.calories, 0, 20000],
    ['Avg HR', newStats.hr, 20, 260],
    ['Steps', newStats.steps, 0, 200000],
    ['Max HR', newStats.maxHr, 20, 260],
    ['Elevation gain', newStats.elevation, 0, 20000],
    ['Training stress', newStats.trainingStress, 0, 1000],
    ['HR recovery drop', newStats.recoveryHr, 0, 260]
  ];
  for(const [label, value, min, max] of numericChecks){
    if(value === '' || value === null || value === undefined) continue;
    const n = parseNum(value);
    if(!Number.isFinite(n) || n < min || n > max){
      errEl.textContent = `${label} should be a number between ${min} and ${max} (or left blank).`;
      errEl.style.display = 'block';
      return;
    }
  }
  // Manual-exercise stats aren't tied to a saved history entry yet -- hold
  // them until "Save session" actually creates one.
  if(contextId === 'manual-pending'){
    manualExPendingStats = newStats;
    renderManualExStatsNote();
    document.getElementById('cardioStatsForm').style.display = 'none';
    activeStatsDate = null;
    return;
  }
  checkedState[targetDate + '_' + contextId + '_done'] = true;
  const isStrengthDay = !!dayData[contextId];
  const existingEntry = historyLog.find(e => e.date === targetDate && e.day === contextId);
  let snapshot;
  if(isStrengthDay && isToday){
    dayData[contextId].exercises.forEach(ex=>{ checkedState[ex.id] = true; });
    snapshot = dayData[contextId].exercises.map(ex => ({
      name: ex.name,
      weight: (window.savedWeights && window.savedWeights[ex.id]) || ''
    }));
  } else {
    // Editing a past day -- keep whatever exercises/weights are already on that
    // entry (possibly just adjusted via the History Log edit form) rather than
    // overwriting them with today's live template.
    snapshot = existingEntry ? existingEntry.exercises : [];
  }
  if(cardioData[contextId]) snapshot = syncCardioExercise(snapshot, newStats);
  saveChecked();
  upsertSessionLog(targetDate, contextId, snapshot, undefined, newStats);
  document.getElementById('cardioStatsForm').style.display = 'none';
  activeStatsDate = null;
  renderTally();
  renderDashboard();
  renderHistory();
  renderWeekPlan();
  if(isToday){
    if(isStrengthDay) renderStrength(contextId);
    else if(cardioData[contextId]) renderCardio(contextId);
    else if(activeCustomPlan) renderCustomPlanSession(activeCustomPlan);
  }
  renderLoggedToday();
  renderTodayGlance();
};

document.querySelector('[data-ai-toggle="stats"]').addEventListener('click', function(){
  const detail = document.querySelector('[data-ai-detail="stats"]');
  const open = detail.style.display !== 'block';
  detail.style.display = open ? 'block' : 'none';
  this.classList.toggle('expanded', open);
});
function buildStatsAiPrompt(desc, workoutSummary){
  const lines = [];
  lines.push('You are a workout stats estimation assistant. Estimate the stats for the activity described below.');
  lines.push('');
  if(workoutSummary) lines.push('Workout logged in the app: ' + workoutSummary);
  lines.push('Additional details from the user: ' + (desc || '(none given)'));
  lines.push('');
  if(!desc && !workoutSummary){
    lines.push('If you have a photo or screenshot of this workout (e.g. from a watch app), please attach it to this chat to improve the estimate.');
    lines.push('');
  }
  lines.push("If a duration/time for this workout was not given above (and isn't visible in an attached photo), ASK ME for it before estimating anything else -- it materially changes the calorie/HR estimate. Otherwise, go ahead and estimate everything below from the details given, marking clearly which values are estimated vs. read directly from a photo.");
  lines.push('');
  lines.push('Reply with ONLY the following lines, filled in with your best estimate. No extra commentary. Leave a line blank after the colon if you truly cannot estimate it.');
  lines.push('Distance: <km, e.g. 5.2>');
  lines.push('Duration: <hh:mm:ss or mm:ss, e.g. 32:10>');
  lines.push('Calories: <number> kcal');
  lines.push('Avg HR: <number> bpm');
  lines.push('Avg Pace: <per km, e.g. 6\'10">');
  lines.push('Steps: <number>');
  lines.push('Max HR: <number> bpm');
  lines.push('Elevation gain: <number> m');
  return lines.join('\n');
}
document.getElementById('aiStatsGenerateBtn').addEventListener('click', ()=>{
  const desc = document.getElementById('aiStatsDesc').value.trim();
  document.getElementById('aiStatsPromptOut').value = buildStatsAiPrompt(desc, currentWorkoutSummaryForStats());
  document.getElementById('aiStatsPromptWrap').style.display = 'block';
});
document.getElementById('aiStatsCopyBtn').addEventListener('click', (e)=>{
  copyTextToClipboard(document.getElementById('aiStatsPromptOut').value, e.currentTarget);
});
document.getElementById('aiStatsParseBtn').addEventListener('click', ()=>{
  const reply = document.getElementById('aiStatsReplyIn').value;
  const errEl = document.getElementById('aiStatsParseError');
  errEl.style.display = 'none';
  const fields = parseLabeledReply(reply, ['Distance','Duration','Calories','Avg HR','Avg Pace','Steps','Max HR','Elevation gain']);
  const hasAny = Object.values(fields).some(v => v);
  if(!reply.trim() || !hasAny){
    errEl.textContent = "Couldn't find any recognizable stats in that reply -- make sure the AI replied using the format from the generated prompt, then try again.";
    errEl.style.display = 'block';
    return;
  }
  if(fields.Distance) document.getElementById('statDistance').value = firstNumber(fields.Distance);
  if(fields.Duration) setDurationFields(fields.Duration.replace(/[^0-9:]/g,''));
  if(fields.Calories) document.getElementById('statCalories').value = firstNumber(fields.Calories);
  if(fields['Avg HR']) document.getElementById('statHR').value = firstNumber(fields['Avg HR']);
  if(fields['Avg Pace']) document.getElementById('statPace').value = fields['Avg Pace'];
  if(fields.Steps) document.getElementById('statSteps').value = firstNumber(fields.Steps);
  if(fields['Max HR']) document.getElementById('statMaxHR').value = firstNumber(fields['Max HR']);
  if(fields['Elevation gain']) document.getElementById('statElevation').value = firstNumber(fields['Elevation gain']);
});

