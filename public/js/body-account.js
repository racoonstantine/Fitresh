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
      ? `${fmtNum(t.recommendedCalorieTarget)} kcal maintenance, less a deficit toward your goal weight.`
      : (t.goalDirection === 'gain'
        ? `${fmtNum(t.recommendedCalorieTarget)} kcal, a surplus toward your goal weight.`
        : `${fmtNum(t.recommendedCalorieTarget)} kcal maintenance.`);
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

// "Help improve the food list": whether this user's AI Assist / My Entry foods
// may be included in the admin's twice-monthly review. Off unless switched on.
let userSharing = {foods: false};
async function loadSharing(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'sharing', false);
    const parsed = res && res.value ? JSON.parse(res.value) : null;
    userSharing = {foods: !!(parsed && parsed.foods === true)};
  }catch(e){ userSharing = {foods: false}; }
}
async function saveSharing(){
  return window.storage.set(STORAGE_PREFIX + 'sharing', JSON.stringify(userSharing), false);
}
document.getElementById('acctShareFoods').addEventListener('change', async (e)=>{
  const statusEl = document.getElementById('acctShareStatus');
  userSharing = {foods: e.target.checked};
  statusEl.textContent = 'Saving…';
  const ok = await saveSharing();
  statusEl.textContent = ok ? (userSharing.foods ? 'Thanks — your AI Assist and My Entry foods will be included.' : 'Okay — your foods are not included.') : 'Could not save that — try again.';
  if(!ok){ userSharing = {foods: !e.target.checked}; e.target.checked = userSharing.foods; }
});

