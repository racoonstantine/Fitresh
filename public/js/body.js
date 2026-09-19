// ---------- Body tab: Sleep (day-nav edit + history + trend chart) ----------
// Body tab: compact read-only summary + mini trend + commentary. Editing
// happens on the dedicated Sleep page (window.openSleepScreen), same
// pattern as the Steps and Fasting tiles.
function renderBodySleepCard(){
  const summaryEl = document.getElementById('bodySleepSummary');
  if(!summaryEl) return;
  const today = dateStrForOffset(0);
  const goalHrs = (userProfile && userProfile.sleepGoalHours) || 8;
  const todayEntry = sleepLog[today] || null;

  const entries = Object.entries(sleepLog)
    .map(([date, s]) => ({date, hours: s.hours}))
    .sort((a,b)=> a.date < b.date ? 1 : -1);
  const recentEntries = entries.slice(0, 3);
  const avgRecent = recentEntries.length ? recentEntries.reduce((a,b)=>a+b.hours,0)/recentEntries.length : null;

  let commentary = 'No sleep logged yet.';
  if(avgRecent !== null){
    if(avgRecent >= goalHrs) commentary = 'Well rested — keep it up.';
    else if(avgRecent >= goalHrs - 1) commentary = 'Close to your sleep goal.';
    else commentary = `Averaging ${formatSleepHours(avgRecent)} the past ${recentEntries.length} night${recentEntries.length===1?'':'s'} — below your ${goalHrs}h goal.`;
  }

  summaryEl.innerHTML = `
    <div style="font-family:var(--font-heading);font-size:22px;">${todayEntry ? formatSleepHours(todayEntry.hours) : '—'}</div>
    <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${todayEntry ? 'Last night' : 'Not logged last night'} · Goal: ${goalHrs}h</div>
    <div style="font-size:12px;color:var(--ink-soft);margin-top:6px;">${commentary}</div>
  `;

  const chartEl = document.getElementById('bodySleepMiniChart');
  if(!chartEl) return;
  const recent = [...entries].reverse().slice(-7);
  if(recent.length < 2){ chartEl.innerHTML = ''; return; }
  renderTrendLineChart(chartEl, recent.map(s => ({y: s.hours, label: formatDateLabel(s.date)})), {goalValue: goalHrs});
}

function renderAccountSnapshot(){
  const greetingCard = document.getElementById('snapshotGreetingCard');
  const profileCard = document.getElementById('snapshotProfileCard');
  if(!greetingCard || !profileCard) return;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
  const name = (currentUser && (currentUser.display_name || currentUser.email)) || 'there';
  const realSessions = historyLog.filter(isRealSessionEntry).length;
  const totalEntries = nutritionLog.length + weighIns.length + historyLog.length;
  const tallyEl = document.getElementById('tallyLabel');
  const tallyText = tallyEl ? tallyEl.textContent : '';

  let weightChangeText = '—';
  if(weighIns.length >= 2){
    const sorted = [...weighIns].sort((a,b)=> a.date < b.date ? -1 : 1);
    const change = sorted[sorted.length - 1].kg - sorted[0].kg;
    weightChangeText = `${change > 0 ? '+' : ''}${formatWeightKg(change)}`;
  }

  greetingCard.innerHTML = `
    <div style="font-family:var(--font-heading);font-size:20px;">${greeting}, ${name}</div>
    <div style="font-size:12.5px;color:var(--ink-soft);margin-top:4px;">${tallyText}</div>
    <div class="dash" style="grid-template-columns:repeat(2,1fr);margin-top:14px;">
      <div class="dash-card"><div class="dash-num">${weightChangeText}</div><div class="dash-label">Weight change</div></div>
      <div class="dash-card"><div class="dash-num">${realSessions}</div><div class="dash-label">Sessions logged</div></div>
      <div class="dash-card"><div class="dash-num">${totalEntries}</div><div class="dash-label">Total entries</div></div>
      <div class="dash-card"><div class="dash-num">${userHealthTargets ? userHealthTargets.bmi : '—'}</div><div class="dash-label">BMI</div></div>
    </div>
  `;

  const p = userProfile;
  if(p){
    const cap = s => s ? (s[0].toUpperCase() + s.slice(1)) : '—';
    const weightNow = currentWeightKg();
    profileCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="block-title" style="margin:0;">Personal profile</div>
        <button class="timer-btn reset" id="snapshotEditBtn" type="button" style="width:auto;padding-inline:16px;">Edit</button>
      </div>
      <div class="dash" style="grid-template-columns:repeat(2,1fr);">
        <div><div class="hub-tile-label">Age</div><div style="font-weight:600;">${p.age || '—'}</div></div>
        <div><div class="hub-tile-label">Gender</div><div style="font-weight:600;">${cap(p.gender)}</div></div>
        <div><div class="hub-tile-label">Height</div><div style="font-weight:600;">${formatHeightCm(p.heightCm)}</div></div>
        <div><div class="hub-tile-label">Weight</div><div style="font-weight:600;">${formatWeightKg(weightNow)}</div></div>
        <div><div class="hub-tile-label">Activity level</div><div style="font-weight:600;">${cap(p.activityLevel)}</div></div>
        <div><div class="hub-tile-label">Goal weight</div><div style="font-weight:600;">${formatWeightKg(p.goalWeightKg)}</div></div>
      </div>
      ${p.notes ? `<div class="note" style="margin-top:12px;">${foodSearchEscape(p.notes)}</div>` : ''}
    `;
  } else {
    profileCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="block-title" style="margin:0;">Personal profile</div>
        <button class="timer-btn start" id="snapshotEditBtn" type="button" style="width:auto;padding-inline:16px;">Set up</button>
      </div>
      <div style="font-size:13px;color:var(--ink-soft);margin-top:10px;">Add your details to see BMI and personal targets.</div>
    `;
  }
  const editBtn = document.getElementById('snapshotEditBtn');
  if(editBtn) editBtn.addEventListener('click', showOnboarding);
}

