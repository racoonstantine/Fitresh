/* ---------- Fasting (dedicated full-page timer + history) ---------- */
(function(){
  let fsSelectedDate = null;

  window.openFastingScreen = function(){
    editLockResetAll();
    fsSelectedDate = dateStrForOffset(0);
    document.getElementById('fsFactNote').textContent = randomFact(FASTING_FACTS);
    renderFastingScreenMain();
    renderFastingHistory();
    renderFsPastDayNav();
    document.getElementById('fastingScreen').style.display = 'flex';
  };
  function closeFastingScreen(){
    document.getElementById('fastingScreen').style.display = 'none';
  }
  document.getElementById('fastingScreenClose').addEventListener('click', closeFastingScreen);

  function renderFsPastDayNav(){
    const navEl = document.getElementById('fsPastDayNav');
    const todayStr = dateStrForOffset(0);
    const isToday = fsSelectedDate === todayStr;
    navEl.innerHTML = `
      <button class="day-nav-btn" id="fsPastPrevDay" type="button"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="day-nav-label">
        <div class="day-nav-date">${isToday ? 'Today' : formatDateLabel(fsSelectedDate)}</div>
        ${!isToday ? `<div class="day-nav-today-link" id="fsPastJumpToday">Jump to today</div>` : `<div style="font-size:11px;color:var(--ink-soft);">${formatDateLabel(fsSelectedDate)}</div>`}
      </div>
      <button class="day-nav-btn" id="fsPastNextDay" type="button" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    `;
    document.getElementById('fsPastPrevDay').addEventListener('click', ()=>{
      fsSelectedDate = addDaysToDate(fsSelectedDate, -1);
      renderFsPastDayNav();
      renderFsPastForm();
    });
    if(!isToday){
      document.getElementById('fsPastNextDay').addEventListener('click', ()=>{
        fsSelectedDate = addDaysToDate(fsSelectedDate, 1);
        renderFsPastDayNav();
        renderFsPastForm();
      });
      document.getElementById('fsPastJumpToday').addEventListener('click', ()=>{
        fsSelectedDate = todayStr;
        renderFsPastDayNav();
        renderFsPastForm();
      });
    }
    renderFsPastForm();
  }

  // Big headline summary for whichever day is currently selected in the
  // day-nav above -- shown between the date and the Start/End fields, so
  // navigating to a past day immediately surfaces that day's total fast and
  // how it stacked up against the goal, without scrolling to History.
  function renderFsDaySummary(){
    const el = document.getElementById('fsDaySummary');
    if(!el) return;
    const entry = nutritionLog.find(e => e.date === fsSelectedDate && e.fastHours && parseNum(e.fastHours) > 0);
    if(!entry){
      el.innerHTML = `<div style="font-size:12.5px;color:var(--ink-soft);">No fast logged for this day yet.</div>`;
      return;
    }
    const hours = parseNum(entry.fastHours);
    const goalHrs = fastingState.goalHours || 16;
    const pct = hours / goalHrs * 100;
    let commentary, color;
    if(pct >= 100 + 5){ commentary = 'Exceeded target'; color = 'var(--forest-dark)'; }
    else if(pct >= 100){ commentary = 'Goal Met'; color = 'var(--forest-dark)'; }
    else { commentary = 'Not Met'; color = '#B4472A'; }
    el.innerHTML = `
      <div style="font-family:var(--font-heading);font-size:34px;line-height:1.1;">${formatFastHours(hours)}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <div style="font-size:12.5px;color:var(--ink-soft);">${pct.toFixed(0)}% of ${goalHrs}h goal</div>
        <div style="font-size:12.5px;font-weight:700;color:${color};">${commentary}</div>
      </div>
    `;
  }

  function renderFsPastForm(){
    const pad2 = n => String(n).padStart(2,'0');
    const toLocalInput = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    document.getElementById('fsPastError').style.display = 'none';
    const existing = nutritionLog.find(e => e.date === fsSelectedDate && e.fastHours);
    const todayStr = dateStrForOffset(0);
    let end, hours;
    if(existing){
      hours = parseNum(existing.fastHours);
      // Exact start/end aren't stored for a plain duration -- reconstruct a
      // reasonable window (still freely editable) rather than leaving it blank.
      end = fsSelectedDate === todayStr ? new Date() : new Date(fsSelectedDate + 'T08:00:00');
    } else {
      hours = 16;
      end = fsSelectedDate === todayStr ? new Date() : new Date(fsSelectedDate + 'T08:00:00');
    }
    const start = new Date(end.getTime() - hours * 3600000);
    document.getElementById('fsPastStart').value = toLocalInput(start);
    document.getElementById('fsPastEnd').value = toLocalInput(end);
    renderFsDaySummary();
    applyEditLock(document.getElementById('fsEditBlock'), {
      key: 'fast:' + fsSelectedDate,
      baseLocked: fsSelectedDate !== todayStr && !!existing,
      summary: existing ? `⏱ <strong>${formatFastHours(parseNum(existing.fastHours))}</strong> fast logged` : '⏱ Fast logged'
    });
  }

  document.body.addEventListener('click', (e)=>{
    if(e.target.closest('.open-fasting-screen-link')) window.openFastingScreen();
  });

  let fsScreenTickInterval = null;
  function renderFastingScreenMain(){
    const card = document.getElementById('fsMainCard');
    clearInterval(fsScreenTickInterval);
    if(!fastingState.startIso){
      card.innerHTML = `
        <div style="text-align:center;padding:6px 0;">
          <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:12px;">Not fasting right now.</div>
          <label style="font-size:11px;color:var(--ink-soft);">Goal</label>
          <select id="fsGoalSelect" style="display:block;width:100%;margin:4px 0 14px;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);">
            <option value="12">12:12</option>
            <option value="14">14:10</option>
            <option value="16">16:8</option>
            <option value="18">18:6</option>
            <option value="20">20:4</option>
            <option value="24">24:0 (OMAD)</option>
          </select>
          <button class="timer-btn start" id="fsStartFastBtn" type="button" style="width:100%;">Start Fasting</button>
        </div>
      `;
      document.getElementById('fsGoalSelect').value = String(fastingState.goalHours || 16);
      document.getElementById('fsStartFastBtn').addEventListener('click', ()=>{
        fastingState = { startIso: new Date().toISOString(), goalHours: parseNum(document.getElementById('fsGoalSelect').value) || 16 };
        saveFasting();
        renderFasting();
        renderTodayGlance();
        renderFastingScreenMain();
      });
      return;
    }
    card.innerHTML = `
      <div style="text-align:center;">
        <div id="fsElapsed" style="font-family:var(--font-heading);font-size:38px;letter-spacing:.02em;">00:00:00</div>
        <div id="fsPct" style="font-size:12px;color:var(--ink-soft);margin-top:2px;">—</div>
        <div style="height:10px;border-radius:5px;background:var(--paper-raised);border:1px solid var(--line);overflow:hidden;margin:12px 0;">
          <div id="fsProgressBar" style="height:100%;width:0%;background:var(--forest);transition:width .3s;"></div>
        </div>
        <label style="font-size:11px;color:var(--ink-soft);display:block;text-align:left;">Start time</label>
        <input type="datetime-local" id="fsActiveStartInput" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);margin:2px 0 14px;box-sizing:border-box;">
        <button class="timer-btn reset" id="fsEndFastBtn" type="button" style="width:100%;">End Fast</button>
      </div>
    `;
    const pad2 = n => String(n).padStart(2,'0');
    const toLocalInput = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const startInput = document.getElementById('fsActiveStartInput');
    startInput.value = toLocalInput(new Date(fastingState.startIso));
    startInput.addEventListener('change', ()=>{
      const d = new Date(startInput.value);
      if(isNaN(d.getTime()) || d.getTime() > Date.now()){ startInput.value = toLocalInput(new Date(fastingState.startIso)); return; }
      fastingState.startIso = d.toISOString();
      saveFasting();
      renderTick();
      renderFasting();
      renderTodayGlance();
    });
    const renderTick = ()=>{
      const start = new Date(fastingState.startIso);
      const elapsedMs = Math.max(0, Date.now() - start.getTime());
      const elapsedHrs = elapsedMs / 3600000;
      const goalHrs = fastingState.goalHours || 16;
      const h = Math.floor(elapsedMs/3600000), m = Math.floor((elapsedMs%3600000)/60000), s = Math.floor((elapsedMs%60000)/1000);
      const targetEnd = new Date(start.getTime() + goalHrs * 3600000);
      document.getElementById('fsElapsed').textContent = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
      document.getElementById('fsProgressBar').style.width = Math.min(100, elapsedHrs/goalHrs*100) + '%';
      document.getElementById('fsPct').textContent = `${Math.min(100, elapsedHrs/goalHrs*100).toFixed(0)}% of ${goalHrs}h goal · ends ~${formatClockTime(targetEnd)}${elapsedHrs>=goalHrs ? ' — reached!' : ''}`;
    };
    renderTick();
    fsScreenTickInterval = setInterval(renderTick, 1000);
    document.getElementById('fsEndFastBtn').addEventListener('click', ()=>{
      const start = new Date(fastingState.startIso);
      const elapsedHrs = (Date.now() - start.getTime()) / 3600000;
      upsertNutritionFields(dateStrForOffset(0), { fastHours: elapsedHrs.toFixed(2) });
      fastingState = { startIso: null, goalHours: fastingState.goalHours || 16 };
      saveFasting();
      renderFasting();
      renderTodayGlance();
      renderFastingScreenMain();
      renderFastingHistory();
      renderFsDaySummary();
    });
  }

  document.getElementById('fsPastSaveBtn').addEventListener('click', ()=>{
    const errEl = document.getElementById('fsPastError');
    errEl.style.display = 'none';
    const startD = new Date(document.getElementById('fsPastStart').value);
    const endD = new Date(document.getElementById('fsPastEnd').value);
    if(isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD <= startD){
      errEl.textContent = 'End time must be after start time.';
      errEl.style.display = 'block';
      return;
    }
    const hours = (endD - startD) / 3600000;
    const dateKey = toLocalDateStr(endD);
    upsertNutritionFields(dateKey, { fastHours: hours.toFixed(2) });
    editLockRelock('fast:' + fsSelectedDate);
    editLockRelock('fast:' + dateKey);
    renderNutrition();
    renderTodayGlance();
    renderFastingHistory();
    renderFasting();
    renderFsPastForm();
    errEl.style.color = 'var(--forest-dark)';
    errEl.textContent = `Saved — ${formatFastHours(hours)} logged for ${formatDateLabel(dateKey)}.`;
    errEl.style.display = 'block';
  });

  function renderFastingHistory(){
    const fasts = nutritionLog
      .filter(e => e.fastHours && parseNum(e.fastHours) > 0)
      .map(e => ({date: e.date, hours: parseNum(e.fastHours)}))
      .sort((a,b)=> a.date < b.date ? 1 : -1);

    const chartEl = document.getElementById('fsHistoryChart');
    const recent = [...fasts].reverse().slice(-14);
    renderTrendLineChart(chartEl, recent.map(f => ({y: f.hours, label: formatDateLabel(f.date)})), {
      goalValue: fastingState.goalHours || 16, emptyText: 'Log a couple of fasts to see your trend.'
    });

    const listEl = document.getElementById('fsHistoryList');
    if(!fasts.length){
      listEl.innerHTML = `<div class="dash-empty">No fasts logged yet.</div>`;
    } else {
      listEl.innerHTML = fasts.slice(0, 10).map(f => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line);font-size:12.5px;">
          <span style="color:var(--ink-soft);">${formatDateLabel(f.date)}</span>
          <span style="font-weight:600;">${formatFastHours(f.hours)}</span>
        </div>
      `).join('');
    }
  }

  document.querySelector('[data-fs-history-toggle="1"]').addEventListener('click', function(){
    const detail = document.querySelector('[data-fs-history-detail="1"]');
    const open = detail.classList.toggle('open');
    this.classList.toggle('expanded', open);
  });
})();

/* ---------- Steps (dedicated full-page manual entry + history) ---------- */
(function(){
  let stepsSelectedDate = null;

  window.openStepsScreen = function(){
    editLockResetAll();
    stepsSelectedDate = dateStrForOffset(0);
    document.getElementById('stepsFactNote').textContent = randomFact(STEPS_FACTS);
    renderStepsDayNav();
    renderStepsHistory();
    document.getElementById('stepsScreen').style.display = 'flex';
  };
  function closeStepsScreen(){
    document.getElementById('stepsScreen').style.display = 'none';
  }
  document.getElementById('stepsScreenClose').addEventListener('click', closeStepsScreen);
  document.body.addEventListener('click', (e)=>{
    if(e.target.closest('.open-steps-screen-link')) window.openStepsScreen();
  });

  function renderStepsDayNav(){
    const navEl = document.getElementById('stepsDayNav');
    const todayStr = dateStrForOffset(0);
    const isToday = stepsSelectedDate === todayStr;
    navEl.innerHTML = `
      <button class="day-nav-btn" id="stepsPrevDay" type="button"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="day-nav-label">
        <div class="day-nav-date">${isToday ? 'Today' : formatDateLabel(stepsSelectedDate)}</div>
        ${!isToday ? `<div class="day-nav-today-link" id="stepsJumpToday">Jump to today</div>` : `<div style="font-size:11px;color:var(--ink-soft);">${formatDateLabel(stepsSelectedDate)}</div>`}
      </div>
      <button class="day-nav-btn" id="stepsNextDay" type="button" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    `;
    document.getElementById('stepsPrevDay').addEventListener('click', ()=>{
      stepsSelectedDate = addDaysToDate(stepsSelectedDate, -1);
      renderStepsDayNav();
    });
    if(!isToday){
      document.getElementById('stepsNextDay').addEventListener('click', ()=>{
        stepsSelectedDate = addDaysToDate(stepsSelectedDate, 1);
        renderStepsDayNav();
      });
      document.getElementById('stepsJumpToday').addEventListener('click', ()=>{
        stepsSelectedDate = todayStr;
        renderStepsDayNav();
      });
    }
    renderStepsForm();
  }

  function renderStepsForm(){
    document.getElementById('stepsError').style.display = 'none';
    const logged = stepsLog[stepsSelectedDate];
    document.getElementById('stepsCountInput').value = logged || '';
    // A past day that already has steps logged is shown read-only until the
    // pencil Edit button is pressed.
    applyEditLock(document.getElementById('stepsEditBlock'), {
      key: 'steps:' + stepsSelectedDate,
      baseLocked: stepsSelectedDate !== dateStrForOffset(0) && logged !== undefined,
      summary: `👟 <strong>${fmtNum(logged)}</strong> steps logged`
    });
  }

  document.getElementById('stepsSaveBtn').addEventListener('click', ()=>{
    const errEl = document.getElementById('stepsError');
    errEl.style.display = 'none';
    const count = parseInt(document.getElementById('stepsCountInput').value, 10);
    if(isNaN(count) || count < 0){
      errEl.textContent = 'Enter a valid step count.';
      errEl.style.display = 'block';
      return;
    }
    stepsLog[stepsSelectedDate] = count;
    saveStepsLog();
    editLockRelock('steps:' + stepsSelectedDate);
    renderStepsForm();
    renderStepsHistory();
    renderTodayGlance();
    renderDashboard();
    errEl.style.color = 'var(--forest-dark)';
    errEl.textContent = `Saved — ${fmtNum(count)} steps logged for ${formatDateLabel(stepsSelectedDate)}.`;
    errEl.style.display = 'block';
  });

  function renderStepsHistory(){
    const entries = Object.entries(stepsLog)
      .map(([date, count]) => ({date, count}))
      .sort((a,b)=> a.date < b.date ? 1 : -1);

    const chartEl = document.getElementById('stepsChart');
    const recent = [...entries].reverse().slice(-14);
    renderTrendLineChart(chartEl, recent.map(s => ({y: s.count, label: formatDateLabel(s.date)})), {
      color: '#4A90D9', dotColor: '#2E6DA8',
      goalValue: (userHealthTargets && userHealthTargets.stepsGoal) || 10000,
      emptyText: 'Log a couple of days to see your trend.'
    });

    const listEl = document.getElementById('stepsHistoryList');
    if(!entries.length){
      listEl.innerHTML = `<div class="dash-empty">No steps logged yet.</div>`;
    } else {
      listEl.innerHTML = entries.slice(0, 10).map(s => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line);font-size:12.5px;">
          <span style="color:var(--ink-soft);">${formatDateLabel(s.date)}</span>
          <span style="font-weight:600;">${fmtNum(s.count)}</span>
        </div>
      `).join('');
    }
  }

  document.querySelector('[data-steps-history-toggle="1"]').addEventListener('click', function(){
    const detail = document.querySelector('[data-steps-history-detail="1"]');
    const open = detail.classList.toggle('open');
    this.classList.toggle('expanded', open);
  });
})();

