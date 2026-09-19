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
        <div class="dash-card"><div class="dash-num">${fmtNum(t.calorieTarget)}</div><div class="dash-label">Daily kcal target</div></div>
        <div class="dash-card"><div class="dash-num">${t.proteinTarget}g</div><div class="dash-label">Protein target</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap;">
        <span class="tag ${bmiTagClass}">${t.bmiCategory}</span>
        <span style="font-size:12.5px;color:var(--ink-soft);">${directionLabel}</span>
      </div>
      <div style="font-size:12px;color:var(--ink-soft);margin-top:10px;">Resting (BMR) ${fmtNum(t.bmr)} kcal · Active (TDEE) ${fmtNum(t.tdee)} kcal · Water target ${(t.waterGoalMl/1000).toFixed(1)} L</div>
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
    const vals = nutriEntries.map(e=>parseNum(e[key])).filter(v=>!isNaN(v));
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
    <div class="dash-card"><div class="dash-num">${avgCal !== null ? fmtNum(avgCal) : '—'}</div><div class="dash-label">Avg kcal</div></div>
    <div class="dash-card"><div class="dash-num">${avgProtein !== null ? avgProtein.toFixed(1) : '—'}</div><div class="dash-label">Avg protein (g)</div></div>
    <div class="dash-card"><div class="dash-num">${avgFast !== null ? formatFastHours(avgFast) : '—'}</div><div class="dash-label">Avg fast</div></div>
    <div class="dash-card"><div class="dash-num">${weightChange !== null ? (weightChange > 0 ? '+' : '') + formatWeightKg(weightChange) : '—'}</div><div class="dash-label">Weight change</div></div>
    <div class="dash-card"><div class="dash-num">${nutriEntries.length}</div><div class="dash-label">Days nutrition logged</div></div>
    <div class="dash-card"><div class="dash-num">${avgSleep !== null ? formatSleepHours(avgSleep) : '—'}</div><div class="dash-label">Avg sleep</div></div>
    <div class="dash-card"><div class="dash-num">${avgSteps !== null ? fmtNum(avgSteps) : '—'}</div><div class="dash-label">Avg steps</div></div>
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
        <div style="flex:0 0 60px;flex-shrink:0;text-align:right;color:${n && n.calories ? (parseNum(n.calories) >= getTargets(d).calMin ? 'var(--forest-dark)' : '#B4472A') : 'var(--ink-soft)'};">${n && n.calories ? n.calories+'k' : '—'}</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;color:var(--ink);">${wt ? formatWeightKg(wt.kg) : '—'}</div>
        <div style="flex:0 0 50px;flex-shrink:0;text-align:right;color:var(--ink-soft);">${n && n.fastHours ? formatFastHours(parseNum(n.fastHours)) : '—'}</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;color:var(--ink-soft);">${sl ? formatSleepHours(sl.hours) : '—'}</div>
        <div style="flex:0 0 55px;flex-shrink:0;text-align:right;color:var(--ink-soft);">${st !== undefined ? fmtNum(st) : '—'}</div>
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
  const w = 300, h = 150, padL = 38, padR = 8, padT = 10, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xStep = plotW / (points.length - 1);
  const yFor = v => padT + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
  const xFor = i => padL + i * xStep;

  const gridLines = ticks.map(t => `
    <line x1="${padL}" y1="${yFor(t)}" x2="${w - padR}" y2="${yFor(t)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${padL - 6}" y="${yFor(t) + 3}" text-anchor="end" font-size="9" fill="var(--ink-soft)">${fmtNumMax(t)}</text>
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