let goalWeightUnitPrev = 'kg';
function renderAccountGoals(){
  const recEl = document.getElementById('goalEnergyRecommended');
  if(!recEl) return;
  recomputeHealthTargets();
  const t = userHealthTargets;
  const profile = userProfile || {};
  const presetKey = profile.dietPreset || 'open';
  document.getElementById('goalDietPreset').value = presetKey;
  renderDietPresetNote(presetKey);
  const preset = DIET_PRESETS[presetKey] || DIET_PRESETS.open;

  if(!t){
    document.getElementById('goalEnergyNote').textContent = 'Set up your profile (age, height, weight) to see recommended targets.';
    ['goalProteinHint','goalCarbsHint','goalFatHint'].forEach(id => document.getElementById(id).textContent = '');
    document.getElementById('goalEnergyRecommended').textContent = '—';
    document.getElementById('goalEnergyCustom').value = profile.customCalorieTarget || '';
    document.getElementById('goalProteinCustom').value = profile.customProteinTarget || '';
    document.getElementById('goalCarbsCustom').value = profile.customCarbTarget || '';
    document.getElementById('goalFatCustom').value = profile.customFatTarget || '';
  } else {
    const directionLabel = t.goalDirection === 'lose'
      ? `${t.recommendedCalorieTarget} kcal maintenance, less a deficit toward your goal weight.`
      : (t.goalDirection === 'gain'
        ? `${t.recommendedCalorieTarget} kcal, a surplus toward your goal weight.`
        : `${t.recommendedCalorieTarget} kcal maintenance.`);
    document.getElementById('goalEnergyNote').textContent = directionLabel;
    document.getElementById('goalEnergyRecommended').textContent = t.recommendedCalorieTarget;
    document.getElementById('goalEnergyCustom').value = profile.customCalorieTarget || t.recommendedCalorieTarget;

    const cal = profile.customCalorieTarget || t.recommendedCalorieTarget;
    const recProtein = preset.proteinPct != null ? Math.round(cal * preset.proteinPct / 4) : t.recommendedProteinTarget;
    const recCarbs = preset.carbsPct != null ? Math.round(cal * preset.carbsPct / 4) : 180;
    const recFat = preset.fatPct != null ? Math.round(cal * preset.fatPct / 9) : Math.round(cal * 0.3 / 9);
    document.getElementById('goalProteinHint').textContent = `Rec ${recProtein}g`;
    document.getElementById('goalCarbsHint').textContent = `Rec ${recCarbs}g`;
    document.getElementById('goalFatHint').textContent = `Rec ${recFat}g`;
    document.getElementById('goalProteinCustom').value = profile.customProteinTarget || recProtein;
    document.getElementById('goalCarbsCustom').value = profile.customCarbTarget || recCarbs;
    document.getElementById('goalFatCustom').value = profile.customFatTarget || recFat;
  }

  document.getElementById('goalSodiumCustom').value = profile.customSodiumTarget || 2300;
  document.getElementById('goalFiberCustom').value = profile.customFiberTarget || 30;
  document.getElementById('goalSugarCustom').value = profile.customSugarTarget || 50;

  goalWeightUnitPrev = profile.weightUnit || 'kg';
  document.getElementById('goalWeightUnit').value = goalWeightUnitPrev;
  document.getElementById('goalTargetWeightLabel').textContent = `Target weight (${weightUnitLabel()})`;
  document.getElementById('goalTargetWeight').value = profile.goalWeightKg ? Math.round(kgToDisplayWeight(profile.goalWeightKg) * 10) / 10 : '';
  document.getElementById('goalSleepHours').value = profile.sleepGoalHours || 8;
  document.getElementById('goalSteps').value = profile.stepsGoal || 10000;
  document.getElementById('goalStepsHint').textContent = 'Rec 10,000';
  document.getElementById('goalCalorieBurn').value = profile.calorieBurnGoal || 400;
  document.getElementById('goalCalorieBurnHint').textContent = 'Rec 400';
  document.getElementById('goalWater').value = profile.waterGoalMl || 2500;
  document.getElementById('goalFastingHours').value = fastingState.goalHours || 16;

  document.getElementById('goalsError').style.display = 'none';
  document.getElementById('goalsSavedMsg').style.display = 'none';
}

function renderAccountSettings(){
  document.getElementById('acctDisplayName').value = (currentUser && currentUser.display_name) || '';
  document.getElementById('acctUsername').value = (currentUser && currentUser.username) || '';
  document.getElementById('acctEmail').value = (currentUser && currentUser.email) || '';
  document.getElementById('acctUsernameStatus').textContent = '';
  document.getElementById('acctError').style.display = 'none';
}

// Admin console: hardcoded-visibility (see showAppFor) but the real
// authorization boundary is server-side in api/admin.php, which re-checks
// the caller's own email fresh from the DB on every request. This UI gate
// is just so non-admin accounts don't see a tab that would 403 anyway.
async function renderAdminPanel(){
  const statusEl = document.getElementById('adminStatus');
  const listEl = document.getElementById('adminUserList');
  statusEl.textContent = 'Loading…';
  listEl.innerHTML = '';
  try{
    const {ok, data} = await safeFetchJson('api/admin.php?action=overview', {credentials: 'same-origin'});
    if(!ok || data.error) throw new Error(data.error || 'Could not load the user list.');
    statusEl.textContent = `${data.users.length} account${data.users.length === 1 ? '' : 's'}.`;
    const statusLabel = {approved: 'Approved', pending: 'Pending', rejected: 'Rejected'};
    listEl.innerHTML = data.users.map(u => `
      <div class="hub-card" style="margin-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="min-width:0;">
            <div style="font-weight:600;font-size:13.5px;">${foodSearchEscape(u.display_name)} ${u.username ? `<span style="color:var(--ink-soft);font-weight:400;">@${foodSearchEscape(u.username)}</span>` : ''}</div>
            <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${foodSearchEscape(u.email)}</div>
          </div>
          <span class="tag ${u.status === 'approved' ? 'tag-accent-2' : 'tag-accent'}" style="flex-shrink:0;">${statusLabel[u.status] || u.status}</span>
        </div>
        <div style="font-size:11.5px;color:var(--ink-soft);margin-top:8px;">Signed up ${formatDateLabel(String(u.created_at).slice(0,10))} · ${u.days_logged} day${u.days_logged === 1 ? '' : 's'} logged</div>
        <button type="button" class="timer-btn reset" data-admin-reset="${u.id}" data-admin-email="${foodSearchEscape(u.email)}" style="width:100%;margin-top:10px;padding:7px 0;font-size:12.5px;">Reset password</button>
      </div>
    `).join('');
  }catch(err){
    statusEl.textContent = err.message || 'Could not load the user list.';
  }
}
document.getElementById('adminUserList').addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-admin-reset]');
  if(!btn) return;
  const userId = parseInt(btn.dataset.adminReset, 10);
  const email = btn.dataset.adminEmail;
  if(!confirm(`Reset the password for ${email}? This immediately invalidates their current password.`)) return;
  btn.disabled = true;
  btn.textContent = 'Resetting…';
  try{
    const {ok, data} = await safeFetchJson('api/admin.php?action=reset_password', {
      method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'reset_password', user_id: userId})
    });
    if(!ok || data.error) throw new Error(data.error || 'Could not reset this password.');
    alert(`New temporary password for ${data.email}:\n\n${data.temp_password}\n\nShare this with them directly -- it won't be shown again.`);
  }catch(err){
    alert(err.message || 'Could not reset this password.');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Reset password';
  }
});

function renderInsights(){
  const el = document.getElementById('insightsContent');
  if(!el) return;
  if(!userHealthTargets){
    el.innerHTML = `
      <div class="hub-card" style="text-align:center;">
        <div class="block-title" style="margin:0 0 8px;">Your profile isn't set up yet</div>
        <div style="font-size:13.5px;color:var(--ink-soft);margin-bottom:14px;">Add your age, height, and weight to see your BMI and personalized calorie/protein targets.</div>
        <button class="timer-btn start" id="insightsSetupBtn" type="button" style="width:auto;padding-inline:24px;">Set up profile</button>
      </div>
    `;
    document.getElementById('insightsSetupBtn').addEventListener('click', showOnboarding);
    return;
  }
  const t = userHealthTargets;
  const bmiTagClass = t.bmiCategory === 'Normal' ? 'tag-accent-2' : 'tag-accent';
  const directionLabel = t.goalDirection === 'lose' ? 'Calorie deficit to reach your goal' : (t.goalDirection === 'gain' ? 'Calorie surplus to reach your goal' : 'Maintenance calories');
  el.innerHTML = `
    <div class="hub-card">
      <div class="block-title" style="margin:0 0 12px;">Your numbers</div>
      <div class="dash" style="grid-template-columns:repeat(3,1fr);">
        <div class="dash-card"><div class="dash-num">${t.bmi}</div><div class="dash-label">BMI</div></div>
        <div class="dash-card"><div class="dash-num">${t.calorieTarget}</div><div class="dash-label">Daily kcal target</div></div>
        <div class="dash-card"><div class="dash-num">${t.proteinTarget}g</div><div class="dash-label">Protein target</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap;">
        <span class="tag ${bmiTagClass}">${t.bmiCategory}</span>
        <span style="font-size:12.5px;color:var(--ink-soft);">${directionLabel}</span>
      </div>
      <div style="font-size:12px;color:var(--ink-soft);margin-top:10px;">Resting (BMR) ${t.bmr} kcal · Active (TDEE) ${t.tdee} kcal · Water target ${(t.waterGoalMl/1000).toFixed(1)} L</div>
      <button class="timer-btn reset" id="insightsEditBtn" type="button" style="width:auto;padding-inline:18px;margin-top:14px;">Edit profile</button>
    </div>
  `;
  document.getElementById('insightsEditBtn').addEventListener('click', showOnboarding);
}

