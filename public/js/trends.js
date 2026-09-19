// Which macros are plotted on the weekly/monthly nutrition trend chart --
// module-level so the choice survives a re-render (toggling a checkbox) but
// resets on a full page load. Calories on by default per the original ask;
// everything else is opt-in since plotting them all at once gets noisy.
let nutriTrendVisible = {calories: true, protein: false, fat: false, carbs: false, sodium: false, fiber: false};
const NUTRI_TREND_SERIES = [
  {key: 'calories', label: 'Calories', color: '#2F6F4E', target: t => t.calMax},
  {key: 'protein', label: 'Protein', color: '#B4472A', target: t => t.proteinMax},
  {key: 'fat', label: 'Fat', color: '#C9962C', target: t => t.fatMax},
  {key: 'carbs', label: 'Carbs', color: '#6B5B95', target: t => t.carbsMax},
  {key: 'sodium', label: 'Sodium', color: '#3D7A99', target: t => t.sodiumMax},
  {key: 'fiber', label: 'Fiber', color: '#8A6D3B', target: t => t.fiberTarget}
];
function renderNutritionTrendChart(chartEl, range, dateList, sorted){
  if(!chartEl) return;
  if(range === 'day'){ chartEl.innerHTML = ''; return; }

  const legendHtml = NUTRI_TREND_SERIES.map(s => `
    <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-soft);margin-right:10px;margin-bottom:4px;cursor:pointer;">
      <input type="checkbox" data-trend-toggle="${s.key}" ${nutriTrendVisible[s.key] ? 'checked' : ''} style="accent-color:${s.color};">
      <span style="width:9px;height:9px;border-radius:50%;background:${s.color};display:inline-block;"></span>${s.label}
    </label>
  `).join('');
  const wireToggles = ()=>{
    chartEl.querySelectorAll('[data-trend-toggle]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        nutriTrendVisible[cb.dataset.trendToggle] = cb.checked;
        renderNutritionTrendChart(chartEl, range, dateList, sorted);
      });
    });
  };

  // dateList is newest-first (today, today-1, ...); the chart reads left-to-right.
  const chronoDates = [...dateList].reverse();
  const dayTotals = chronoDates.map(d => ({date: d, ...combinedDayTotals(d, sorted.find(e => e.date === d)), targets: getTargets(d)}));
  const activeSeries = NUTRI_TREND_SERIES.filter(s => nutriTrendVisible[s.key]);

  if(!activeSeries.length){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Tick a macro above to see its trend.</div>`;
    wireToggles();
    return;
  }
  if(dayTotals.filter(d => d.hasAny).length < 2){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Log at least 2 days in this range to see a trend.</div>`;
    wireToggles();
    return;
  }

  const w = 300, h = 150, padL = 34, padR = 8, padT = 10, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xStep = dayTotals.length > 1 ? plotW / (dayTotals.length - 1) : 0;
  const xFor = i => padL + i * xStep;

  // Different macros live on wildly different scales (calories in the
  // thousands, fiber in tens of grams) -- plotting raw values on one axis
  // would flatten the small ones to nothing, so every series is normalized
  // to "% of that day's target" and shares a 0-150%-ish axis instead.
  const allPct = [];
  const seriesPoints = activeSeries.map(s => {
    const pts = dayTotals.map((d, i) => {
      const val = d[s.key] || 0;
      const target = s.target(d.targets) || 1;
      const pct = (val / target) * 100;
      if(d.hasAny) allPct.push(pct);
      return {x: xFor(i), pct, has: d.hasAny};
    });
    return {series: s, pts};
  });
  const ticks = niceTicks(0, Math.max(100, ...allPct, 10), 4);
  const maxV = ticks[ticks.length - 1];
  const yFor = pct => padT + plotH - (pct / (maxV || 1)) * plotH;

  const gridLines = ticks.map(t => `
    <line x1="${padL}" y1="${yFor(t)}" x2="${w - padR}" y2="${yFor(t)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${padL - 6}" y="${yFor(t) + 3}" text-anchor="end" font-size="9" fill="var(--ink-soft)">${t}%</text>
  `).join('');
  const targetLine = `<line x1="${padL}" y1="${yFor(100)}" x2="${w - padR}" y2="${yFor(100)}" stroke="var(--ochre)" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  const linesHtml = seriesPoints.map(({series, pts}) => {
    const validPts = pts.filter(p => p.has);
    if(validPts.length < 2) return '';
    const linePoints = validPts.map(p => `${p.x},${yFor(p.pct)}`).join(' ');
    const dots = validPts.map(p => `<circle cx="${p.x}" cy="${yFor(p.pct)}" r="3" fill="${series.color}"/>`).join('');
    return `<polyline points="${linePoints}" fill="none" stroke="${series.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join('');
  const labelIdxs = dayTotals.length <= 6 ? dayTotals.map((_, i) => i) : [0, Math.round((dayTotals.length - 1) / 2), dayTotals.length - 1];
  const xLabels = labelIdxs.map(i => `<text x="${xFor(i)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${formatDateLabel(dayTotals[i].date)}</text>`).join('');

  chartEl.innerHTML = `
    <div style="margin-bottom:6px;">${legendHtml}</div>
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;overflow:visible;">
      ${gridLines}
      ${targetLine}
      ${linesHtml}
      ${xLabels}
    </svg>
    <div style="font-size:10.5px;color:var(--ochre);text-align:right;margin-top:2px;">- - - 100% of daily target</div>
  `;
  wireToggles();
}