/* ---------- Sleep (dedicated full-page day-nav editor + history) ---------- */
(function(){
  let sleepSelectedDate = null;

  window.openSleepScreen = function(){
    editLockResetAll();
    sleepSelectedDate = dateStrForOffset(0);
    document.getElementById('sleepFactNote').textContent = randomFact(SLEEP_FACTS);
    renderSleepDayNav();
    renderSleepHistory();
    document.getElementById('sleepScreen').style.display = 'flex';
  };
  function closeSleepScreen(){
    document.getElementById('sleepScreen').style.display = 'none';
  }
  document.getElementById('sleepScreenClose').addEventListener('click', closeSleepScreen);
  document.body.addEventListener('click', (e)=>{
    if(e.target.closest('.open-sleep-screen-link')) window.openSleepScreen();
  });

  function renderSleepDayNav(){
    const navEl = document.getElementById('sleepDayNav');
    const todayStr = dateStrForOffset(0);
    const isToday = sleepSelectedDate === todayStr;
    navEl.innerHTML = `
      <button class="day-nav-btn" id="sleepPrevDay" type="button"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="day-nav-label">
        <div class="day-nav-date">${isToday ? 'Today' : formatDateLabel(sleepSelectedDate)}</div>
        ${!isToday ? `<div class="day-nav-today-link" id="sleepJumpToday">Jump to today</div>` : `<div style="font-size:11px;color:var(--ink-soft);">${formatDateLabel(sleepSelectedDate)}</div>`}
      </div>
      <button class="day-nav-btn" id="sleepNextDay" type="button" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    `;
    document.getElementById('sleepPrevDay').addEventListener('click', ()=>{
      sleepSelectedDate = addDaysToDate(sleepSelectedDate, -1);
      renderSleepDayNav();
    });
    if(!isToday){
      document.getElementById('sleepNextDay').addEventListener('click', ()=>{
        sleepSelectedDate = addDaysToDate(sleepSelectedDate, 1);
        renderSleepDayNav();
      });
      document.getElementById('sleepJumpToday').addEventListener('click', ()=>{
        sleepSelectedDate = todayStr;
        renderSleepDayNav();
      });
    }
    renderSleepForm();
  }

  function renderSleepForm(){
    document.getElementById('sleepScreenError').style.display = 'none';
    const pad2 = n => String(n).padStart(2,'0');
    const toLocalInput = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const existing = sleepLog[sleepSelectedDate];
    let start, end;
    if(existing && existing.startIso && existing.endIso){
      start = new Date(existing.startIso);
      end = new Date(existing.endIso);
    } else {
      end = new Date(sleepSelectedDate + 'T07:00:00');
      start = new Date(end.getTime() - 8 * 3600000);
    }
    document.getElementById('sleepStartInputScreen').value = toLocalInput(start);
    document.getElementById('sleepEndInputScreen').value = toLocalInput(end);
    updateSleepTotalDisplay();
    applyEditLock(document.getElementById('sleepEditBlock'), {
      key: 'sleep:' + sleepSelectedDate,
      baseLocked: sleepSelectedDate !== dateStrForOffset(0) && !!(existing && existing.startIso && existing.endIso),
      summary: existing && existing.hours ? `😴 <strong>${formatSleepHours(existing.hours)}</strong> logged` : '😴 Sleep logged'
    });
  }

  function updateSleepTotalDisplay(){
    const valEl = document.getElementById('sleepTotalHoursValue');
    const noteEl = document.getElementById('sleepTotalHoursCommentary');
    if(!valEl) return;
    const startD = new Date(document.getElementById('sleepStartInputScreen').value);
    const endD = new Date(document.getElementById('sleepEndInputScreen').value);
    if(isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD <= startD){
      valEl.textContent = '—';
      noteEl.textContent = endD <= startD && !isNaN(startD.getTime()) && !isNaN(endD.getTime()) ? 'Wake time must be after bedtime.' : '';
      return;
    }
    const hours = (endD - startD) / 3600000;
    const goalHours = (userProfile && userProfile.sleepGoalHours) || 8;
    valEl.textContent = formatSleepHours(hours);
    const diff = hours - goalHours;
    if(Math.abs(diff) < 0.25){
      noteEl.textContent = `✓ Right at your ${goalHours}h goal.`;
    } else if(diff < 0){
      noteEl.textContent = `${formatSleepHours(Math.abs(diff))} under your ${goalHours}h goal.`;
    } else {
      noteEl.textContent = `${formatSleepHours(diff)} over your ${goalHours}h goal.`;
    }
  }
  ['sleepStartInputScreen', 'sleepEndInputScreen'].forEach(id=>{
    document.getElementById(id).addEventListener('input', updateSleepTotalDisplay);
  });

  document.getElementById('sleepScreenSaveBtn').addEventListener('click', ()=>{
    const errEl = document.getElementById('sleepScreenError');
    errEl.style.display = 'none';
    const startD = new Date(document.getElementById('sleepStartInputScreen').value);
    const endD = new Date(document.getElementById('sleepEndInputScreen').value);
    if(isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD <= startD){
      errEl.textContent = 'Wake time must be after bedtime.';
      errEl.style.display = 'block';
      return;
    }
    const hours = (endD - startD) / 3600000;
    sleepLog[sleepSelectedDate] = { startIso: startD.toISOString(), endIso: endD.toISOString(), hours };
    saveSleepLog();
    editLockRelock('sleep:' + sleepSelectedDate);
    renderSleepForm();
    renderSleepHistory();
    renderTodayGlance();
    renderBodySleepCard();
    errEl.style.color = 'var(--forest-dark)';
    errEl.textContent = `Saved — ${formatSleepHours(hours)} logged for ${formatDateLabel(sleepSelectedDate)}.`;
    errEl.style.display = 'block';
  });

  function renderSleepHistory(){
    const entries = Object.entries(sleepLog)
      .map(([date, s]) => ({date, hours: s.hours}))
      .sort((a,b)=> a.date < b.date ? 1 : -1);

    const chartEl = document.getElementById('sleepScreenChart');
    const recent = [...entries].reverse().slice(-14);
    renderTrendLineChart(chartEl, recent.map(s => ({y: s.hours, label: formatDateLabel(s.date)})), {
      goalValue: (userProfile && userProfile.sleepGoalHours) || 8,
      emptyText: 'Log a couple of nights to see your trend.'
    });

    const listEl = document.getElementById('sleepScreenHistoryList');
    if(!entries.length){
      listEl.innerHTML = `<div class="dash-empty">No sleep logged yet.</div>`;
    } else {
      listEl.innerHTML = entries.slice(0, 10).map(s => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line);font-size:12.5px;">
          <span style="color:var(--ink-soft);">${formatDateLabel(s.date)}</span>
          <span style="font-weight:600;">${formatSleepHours(s.hours)}</span>
        </div>
      `).join('');
    }
  }

  document.querySelector('[data-sleep-history-toggle="1"]').addEventListener('click', function(){
    const detail = document.querySelector('[data-sleep-history-detail="1"]');
    const open = detail.classList.toggle('open');
    this.classList.toggle('expanded', open);
  });
})();