function renderAccountSettings(){
  document.getElementById('acctShareFoods').checked = !!userSharing.foods;
  document.getElementById('acctShareStatus').textContent = '';
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
// Filters the admin table rows by name, username or email as you type.
function applyAdminFilter(){
  const input = document.getElementById('adminFilter');
  const q = input ? input.value.trim().toLowerCase() : '';
  const rows = document.querySelectorAll('#adminUserList [data-admin-row]');
  let shown = 0;
  rows.forEach(row => {
    const match = !q || row.dataset.adminRow.includes(q);
    row.style.display = match ? '' : 'none';
    if(match) shown++;
  });
  const statusEl = document.getElementById('adminStatus');
  if(statusEl && rows.length){
    statusEl.textContent = q ? `${shown} of ${rows.length} account${rows.length === 1 ? '' : 's'}.` : `${rows.length} account${rows.length === 1 ? '' : 's'}.`;
  }
}
document.getElementById('adminFilter').addEventListener('input', applyAdminFilter);

// ---- Food review (admin): shared AI Assist / My Entry foods ----
async function renderAdminFoodReview(){
  const statusEl = document.getElementById('adminReviewStatus');
  const listEl = document.getElementById('adminReviewList');
  statusEl.textContent = 'Loading…';
  listEl.innerHTML = '';
  try{
    const {ok, data} = await safeFetchJson('api/food_review.php?action=candidates', {credentials: 'same-origin'});
    if(!ok || data.error) throw new Error(data.error || 'Could not load the food review.');
    if(!data.available){
      statusEl.textContent = 'Food review needs database migration 007 (db/migrations/007_food_review.sql) before it can run.';
      return;
    }
    const rows = data.candidates;
    statusEl.textContent = `${data.opted_in} user${data.opted_in === 1 ? '' : 's'} opted in · ${rows.length} food${rows.length === 1 ? '' : 's'} to review.`;
    if(!rows.length){
      listEl.innerHTML = '<div class="dash-empty">Nothing to review yet — a food appears here once ' + data.min_users + ' different opted-in users have made it.</div>';
      return;
    }
    const med = (c, code) => c.nutrients[code] ? fmtNumMax(c.nutrients[code].median) : '—';
    listEl.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Food</th><th class="num">Users</th><th>Mix</th><th class="num">kcal</th><th class="num">P</th><th class="num">F</th><th class="num">C</th><th></th></tr></thead>
          <tbody>${rows.map(c => `
            <tr>
              <td><div class="ad-name">${foodSearchEscape(c.name)}${c.status === 'sent' ? ' <span>· sent</span>' : ''}</div><div class="ad-email">${foodSearchEscape(c.basis)}</div></td>
              <td class="num">${c.users}</td>
              <td class="nowrap">${c.ai_users ? `<span class="food-tag food-tag-ai">AI ${c.ai_users}</span>` : ''}${c.manual_users ? `<span class="food-tag food-tag-mine">Mine ${c.manual_users}</span>` : ''}</td>
              <td class="num" title="range ${c.nutrients.ENERC_KCAL ? c.nutrients.ENERC_KCAL.min + '–' + c.nutrients.ENERC_KCAL.max : '—'}">${med(c, 'ENERC_KCAL')}${c.flag === 'high_variance' ? ` <span class="ad-flag" title="Users disagree by about ${c.kcal_spread_pct}% on calories">⚠ ±${c.kcal_spread_pct}%</span>` : ''}</td>
              <td class="num">${med(c, 'PROCNT')}</td><td class="num">${med(c, 'FAT')}</td><td class="num">${med(c, 'CHOCDF')}</td>
              <td class="act nowrap">
                <button type="button" class="ad-btn" data-review-decide="reviewed" data-review-key="${foodSearchEscape(c.key)}" data-review-unit="${foodSearchEscape(c.unit_kind)}" title="Mark as reviewed (removes it from this list)">Reviewed</button>
                <button type="button" class="ad-btn" data-review-decide="dismissed" data-review-key="${foodSearchEscape(c.key)}" data-review-unit="${foodSearchEscape(c.unit_kind)}" title="Dismiss (removes it from this list)">Dismiss</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }catch(err){
    statusEl.textContent = err.message || 'Could not load the food review.';
  }
}
document.getElementById('adminReviewList').addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-review-decide]');
  if(!btn) return;
  btn.disabled = true;
  try{
    const {ok, data} = await safeFetchJson('api/food_review.php', {
      method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'decide', norm_key: btn.dataset.reviewKey, unit_kind: btn.dataset.reviewUnit, decision: btn.dataset.reviewDecide})
    });
    if(!ok || data.error) throw new Error(data.error || 'Could not save that.');
    renderAdminFoodReview();
  }catch(err){
    alert(err.message || 'Could not save that.');
    btn.disabled = false;
  }
});

async function renderAdminPanel(){
  const statusEl = document.getElementById('adminStatus');
  const listEl = document.getElementById('adminUserList');
  statusEl.textContent = 'Loading…';
  listEl.innerHTML = '';
  try{
    const {ok, data} = await safeFetchJson('api/admin.php?action=overview', {credentials: 'same-origin'});
    if(!ok || data.error) throw new Error(data.error || 'Could not load the user list.');
    statusEl.textContent = `${data.users.length} account${data.users.length === 1 ? '' : 's'}.`;
    document.getElementById('adminFilter').value = '';
    const statusLabel = {approved: 'Approved', pending: 'Pending', rejected: 'Rejected'};
    const shortDate = iso => { const d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: '2-digit'}); };
    // A compact table: one line per account instead of a card each.
    listEl.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>User</th><th>Status</th><th>Joined</th><th class="num">Days</th><th></th></tr></thead>
          <tbody>${data.users.map(u => `
            <tr data-admin-row="${foodSearchEscape((u.display_name + ' ' + (u.username || '') + ' ' + u.email).toLowerCase())}">
              <td><div class="ad-name">${foodSearchEscape(u.display_name)}${u.username ? ` <span>@${foodSearchEscape(u.username)}</span>` : ''}</div><div class="ad-email">${foodSearchEscape(u.email)}</div></td>
              <td><span class="ad-status ad-status-${foodSearchEscape(u.status)}">${statusLabel[u.status] || foodSearchEscape(u.status)}</span></td>
              <td class="nowrap">${shortDate(u.created_at)}</td>
              <td class="num">${u.days_logged}</td>
              <td class="act"><button type="button" class="ad-btn" data-admin-reset="${u.id}" data-admin-email="${foodSearchEscape(u.email)}" title="Reset password for ${foodSearchEscape(u.email)}">Reset</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    applyAdminFilter();
    renderAdminFoodReview();
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
  btn.textContent = '…';
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
    btn.textContent = 'Reset';
  }
});