function renderSummary(){
  const rangeSel = document.getElementById('summaryRange');
  const range = rangeSel ? rangeSel.value : 'week';
  const days = range === 'day' ? 1 : (range === 'month' ? 30 : 7);

  const dateList = [];
  for(let i=days-1;i>=0;i--) dateList.push(dateStrForOffset(-i));

  // Workouts in range
  const workoutEntries = historyLog.filter(e => dateList.includes(e.date) && isRealSessionEntry(e));
  const workoutDays = new Set(workoutEntries.map(e=>e.date)).size;
  const plannedDays = dateList.filter(d => {
    const idx = new Date(d + 'T00:00:00').getDay();
    return !!planDayFor(idx, d);
  }).length;

  // Nutrition in range
  const nutriEntries = nutritionLog.filter(e => dateList.includes(e.date));
  const avg = (key) => {
    const vals = nutriEntries.map(e=>parseFloat(e[key])).filter(v=>!isNaN(v));
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  };
  const avgCal = avg('calories'), avgProtein = avg('protein'), avgFast = avg('fastHours');

  // Sleep & steps in range
  const sleepVals = dateList.map(d => sleepLog[d] ? sleepLog[d].hours : null).filter(v => v !== null);
  const avgSleep = sleepVals.length ? sleepVals.reduce((a,b)=>a+b,0)/sleepVals.length : null;
  const stepsVals = dateList.map(d => stepsLog[d]).filter(v => v !== undefined && v !== null);
  const avgSteps = stepsVals.length ? Math.round(stepsVals.reduce((a,b)=>a+b,0)/stepsVals.length) : null;

  // Weight change in range
  const weightsInRange = weighIns.filter(w => dateList.includes(w.date)).sort((a,b)=> a.date < b.date ? -1 : 1);
  let weightChange = null;
  if(weightsInRange.length >= 2){
    weightChange = weightsInRange[weightsInRange.length-1].kg - weightsInRange[0].kg;
  } else if(weightsInRange.length === 1 && weighIns.length > 1){
    // compare to nearest prior entry before range for single-point ranges (e.g. "Today")
    const sortedAll = [...weighIns].sort((a,b)=> a.date < b.date ? -1 : 1);
    const idx = sortedAll.findIndex(w => w.date === weightsInRange[0].date);
    if(idx > 0) weightChange = weightsInRange[0].kg - sortedAll[idx-1].kg;
  }

  document.getElementById('summaryCards').innerHTML = `
    <div class="dash-card"><div class="dash-num">${workoutDays}/${plannedDays}</div><div class="dash-label">Workouts done</div></div>
    <div class="dash-card"><div class="dash-num">${avgCal !== null ? Math.round(avgCal) : '—'}</div><div class="dash-label">Avg kcal</div></div>
    <div class="dash-card"><div class="dash-num">${avgProtein !== null ? avgProtein.toFixed(1) : '—'}</div><div class="dash-label">Avg protein (g)</div></div>
    <div class="dash-card"><div class="dash-num">${avgFast !== null ? formatFastHours(avgFast) : '—'}</div><div class="dash-label">Avg fast</div></div>
    <div class="dash-card"><div class="dash-num">${weightChange !== null ? (weightChange > 0 ? '+' : '') + formatWeightKg(weightChange) : '—'}</div><div class="dash-label">Weight change</div></div>
    <div class="dash-card"><div class="dash-num">${nutriEntries.length}</div><div class="dash-label">Days nutrition logged</div></div>
    <div class="dash-card"><div class="dash-num">${avgSleep !== null ? formatSleepHours(avgSleep) : '—'}</div><div class="dash-label">Avg sleep</div></div>
    <div class="dash-card"><div class="dash-num">${avgSteps !== null ? avgSteps.toLocaleString() : '—'}</div><div class="dash-label">Avg steps</div></div>
  `;

  // Day-by-day table
  const tableEl = document.getElementById('summaryTable');
  const rows = dateList.slice().reverse().map(d=>{
    const w = historyLog.find(e => e.date === d && isRealSessionEntry(e));
    const n = nutritionLog.find(e => e.date === d);
    const wt = weighIns.find(e => e.date === d);
    const sl = sleepLog[d];
    const st = stepsLog[d];
    return `
      <div style="display:flex;gap:6px;padding:7px 4px;border-bottom:1px solid var(--line);align-items:center;">
        <div style="flex:0 0 76px;flex-shrink:0;color:var(--ink-soft);">${d}</div>
        <div style="flex:1 0 100px;color:${w ? 'var(--forest-dark)' : 'var(--ink-soft)'};">${w ? w.label : '—'}</div>
        <div style="flex:0 0 60px;flex-shrink:0;text-align:right;color:${n && n.calories ? (parseFloat(n.calories) >= getTargets(d).calMin ? 'var(--forest-dark)' : '#B4472A') : 'var(--ink-soft)'};">${n && n.calories ? n.calories+'k' : '—'}</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;color:var(--ink);">${wt ? formatWeightKg(wt.kg) : '—'}</div>
        <div style="flex:0 0 50px;flex-shrink:0;text-align:right;color:var(--ink-soft);">${n && n.fastHours ? formatFastHours(parseFloat(n.fastHours)) : '—'}</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;color:var(--ink-soft);">${sl ? formatSleepHours(sl.hours) : '—'}</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;color:var(--ink-soft);">${st !== undefined ? st.toLocaleString() : '—'}</div>
      </div>
    `;
  }).join('');
  tableEl.innerHTML = `
    <div style="min-width:480px;">
      <div style="display:flex;gap:6px;padding:6px 4px;font-weight:600;color:var(--ink-soft);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1.5px solid var(--ink);">
        <div style="flex:0 0 76px;flex-shrink:0;">Date</div>
        <div style="flex:1 0 100px;">Workout</div>
        <div style="flex:0 0 60px;flex-shrink:0;text-align:right;">Kcal</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;">Weight</div>
        <div style="flex:0 0 50px;flex-shrink:0;text-align:right;">Fast</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;">Sleep</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;">Steps</div>
      </div>
      ${rows}
    </div>
  `;
}

