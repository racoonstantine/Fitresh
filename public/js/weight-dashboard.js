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