// Which stats are plotted on the Workout Dashboard's weekly/monthly trend
// chart -- same toggle pattern as the nutrition trend chart. Kcal burned is
// on by default; the rest are opt-in.
let workoutTrendVisible = {calories: true, hr: false, steps: false, distance: false, recovery: false};
const WORKOUT_TREND_SERIES = [
  {key: 'calories', label: 'Kcal Burned', color: '#2F6F4E'},
  {key: 'hr', label: 'Avg HR', color: '#B4472A'},
  {key: 'steps', label: 'Steps', color: '#4A90D9'},
  {key: 'distance', label: 'Distance', color: '#6B5B95'},
  {key: 'recovery', label: 'Recovery', color: '#3D7A99'}
];
function dayWorkoutStatTotals(dStr){
  const dayEntries = historyLog.filter(e => e.date === dStr && e.stats);
  const calories = dayEntries.reduce((sum, e) => sum + (parseNum(e.stats.calories) || 0), 0);
  const distance = dayEntries.reduce((sum, e) => sum + (parseNum(e.stats.distance) || 0), 0);
  const hrList = dayEntries.filter(e => e.stats.hr).map(e => parseNum(e.stats.hr));
  const hr = hrList.length ? hrList.reduce((a, b) => a + b, 0) / hrList.length : 0;
  const recoveryList = dayEntries.filter(e => e.stats.recoveryHr).map(e => parseNum(e.stats.recoveryHr));
  const recovery = recoveryList.length ? recoveryList.reduce((a, b) => a + b, 0) / recoveryList.length : 0;
  const steps = stepsLog[dStr] || 0;
  return {calories, hr, steps, distance, recovery, hasAny: calories > 0 || hr > 0 || steps > 0 || distance > 0 || recovery > 0};
}
function renderWorkoutTrendChart(chartEl, range, windowDays){
  if(!chartEl) return;
  if(range === 'day'){ chartEl.innerHTML = ''; return; }

  const legendHtml = WORKOUT_TREND_SERIES.map(s => `
    <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-soft);margin-right:10px;margin-bottom:4px;cursor:pointer;">
      <input type="checkbox" data-workout-trend-toggle="${s.key}" ${workoutTrendVisible[s.key] ? 'checked' : ''} style="accent-color:${s.color};">
      <span style="width:9px;height:9px;border-radius:50%;background:${s.color};display:inline-block;"></span>${s.label}
    </label>
  `).join('');
  const wireToggles = ()=>{
    chartEl.querySelectorAll('[data-workout-trend-toggle]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        workoutTrendVisible[cb.dataset.workoutTrendToggle] = cb.checked;
        renderWorkoutTrendChart(chartEl, range, windowDays);
      });
    });
  };

  const dates = []; for(let i = windowDays - 1; i >= 0; i--) dates.push(dateStrForOffset(-i));
  const dayStats = dates.map(d => ({date: d, ...dayWorkoutStatTotals(d)}));
  const activeSeries = WORKOUT_TREND_SERIES.filter(s => workoutTrendVisible[s.key]);

  if(!activeSeries.length){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Tick a stat above to see its trend.</div>`;
    wireToggles();
    return;
  }
  if(dayStats.filter(d => d.hasAny).length < 2){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Log stats for at least 2 days in this range to see a trend.</div>`;
    wireToggles();
    return;
  }

  const w = 300, h = 150, padL = 34, padR = 8, padT = 10, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xStep = dayStats.length > 1 ? plotW / (dayStats.length - 1) : 0;
  const xFor = i => padL + i * xStep;

  // Kcal/HR/steps/distance/recovery all live on very different scales, so
  // each series is normalized to % of its own max value in the visible
  // window rather than sharing a raw axis -- there's no fixed "target" for
  // these the way there is for nutrition macros, so this is relative
  // (shape of the trend), not absolute.
  const seriesPoints = activeSeries.map(s => {
    const maxVal = Math.max(...dayStats.map(d => d[s.key] || 0), 1);
    const pts = dayStats.map((d, i) => ({x: xFor(i), pct: (d[s.key] || 0) / maxVal * 100, has: d.hasAny && d[s.key] > 0, raw: d[s.key]}));
    return {series: s, pts, maxVal};
  });
  const ticks = niceTicks(0, 100, 4);
  const maxV = ticks[ticks.length - 1];
  const yFor = pct => padT + plotH - (pct / (maxV || 1)) * plotH;

  const gridLines = ticks.map(t => `
    <line x1="${padL}" y1="${yFor(t)}" x2="${w - padR}" y2="${yFor(t)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${padL - 6}" y="${yFor(t) + 3}" text-anchor="end" font-size="9" fill="var(--ink-soft)">${t}%</text>
  `).join('');
  const linesHtml = seriesPoints.map(({series, pts}) => {
    const validPts = pts.filter(p => p.has);
    if(validPts.length < 2) return '';
    const linePoints = validPts.map(p => `${p.x},${yFor(p.pct)}`).join(' ');
    const dots = validPts.map(p => `<circle cx="${p.x}" cy="${yFor(p.pct)}" r="3" fill="${series.color}"/>`).join('');
    return `<polyline points="${linePoints}" fill="none" stroke="${series.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join('');
  const labelIdxs = dayStats.length <= 6 ? dayStats.map((_, i) => i) : [0, Math.round((dayStats.length - 1) / 2), dayStats.length - 1];
  const xLabels = labelIdxs.map(i => `<text x="${xFor(i)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${formatDateLabel(dayStats[i].date)}</text>`).join('');
  const maxNote = seriesPoints.map(({series, maxVal}) => `${series.label} peak: ${maxVal % 1 === 0 ? maxVal : maxVal.toFixed(1)}`).join(' · ');

  chartEl.innerHTML = `
    <div style="margin-bottom:6px;">${legendHtml}</div>
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;overflow:visible;">
      ${gridLines}
      ${linesHtml}
      ${xLabels}
    </svg>
    <div style="font-size:10.5px;color:var(--ink-soft);text-align:right;margin-top:2px;">% of each stat's own peak in this range -- ${maxNote}</div>
  `;
  wireToggles();
}

function renderBodyPlaceholders(){
  const grid = document.getElementById('bodyPlaceholderGrid');
  if(!grid) return;
  const tiles = [
    {key:'vitals', label:'Vitals', sub:'Blood pressure, glucose, HRV, resting HR'},
    {key:'mind', label:'Mind', sub:'Minutes, kind, stress score'}
  ];
  grid.innerHTML = tiles.map(t => `
    <div class="hub-tile hub-tile-empty" type="button">
      <div class="hub-tile-head"><span class="hub-tile-label">${t.label}</span></div>
      <div class="hub-tile-value">No entries yet</div>
      <div class="hub-tile-sub">${t.sub}</div>
      <div class="hub-tile-footer">Coming soon</div>
    </div>
  `).join('');
}