// Picks a "nice" rounded step (1/2/5 x a power of 10) for ~count gridlines
// spanning [min, max], the same rounding trick D3's tick generator uses --
// e.g. a 90.6-102 range becomes 90/95/100 rather than awkward decimals.
function niceTicks(min, max, count){
  if(min === max){ min -= 1; max += 1; }
  const range = max - min;
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceNorm = norm < 1.5 ? 1 : (norm < 3 ? 2 : (norm < 7 ? 5 : 10));
  const step = niceNorm * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for(let v = niceMin; v <= niceMax + step * 1e-6; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

// Shared trend-line chart: axis gridlines + labels, a line with dot markers,
// and an optional dashed goal/target line -- used by Weight, Sleep, Steps,
// Fasting, and Water so every trend graph in the app looks the same.
// points: [{y: number, label: string}], oldest first.
function renderTrendLineChart(containerEl, points, opts){
  if(!containerEl) return;
  opts = opts || {};
  if(points.length < 2){
    containerEl.innerHTML = `<div class="dash-empty">${opts.emptyText || 'Log a couple of entries to see your trend.'}</div>`;
    return;
  }
  const color = opts.color || 'var(--forest)';
  const dotColor = opts.dotColor || 'var(--forest-dark)';
  const vals = points.map(p => p.y).concat(opts.goalValue !== undefined && opts.goalValue !== null ? [opts.goalValue] : []);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 4);
  const minV = ticks[0], maxV = ticks[ticks.length - 1];
  const w = 300, h = 150, padL = 34, padR = 8, padT = 10, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xStep = plotW / (points.length - 1);
  const yFor = v => padT + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
  const xFor = i => padL + i * xStep;

  const gridLines = ticks.map(t => `
    <line x1="${padL}" y1="${yFor(t)}" x2="${w - padR}" y2="${yFor(t)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${padL - 6}" y="${yFor(t) + 3}" text-anchor="end" font-size="9" fill="var(--ink-soft)">${t}</text>
  `).join('');
  const goalLine = (opts.goalValue !== undefined && opts.goalValue !== null)
    ? `<line x1="${padL}" y1="${yFor(opts.goalValue)}" x2="${w - padR}" y2="${yFor(opts.goalValue)}" stroke="var(--ochre)" stroke-width="1.5" stroke-dasharray="4,3"/>`
    : '';
  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.y)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${xFor(i)}" cy="${yFor(p.y)}" r="3.5" fill="${dotColor}"/>`).join('');
  const labelIdxs = points.length <= 6 ? points.map((_, i) => i) : [0, Math.round((points.length - 1) / 2), points.length - 1];
  const xLabels = labelIdxs.map(i => `<text x="${xFor(i)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${points[i].label}</text>`).join('');

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;overflow:visible;">
      ${gridLines}
      ${goalLine}
      <polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </svg>
    ${opts.goalLabel ? `<div style="font-size:10.5px;color:var(--ochre);text-align:right;margin-top:2px;">- - - ${opts.goalLabel}</div>` : ''}
  `;
}

function renderWeightSection(){
  const sorted = [...weighIns].sort((a,b)=> a.date < b.date ? -1 : 1);
  const startWeight = sorted.length ? sorted[0].kg : GOAL_WEIGHT;
  const current = sorted.length ? sorted[sorted.length-1].kg : GOAL_WEIGHT;
  const totalToLose = startWeight - GOAL_WEIGHT;
  const lostSoFar = Math.max(0, startWeight - current);
  const pct = totalToLose > 0 ? Math.min(100, Math.round((lostSoFar / totalToLose) * 100)) : 0;
  const remaining = Math.max(0, current - GOAL_WEIGHT);

  const unitLabel = weightUnitLabel();
  const weighInKgInput = document.getElementById('weighInKg');
  if(weighInKgInput) weighInKgInput.placeholder = unitLabel;
  document.getElementById('bodyWeightCards').innerHTML = `
    <div class="dash-card">
      <div class="dash-num">${kgToDisplayWeight(current).toFixed(1)}</div>
      <div class="dash-label">Current (${unitLabel})</div>
    </div>
    <div class="dash-card">
      <div class="dash-num">${lostSoFar > 0 ? '−' + kgToDisplayWeight(lostSoFar).toFixed(1) : '0.0'}</div>
      <div class="dash-label">Lost so far</div>
    </div>
    <div class="dash-card">
      <div class="dash-num">${kgToDisplayWeight(remaining).toFixed(1)}</div>
      <div class="dash-label">${unitLabel} to goal</div>
    </div>
  `;

  const chartEl = document.getElementById('weightChart');
  renderTrendLineChart(chartEl, sorted.map(s => ({y: kgToDisplayWeight(s.kg), label: formatDateLabel(s.date)})), {
    color: 'var(--forest)', dotColor: 'var(--forest-dark)',
    goalValue: kgToDisplayWeight(GOAL_WEIGHT), goalLabel: `goal ${formatWeightKg(GOAL_WEIGHT)}`,
    emptyText: 'Log at least 2 weigh-ins to see your trend line.'
  });

  // Recent entries list -- paged 5 at a time, most recent page first.
  const listEl = document.getElementById('weighInList');
  const pageLabelEl = document.getElementById('weighInHistPageLabel');
  const prevBtn = document.getElementById('weighInHistPrev');
  const nextBtn = document.getElementById('weighInHistNext');
  const PAGE_SIZE = 5;
  if(sorted.length === 0){
    listEl.innerHTML = `<div class="dash-empty">No weigh-ins logged yet.</div>`;
    pageLabelEl.textContent = '';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  } else {
    const reversed = [...sorted].reverse(); // newest first
    const pageCount = Math.max(1, Math.ceil(reversed.length / PAGE_SIZE));
    weighInHistPage = Math.min(Math.max(0, weighInHistPage), pageCount - 1);
    const pageStart = weighInHistPage * PAGE_SIZE;
    const pageItems = reversed.slice(pageStart, pageStart + PAGE_SIZE);
    listEl.innerHTML = pageItems.map((entry)=>{
      const prevIdx = sorted.findIndex(s=>s.date===entry.date) - 1;
      const prev = prevIdx >= 0 ? sorted[prevIdx].kg : null;
      let deltaHtml = '';
      if(prev !== null){
        const d = entry.kg - prev;
        const cls = d < 0 ? 'down' : (d > 0 ? 'up' : '');
        deltaHtml = `<span class="wi-delta ${cls}">${d === 0 ? '' : (d > 0 ? '+' : '') + kgToDisplayWeight(d).toFixed(1)}</span>`;
      }
      return `
        <div class="wi-row wi-row-edit" data-edit-weight="${entry.date}" data-edit-kg="${entry.kg}" style="cursor:pointer;">
          <div class="wi-date">${entry.date}</div>
          <div class="wi-kg">${formatWeightKg(entry.kg)}</div>
          ${deltaHtml}
          <button class="wi-del" data-del-weight="${entry.date}">✕</button>
        </div>
      `;
    }).join('');
    listEl.querySelectorAll('[data-edit-weight]').forEach(row=>{
      row.addEventListener('click', (e)=>{
        if(e.target.closest('[data-del-weight]')) return;
        document.getElementById('weighInDate').value = row.dataset.editWeight;
        const kgInput = document.getElementById('weighInKg');
        kgInput.value = Math.round(kgToDisplayWeight(parseFloat(row.dataset.editKg)) * 10) / 10;
        kgInput.focus();
        if(kgInput.scrollIntoView) kgInput.scrollIntoView({behavior:'smooth', block:'center'});
      });
    });
    listEl.querySelectorAll('[data-del-weight]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        removeWeighIn(btn.dataset.delWeight);
        renderWeightSection();
        renderTodayGlance();
      });
    });
    pageLabelEl.textContent = `${pageStart + 1}-${pageStart + pageItems.length} of ${reversed.length}`;
    prevBtn.disabled = weighInHistPage >= pageCount - 1; // "prev" = further back in time = higher page index
    nextBtn.disabled = weighInHistPage <= 0;
  }
}

function renderDashboard(){
  if(dashSelectedDate === null) dashSelectedDate = dateStrForOffset(0);
  const rangeSel = document.getElementById('dashRange');
  const range = rangeSel ? rangeSel.value : 'week';
  const todayIdx = new Date().getDay();
  const todayStr = dateStrForOffset(0);

  const navEl = document.getElementById('dashDayNav');
  const detailEl = document.getElementById('dashDayDetail');

  if(range === 'day'){
    const isToday = dashSelectedDate === todayStr;
    navEl.innerHTML = `
      <button class="day-nav-btn" id="dashPrevDay"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="day-nav-label">
        <div class="day-nav-date">${isToday ? 'Today' : formatDateLabel(dashSelectedDate)}</div>
        ${!isToday ? `<div class="day-nav-today-link" id="dashJumpToday">Jump to today</div>` : `<div style="font-size:11px;color:var(--ink-soft);">${formatDateLabel(dashSelectedDate)}</div>`}
      </div>
      <button class="day-nav-btn" id="dashNextDay" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    `;
    document.getElementById('dashPrevDay').addEventListener('click', ()=>{
      dashSelectedDate = addDaysToDate(dashSelectedDate, -1);
      weekStripAnchorDate = dashSelectedDate;
      renderDashboard();
      renderWeekPlan();
      renderTodaysSession();
    });
    if(!isToday){
      document.getElementById('dashNextDay').addEventListener('click', ()=>{
        dashSelectedDate = addDaysToDate(dashSelectedDate, 1);
        weekStripAnchorDate = dashSelectedDate;
        renderDashboard();
        renderWeekPlan();
        renderTodaysSession();
      });
      document.getElementById('dashJumpToday').addEventListener('click', ()=>{
        dashSelectedDate = todayStr;
        weekStripAnchorDate = null;
        renderDashboard();
        renderWeekPlan();
        renderTodaysSession();
      });
    }

    const dayEntries = historyLog.filter(e => e.date === dashSelectedDate);
    const realSessions = dayEntries.filter(isRealSessionEntry);
    const planIdx = new Date(dashSelectedDate + 'T00:00:00').getDay();
    const scheduledPlan = scheduledPlanFor(planIdx, dashSelectedDate);
    const dayCal = dayEntries.reduce((sum,e)=> sum + (e.stats && e.stats.calories ? parseFloat(e.stats.calories)||0 : 0), 0);
    const hrList = dayEntries.filter(e=>e.stats && e.stats.hr).map(e=>parseFloat(e.stats.hr));
    const dayAvgHR = hrList.length ? Math.round(hrList.reduce((a,b)=>a+b,0)/hrList.length) : null;
    const status = realSessions.length ? 'Done' : (scheduledPlan ? 'Missed' : 'Rest day');
    const statusColor = realSessions.length ? 'var(--forest-dark)' : (scheduledPlan ? '#B4472A' : 'var(--ink-soft)');
    const distList = dayEntries.filter(e=>e.stats && e.stats.distance).map(e=>parseFloat(e.stats.distance)||0);
    const dayDistance = distList.length ? distList.reduce((a,b)=>a+b,0) : null;
    const recoveryList = dayEntries.filter(e=>e.stats && e.stats.recoveryHr).map(e=>parseFloat(e.stats.recoveryHr)||0);
    const dayRecovery = recoveryList.length ? Math.round(recoveryList.reduce((a,b)=>a+b,0)/recoveryList.length) : null;
    const dayStepsCount = stepsLog[dashSelectedDate] || 0;

    document.getElementById('dashCards').innerHTML = `
      <div class="dash-card"><div class="dash-num" style="color:${statusColor};font-size:16px;">${status}</div><div class="dash-label">Session status</div></div>
      <div class="dash-card"><div class="dash-num">${dayCal > 0 ? Math.round(dayCal) : '—'}</div><div class="dash-label">Kcal burned</div></div>
      <div class="dash-card"><div class="dash-num">${dayAvgHR || '—'}</div><div class="dash-label">Avg HR (bpm)</div></div>
      <div class="dash-card open-steps-screen-link" style="cursor:pointer;"><div class="dash-num">${dayStepsCount ? dayStepsCount.toLocaleString() : '—'}</div><div class="dash-label">Steps</div></div>
      <div class="dash-card"><div class="dash-num">${dayDistance ? dayDistance.toFixed(1) : '—'}</div><div class="dash-label">Distance (km)</div></div>
      <div class="dash-card"><div class="dash-num">${dayRecovery !== null ? dayRecovery : '—'}</div><div class="dash-label">Recovery (Δbpm)</div></div>
    `;

    if(dayEntries.length){
      detailEl.innerHTML = `
        <div style="background:var(--paper-raised);border:1px solid var(--line);border-radius:8px;padding:12px;">
          <div class="log-head" data-dashdetail-toggle="1" style="padding:0 0 6px;cursor:pointer;">
            <div style="flex:1;font-size:11.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;">Session details (${dayEntries.length})</div>
            <svg class="log-caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <div class="log-detail open" data-dashdetail-detail="1">
            <div style="padding-top:4px;">
              ${dayEntries.map(e => {
                const exList = e.exercises && e.exercises.length ? e.exercises.map(ex=>`<div class="log-line">- ${foodSearchEscape(exerciseSummaryText(ex))}</div>`).join('') : '';
                const s = e.stats;
                const statLine = s ? [s.distance?s.distance+'km':'', s.duration?s.duration:'', s.calories?s.calories+'kcal':'', s.hr?s.hr+'bpm':''].filter(Boolean).join(' · ') : '';
                return `<div style="margin-bottom:8px;"><strong style="font-size:12.5px;color:var(--ink);">${foodSearchEscape(e.label)}</strong>${statLine ? `<div style="font-size:11.5px;color:var(--ink-soft);">${statLine}</div>` : ''}${exList}${e.notes ? `<div class="log-note" style="font-size:11.5px;">${foodSearchEscape(e.notes)}</div>` : ''}</div>`;
              }).join('')}
            </div>
          </div>
        </div>
      `;
      const dh = detailEl.querySelector('[data-dashdetail-toggle="1"]');
      dh.addEventListener('click', ()=>{
        const d = detailEl.querySelector('[data-dashdetail-detail="1"]');
        const open = d.classList.toggle('open');
        dh.classList.toggle('expanded', open);
      });
    } else {
      detailEl.innerHTML = scheduledPlan
        ? `<div class="dash-empty">No session logged for this day (${foodSearchEscape(scheduledPlan.name)} was planned).</div>`
        : `<div class="dash-empty">Rest day, nothing planned.</div>`;
    }

    document.getElementById('weightProgress').innerHTML = '';
    document.getElementById('workoutTrendChart').innerHTML = '';
    renderTodayGlance();
    return;
  }

  navEl.innerHTML = '';
  detailEl.innerHTML = '';

  const windowDays = range === 'month' ? 30 : 7;

  // Sessions in window vs. planned training days
  let weekDone = 0, weekPlanned = 0;
  for(let i=0;i<windowDays;i++){
    const dStr = dateStrForOffset(-i);
    const idx = new Date(dStr + 'T00:00:00').getDay();
    const planDay = planDayFor(idx, dStr);
    if(!planDay) continue;
    weekPlanned++;
    if(checkedState[dStr + '_' + planDay + '_done']) weekDone++;
  }

  // Streak: walk backward day by day, rest days don't break it, missed training days do
  let streak = 0;
  for(let back=0; back<60; back++){
    const idx = ((todayIdx - back) % 7 + 7) % 7;
    const dStr = dateStrForOffset(-back);
    const planDay = planDayFor(idx, dStr);
    if(!planDay){
      continue; // rest day, doesn't count or break
    }
    if(checkedState[dStr + '_' + planDay + '_done']){
      streak++;
    } else {
      if(back === 0) continue; // today not done yet doesn't break streak
      break;
    }
  }

  const totalLogged = Object.keys(checkedState).filter(k=>k.endsWith('_done') && checkedState[k]).length;

  // Cardio analytics from watch stats logged in window
  let windowDistance = 0, windowCalories = 0, hrReadings = [];
  for(let i=0;i<windowDays;i++){
    const dStr = dateStrForOffset(-i);
    historyLog.filter(e => e.date === dStr && e.stats).forEach(e=>{
      if(e.stats.distance) windowDistance += parseFloat(e.stats.distance) || 0;
      if(e.stats.calories) windowCalories += parseFloat(e.stats.calories) || 0;
      if(e.stats.hr) hrReadings.push(parseFloat(e.stats.hr));
    });
  }
  const avgHR = hrReadings.length ? Math.round(hrReadings.reduce((a,b)=>a+b,0) / hrReadings.length) : null;
  const rangeLabel = range === 'month' ? ' (30d)' : ' (7d)';

  document.getElementById('dashCards').innerHTML = `
    <div class="dash-card">
      <div class="dash-num">${weekDone}/${weekPlanned}</div>
      <div class="dash-label">Sessions${rangeLabel}</div>
    </div>
    <div class="dash-card">
      <div class="dash-num">${streak}</div>
      <div class="dash-label">Day streak</div>
    </div>
    <div class="dash-card">
      <div class="dash-num">${totalLogged}</div>
      <div class="dash-label">All-time sessions</div>
    </div>
    <div class="dash-card">
      <div class="dash-num">${windowDistance > 0 ? windowDistance.toFixed(1) : '—'}</div>
      <div class="dash-label">Km${rangeLabel}</div>
    </div>
    <div class="dash-card">
      <div class="dash-num">${windowCalories > 0 ? Math.round(windowCalories) : '—'}</div>
      <div class="dash-label">Kcal${rangeLabel}</div>
    </div>
    <div class="dash-card">
      <div class="dash-num">${avgHR || '—'}</div>
      <div class="dash-label">Avg HR (bpm)</div>
    </div>
  `;

  renderWorkoutTrendChart(document.getElementById('workoutTrendChart'), range, windowDays);

  // Weight progression list
  const weights = window.savedWeights || {};
  const nameMap = {};
  dayData.A.exercises.concat(dayData.B.exercises).forEach(ex=>{ nameMap[ex.id] = ex.name; });
  const entries = Object.entries(weights).filter(([id,v])=>v && parseFloat(v) > 0 && nameMap[id]);
  const wpEl = document.getElementById('weightProgress');
  if(entries.length === 0){
    wpEl.innerHTML = `<div class="dash-empty">Log weights on your exercises to see progression here.</div>`;
  } else {
    const maxVal = Math.max(...entries.map(([id,v])=>parseFloat(v)));
    wpEl.innerHTML = entries.map(([id,v])=>{
      const pct = Math.max(8, (parseFloat(v) / maxVal) * 100);
      return `
        <div class="wp-row">
          <div class="wp-name">${nameMap[id]}</div>
          <div class="wp-bar-track"><div class="wp-bar-fill" style="width:${pct}%;"></div></div>
          <div class="wp-val">${v} kg</div>
        </div>
      `;
    }).join('');
  }
  renderTodayGlance();
}

function renderWeekPlan(){
  const noPlanPanel = document.getElementById('noWorkoutPlanPanel');
  const planBody = document.getElementById('workoutPlanBody');
  const hasPlan = !!(userTrainingPlan && userTrainingPlan.presetKey);
  if(noPlanPanel) noPlanPanel.style.display = hasPlan ? 'none' : 'block';
  if(planBody) planBody.style.display = hasPlan ? 'block' : 'none';
  const overridePanel = document.getElementById('dayOverridePanel');
  if(overridePanel) overridePanel.style.display = 'none';
  if(!hasPlan) return;

  const todayStr = dateStrForOffset(0);
  const todayIdx = new Date().getDay();
  const isOpen = userTrainingPlan.presetKey === 'open';
  // The strip normally shows the week containing today, but paging through
  // past/future days on the Workout Dashboard (Daily view) moves it to
  // whichever week contains the day currently selected there instead.
  const anchorStr = weekStripAnchorDate || todayStr;
  const anchorIdx = new Date(anchorStr + 'T00:00:00').getDay();
  const strip = document.getElementById('weekStrip');
  strip.innerHTML = '';
  weekPlan.forEach((base, i)=>{
    const dStr = addDaysToDate(anchorStr, i - anchorIdx);
    const entry = isOpen ? window.openModeDayEntry(dStr) : effectiveDayEntry(dStr, i);
    const plan = entry && entry.type === 'workoutPlan' ? getWorkoutPlan(entry.planId) : null;
    const legacyKey = plan && plan.kind === 'legacy' ? plan.legacyKey : null;
    const done = legacyKey ? !!checkedState[dStr + '_' + legacyKey + '_done'] : false;
    const hasOverride = !isOpen && userTrainingPlan.overrides && userTrainingPlan.overrides[dStr];
    const isSelected = dStr === anchorStr && anchorStr !== todayStr;
    const cell = document.createElement('div');
    cell.className = 'week-day' + (dStr === todayStr ? ' today' : '') + (isSelected ? ' selected' : '') + (done ? ' done' : '');
    cell.style.cursor = 'pointer';
    cell.title = 'Tap to correct what actually happened this day';
    cell.innerHTML = `
      <div class="week-day-name">${base.name}${hasOverride ? ' *' : ''}</div>
      <div class="week-day-type">${window.planDayLabel(entry)}</div>
      <div class="week-day-dot"></div>
    `;
    // Every cell opens the deviation-override panel (even Rest/unset days --
    // that's exactly how you'd record "planned Rest, actually worked out").
    // Open mode has no recurring pattern to override, so its cells are just
    // a live read-only reflection of what was logged.
    if(!isOpen){
      cell.addEventListener('click', ()=> window.openDayOverridePanel(dStr, base.name));
    }
    strip.appendChild(cell);
  });

  const todayEntry = isOpen ? window.openModeDayEntry(dateStrForOffset(0)) : effectiveDayEntry(dateStrForOffset(0), todayIdx);
  document.getElementById('todayPlanText').textContent = window.planDayLabel(todayEntry);
  const btn = document.getElementById('todayBtn');
  if(window.planDayHasAction(todayEntry)){
    btn.style.display = 'inline-block';
    btn.textContent = 'Go';
    btn.onclick = ()=> window.goToPlanDay(todayEntry);
  } else {
    btn.style.display = 'none';
  }
  renderPlanTiles();
}

// "Workout Today" / "Training Plan" tiles above the calendar -- a compact
// always-visible summary of what's scheduled, with an "Edit" affordance
// into the same screens the old buttons opened.
function renderPlanTiles(){
  const nameEl = document.getElementById('workoutTodayTileName');
  const planEl = document.getElementById('trainingPlanTileName');
  if(!nameEl || !planEl) return;
  const plan = userTrainingPlan;
  if(!plan || !plan.presetKey){
    nameEl.textContent = 'No Plan Yet';
    planEl.textContent = 'No Plan Yet';
    return;
  }
  planEl.textContent = plan.name || plan.presetKey;
  if(plan.presetKey === 'open'){
    const entry = window.openModeDayEntry(dateStrForOffset(0));
    nameEl.textContent = window.planDayLabel(entry);
    return;
  }
  const entry = effectiveDayEntry(dateStrForOffset(0), new Date().getDay());
  nameEl.textContent = window.planDayLabel(entry);
}

function renderHistory(){
  const el = document.getElementById('historyList');
  if(historyLog.length === 0){
    el.innerHTML = `<div class="dash-empty">No sessions logged yet — mark a day done and it'll show up here.</div>`;
    return;
  }
  const shown = historyLog.slice(0,10);
  el.innerHTML = shown.map((entry, idx) => {
    const s = entry.stats;
    const quickStat = s ? [s.distance ? s.distance+'km':'', s.calories ? s.calories+'kcal':'', s.hr ? s.hr+'bpm':''].filter(Boolean).join(' · ') : '';
    const exList = entry.exercises && entry.exercises.length
      ? entry.exercises.map(ex => `<div class="log-line">- ${foodSearchEscape(exerciseSummaryText(ex))}</div>`).join('')
      : '';
    const statLines = s ? [
      s.distance ? `Distance: ${s.distance} km` : '',
      s.duration ? `Duration: ${s.duration}` : '',
      s.calories ? `Calories: ${s.calories} kcal` : '',
      s.hr ? `Avg HR: ${s.hr} bpm` : '',
      s.pace ? `Pace: ${s.pace}/km` : '',
      s.steps ? `Steps: ${s.steps}` : ''
    ].filter(Boolean).map(l => `<div class="log-line">${l}</div>`).join('') : '';
    const editExRows = (entry.exercises || []).map((ex, exi) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">
        <span style="font-size:12.5px;flex:1;">${foodSearchEscape(ex.name)}</span>
        <input type="text" data-hist-weight="${idx}:${exi}" value="${foodSearchEscape(ex.weight || '')}" placeholder="e.g. 8 (kg)" style="width:90px;padding:5px 6px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12px;">
      </div>
    `).join('');
    return `
    <div class="log-row">
      <div class="log-head" data-hist-toggle="${idx}">
        <div class="hist-date">${foodSearchEscape(entry.date)}</div>
        <div class="hist-type">${foodSearchEscape(entry.label)}${quickStat ? ' · ' + foodSearchEscape(quickStat) : ''}</div>
        <svg class="log-caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="log-detail" data-hist-detail="${idx}">
        <div class="log-detail-inner">
          ${exList || '<div class="log-line">(no exercises listed)</div>'}
          ${statLines}
          ${entry.notes ? `<div class="log-note">${foodSearchEscape(entry.notes)}</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="img-link" data-hist-edit-toggle="${idx}" type="button" style="cursor:pointer;flex:1;">Edit</button>
            <button class="wi-del" data-hist-delete="${idx}" type="button" title="Delete session">✕ Delete</button>
          </div>
          <div data-hist-edit-form="${idx}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
            ${editExRows}
            <label style="font-size:11px;color:var(--ink-soft);display:block;margin-top:8px;">Notes</label>
            <textarea data-hist-notes="${idx}" rows="2" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;font-family:var(--font-body);margin-top:2px;">${entry.notes || ''}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="timer-btn start" data-hist-save="${idx}" type="button" style="flex:1;">Save changes</button>
              <button class="timer-btn reset" data-hist-edit-stats="${idx}" type="button" style="flex:1;">Edit watch stats</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');
  el.querySelectorAll('[data-hist-toggle]').forEach(head=>{
    head.addEventListener('click', ()=>{
      const idx = head.dataset.histToggle;
      const detail = el.querySelector(`[data-hist-detail="${idx}"]`);
      const open = detail.classList.toggle('open');
      head.classList.toggle('expanded', open);
    });
  });
  el.querySelectorAll('[data-hist-edit-toggle]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = btn.dataset.histEditToggle;
      const form = el.querySelector(`[data-hist-edit-form="${idx}"]`);
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  });
  el.querySelectorAll('[data-hist-delete]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const entry = shown[parseInt(btn.dataset.histDelete, 10)];
      if(!entry) return;
      // Two-tap confirm instead of a native confirm() dialog -- more reliable in a
      // standalone/home-screen web app, and consistent with the rest of the app
      // (every other delete here is a single, undo-free tap).
      if(btn.dataset.confirming !== 'true'){
        btn.dataset.confirming = 'true';
        btn.textContent = 'Tap again to delete';
        btn.style.background = '#B4472A';
        btn.style.color = '#fff';
        clearTimeout(btn._confirmTimeout);
        btn._confirmTimeout = setTimeout(()=>{
          btn.dataset.confirming = 'false';
          btn.textContent = '✕ Delete';
          btn.style.background = '';
          btn.style.color = '';
        }, 3000);
        return;
      }
      clearTimeout(btn._confirmTimeout);
      removeSessionLog(entry.date, entry.day);
      delete checkedState[entry.date + '_' + entry.day + '_done'];
      saveChecked();
      renderTally();
      renderDashboard();
      renderHistory();
      renderWeekPlan();
    });
  });
  el.querySelectorAll('[data-hist-save]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = parseInt(btn.dataset.histSave, 10);
      const entry = shown[idx];
      if(!entry) return;
      const updatedExercises = (entry.exercises || []).map((ex, exi) => {
        const input = el.querySelector(`[data-hist-weight="${idx}:${exi}"]`);
        return {name: ex.name, weight: input ? input.value : ex.weight};
      });
      const notesInput = el.querySelector(`[data-hist-notes="${idx}"]`);
      const notes = notesInput ? notesInput.value.trim() : entry.notes;
      upsertSessionLog(entry.date, entry.day, updatedExercises, notes, entry.stats);
      renderHistory();
      renderDashboard();
    });
  });
  el.querySelectorAll('[data-hist-edit-stats]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = parseInt(btn.dataset.histEditStats, 10);
      const entry = shown[idx];
      if(!entry) return;
      window.showView('train');
      setTimeout(()=>{
        openStatsForm(entry.day, entry.date);
      }, 80);
    });
  });
}

function renderTally(){
  const days = ['A','B','steady','interval'];
  const todayKeyPrefix = dateStrForOffset(0);
  let count = 0;
  days.forEach(d=>{
    if(checkedState[todayKeyPrefix + '_' + d + '_done']) count++;
  });
  document.getElementById('tallyLabel').textContent = `This week: ${Object.keys(checkedState).filter(k=>k.endsWith('_done') && checkedState[k]).length} sessions logged`;
  const marks = document.getElementById('tallyMarks');
  marks.innerHTML = '';
  const total = Math.max(4, Object.keys(checkedState).filter(k=>k.endsWith('_done') && checkedState[k]).length);
  for(let i=0;i<Math.min(total,12);i++){
    const m = document.createElement('div');
    m.className = 'tally-mark' + (i < Object.keys(checkedState).filter(k=>k.endsWith('_done') && checkedState[k]).length ? ' filled' : '');
    marks.appendChild(m);
  }
}

function renderStrength(day){
  const data = dayData[day];
  document.getElementById('strengthTitle').textContent = data.title;
  const list = document.getElementById('exerciseList');
  list.innerHTML = '';
  data.exercises.forEach(ex=>{
    const card = document.createElement('div');
    card.className = 'ex-card';
    const isDone = !!checkedState[ex.id];
    const savedW = (window.savedWeights && window.savedWeights[ex.id]) || '';
    card.innerHTML = `
      <div class="ex-head" data-id="${ex.id}">
        <div class="ex-icon"><img src="icons/${ex.icon}.png" alt="" loading="lazy" width="52" height="52"></div>
        <div class="ex-info">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-scheme">${ex.scheme}</div>
        </div>
        <svg class="caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        <button class="ex-check ${isDone?'done':''}" data-check="${ex.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
      </div>
      <div class="ex-detail" data-detail="${ex.id}">
        <div class="ex-detail-inner">
          <div class="ex-icon-large"><img src="icons/${ex.icon}.png" alt="" loading="lazy" width="110" height="110"></div>
          <strong>Form cue:</strong> ${ex.cue}
          <div>
            <a class="img-link" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(ex.name + ' proper form exercise')}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              See example photos
            </a>
          </div>
          <div class="weight-row">
            <label for="w-${ex.id}">Weight used (kg):</label>
            <input type="number" id="w-${ex.id}" data-weight="${ex.id}" value="${savedW}" placeholder="e.g. 8" min="0" step="0.5">
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
      const allDone = dayData[day].exercises.every(ex=>checkedState[ex.id]);
      const todayKey = dateStrForOffset(0) + '_' + day + '_done';
      checkedState[todayKey] = allDone;
      saveChecked();
      if(allDone){
        const snapshot = dayData[day].exercises.map(ex => ({
          name: ex.name,
          weight: (window.savedWeights && window.savedWeights[ex.id]) || ''
        }));
        upsertSessionLog(dateStrForOffset(0), day, snapshot);
      } else {
        removeSessionLog(dateStrForOffset(0), day);
      }
      renderTally();
      renderDashboard();
      renderHistory();
      renderWeekPlan();
    });
  });
  list.querySelectorAll('[data-weight]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      window.savedWeights = window.savedWeights || {};
      window.savedWeights[inp.dataset.weight] = inp.value;
      saveWeights();
      renderDashboard();
      renderHistory();
    });
  });

  const strengthExisting = historyLog.find(e => e.date === dateStrForOffset(0) && e.day === day);
  const strengthStats = strengthExisting ? strengthExisting.stats : null;
  const strengthStatsEl = document.getElementById('strengthStatsBlock');
  strengthStatsEl.innerHTML = `
    ${strengthStats ? `
    <div class="cardio-row" style="border-bottom:none;flex-wrap:wrap;gap:6px 14px;padding-bottom:8px;">
      ${strengthStats.duration ? `<span style="font-size:12px;color:var(--ink-soft);">⏱ ${strengthStats.duration}</span>` : ''}
      ${strengthStats.calories ? `<span style="font-size:12px;color:var(--ink-soft);">🔥 ${strengthStats.calories} kcal</span>` : ''}
      ${strengthStats.hr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ ${strengthStats.hr} bpm</span>` : ''}
      ${strengthStats.maxHr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ max ${strengthStats.maxHr} bpm</span>` : ''}
      ${strengthStats.trainingStress ? `<span style="font-size:12px;color:var(--ink-soft);">📈 TSS ${strengthStats.trainingStress}</span>` : ''}
      ${strengthStats.recoveryHr ? `<span style="font-size:12px;color:var(--ink-soft);">↘ HR recovery ${strengthStats.recoveryHr} bpm</span>` : ''}
    </div>` : ''}
    <button class="img-link" id="logStrengthStatsBtn" style="cursor:pointer;">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      ${strengthStats ? 'Edit watch stats' : 'Log stats from watch'}
    </button>
  `;
  document.getElementById('logStrengthStatsBtn').addEventListener('click', ()=> openStatsForm(day));

  const loggedNote = document.getElementById('strengthLoggedNote');
  if(loggedNote){
    loggedNote.textContent = strengthExisting
      ? `Logged today at ${new Date(strengthExisting.loggedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} (${strengthExisting.exercises.length} exercise${strengthExisting.exercises.length===1?'':'s'})`
      : '';
  }
  renderExtraExercises('strength');
}

