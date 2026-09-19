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
      s.calories ? `Calories: ${fmtNum(s.calories)} kcal` : '',
      s.hr ? `Avg HR: ${s.hr} bpm` : '',
      s.pace ? `Pace: ${s.pace}/km` : '',
      s.steps ? `Steps: ${fmtNum(s.steps)}` : ''
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
            <button class="img-link" data-hist-edit-toggle="${idx}" type="button" style="cursor:pointer;flex:1;">✎ Edit</button>
          </div>
          <div data-hist-edit-form="${idx}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
            ${editExRows}
            <label style="font-size:11px;color:var(--ink-soft);display:block;margin-top:8px;">Notes</label>
            <textarea data-hist-notes="${idx}" rows="2" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;font-family:var(--font-body);margin-top:2px;">${entry.notes || ''}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="timer-btn start" data-hist-save="${idx}" type="button" style="flex:1;">Save changes</button>
              <button class="timer-btn reset" data-hist-edit-stats="${idx}" type="button" style="flex:1;">Edit watch stats</button>
              <button class="wi-del" data-hist-delete="${idx}" type="button" title="Delete session">✕ Delete</button>
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
            <input type="text" inputmode="decimal" data-num id="w-${ex.id}" data-weight="${ex.id}" value="${savedW}" placeholder="e.g. 8" min="0" step="0.5">
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
      ${strengthStats.calories ? `<span style="font-size:12px;color:var(--ink-soft);">🔥 ${fmtNum(strengthStats.calories)} kcal</span>` : ''}
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
      ${stats.calories ? `<span style="font-size:12px;color:var(--ink-soft);">🔥 ${fmtNum(stats.calories)} kcal</span>` : ''}
      ${stats.hr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ ${stats.hr} bpm</span>` : ''}
      ${stats.pace ? `<span style="font-size:12px;color:var(--ink-soft);">⚡ ${stats.pace}/km</span>` : ''}
      ${stats.steps ? `<span style="font-size:12px;color:var(--ink-soft);">👟 ${fmtNum(stats.steps)} steps</span>` : ''}
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
    `).join('') + statsSummary + cardioActivityControlsHtml() +
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
      upsertSessionLog(todayStr, kind, syncCardioExercise([], existingEntry ? existingEntry.stats : null));
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
  wireCardioActivityControls(kind);
}