function renderCardio(kind){
  const data = cardioData[kind];
  document.getElementById('cardioTitle').textContent = data.title;
  const el = document.getElementById('cardioContent');
  const query = kind === 'interval' ? 'treadmill interval walking incline' : 'treadmill incline walking zone 2';
  const todayStr = dateStrForOffset(0);
  const isDone = !!checkedState[todayStr + '_' + kind + '_done'];
  const existingEntry = historyLog.find(e => e.date === todayStr && e.day === kind);
  const stats = existingEntry ? existingEntry.stats : null;

  const statsSummary = stats ? `
    <div class="cardio-row" style="border-bottom:none;flex-wrap:wrap;gap:6px 14px;padding-top:10px;">
      ${stats.distance ? `<span style="font-size:12px;color:var(--ink-soft);">📍 ${stats.distance} km</span>` : ''}
      ${stats.duration ? `<span style="font-size:12px;color:var(--ink-soft);">⏱ ${stats.duration}</span>` : ''}
      ${stats.calories ? `<span style="font-size:12px;color:var(--ink-soft);">🔥 ${stats.calories} kcal</span>` : ''}
      ${stats.hr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ ${stats.hr} bpm</span>` : ''}
      ${stats.pace ? `<span style="font-size:12px;color:var(--ink-soft);">⚡ ${stats.pace}/km</span>` : ''}
      ${stats.steps ? `<span style="font-size:12px;color:var(--ink-soft);">👟 ${stats.steps} steps</span>` : ''}
      ${stats.maxHr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ max ${stats.maxHr} bpm</span>` : ''}
      ${stats.elevation ? `<span style="font-size:12px;color:var(--ink-soft);">⛰ ${stats.elevation} m</span>` : ''}
      ${stats.trainingStress ? `<span style="font-size:12px;color:var(--ink-soft);">📈 TSS ${stats.trainingStress}</span>` : ''}
      ${stats.recoveryHr ? `<span style="font-size:12px;color:var(--ink-soft);">↘ HR recovery ${stats.recoveryHr} bpm</span>` : ''}
      ${(stats.hrZones && (stats.hrZones.warmup || stats.hrZones.fatBurn || stats.hrZones.aerobic || stats.hrZones.anaerobic)) ? `<span style="font-size:12px;color:var(--ink-soft);">🎯 zones ${stats.hrZones.warmup||0}/${stats.hrZones.fatBurn||0}/${stats.hrZones.aerobic||0}/${stats.hrZones.anaerobic||0} min</span>` : ''}
    </div>` : '';

  el.innerHTML = `<div class="ex-icon-large" style="height:90px;"><svg viewBox="0 0 24 24" style="width:44px;height:44px;stroke:var(--forest-dark);"><path d="M3 19h18M6 19V9a2 2 0 012-2h8a2 2 0 012 2v10M9 19v-3M15 19v-3" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>` +
    data.phases.map(p=>`
      <div class="cardio-row">
        <div>
          <div class="cardio-phase">${p.phase}</div>
          <div class="cardio-detail">${p.detail}</div>
        </div>
        <div class="cardio-time">${p.time}</div>
      </div>
    `).join('') + statsSummary +
    `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
      <a class="img-link" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        See example setup
      </a>
      <button class="img-link" id="cardioDoneBtn" style="cursor:pointer;${isDone ? 'background:var(--forest);color:#F5F3EC;border-color:var(--forest);' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        ${isDone ? "Today's session logged" : 'Mark today done'}
      </button>
      <button class="img-link" id="logStatsBtn" style="cursor:pointer;">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        ${stats ? 'Edit watch stats' : 'Log stats from watch'}
      </button>
    </div>`;

  document.getElementById('cardioDoneBtn').addEventListener('click', ()=>{
    const nowDone = !checkedState[todayStr + '_' + kind + '_done'];
    checkedState[todayStr + '_' + kind + '_done'] = nowDone;
    saveChecked();
    if(nowDone){
      upsertSessionLog(todayStr, kind, []);
    } else {
      removeSessionLog(todayStr, kind);
    }
    renderTally();
    renderDashboard();
    renderHistory();
    renderWeekPlan();
    renderCardio(kind);
    renderLoggedToday();
    renderTodayGlance();
  });

  document.getElementById('logStatsBtn').addEventListener('click', ()=> openStatsForm(kind));
}

