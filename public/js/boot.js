/* ---------- Water (dedicated full-page day-nav editor + history) ---------- */
(function(){
  let waterSelectedDate = null;
  const fmtL = ml => (ml / 1000).toFixed(2).replace(/\.?0+$/, '') || '0';

  window.openWaterScreen = function(){
    waterSelectedDate = dateStrForOffset(0);
    document.getElementById('waterFactNote').textContent = randomFact(WATER_FACTS);
    renderWaterDayNav();
    renderWaterHistory();
    document.getElementById('waterScreen').style.display = 'flex';
  };
  function closeWaterScreen(){
    document.getElementById('waterScreen').style.display = 'none';
  }
  document.getElementById('waterScreenClose').addEventListener('click', closeWaterScreen);
  document.body.addEventListener('click', (e)=>{
    if(e.target.closest('button, input, select, a, textarea')) return;
    if(e.target.closest('.open-water-screen-link')) window.openWaterScreen();
  });

  function waterTargetMl(){
    return (userHealthTargets && userHealthTargets.waterGoalMl) || (userProfile && userProfile.waterGoalMl) || 2500;
  }

  function renderWaterDayNav(){
    const navEl = document.getElementById('waterDayNav');
    const todayStr = dateStrForOffset(0);
    const isToday = waterSelectedDate === todayStr;
    navEl.innerHTML = `
      <button class="day-nav-btn" id="waterPrevDay" type="button"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="day-nav-label">
        <div class="day-nav-date">${isToday ? 'Today' : formatDateLabel(waterSelectedDate)}</div>
        ${!isToday ? `<div class="day-nav-today-link" id="waterJumpToday">Jump to today</div>` : `<div style="font-size:11px;color:var(--ink-soft);">${formatDateLabel(waterSelectedDate)}</div>`}
      </div>
      <button class="day-nav-btn" id="waterNextDay" type="button" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    `;
    document.getElementById('waterPrevDay').addEventListener('click', ()=>{
      waterSelectedDate = addDaysToDate(waterSelectedDate, -1);
      renderWaterDayNav();
    });
    if(!isToday){
      document.getElementById('waterNextDay').addEventListener('click', ()=>{
        waterSelectedDate = addDaysToDate(waterSelectedDate, 1);
        renderWaterDayNav();
      });
      document.getElementById('waterJumpToday').addEventListener('click', ()=>{
        waterSelectedDate = todayStr;
        renderWaterDayNav();
      });
    }
    renderWaterForm();
  }

  function renderWaterForm(){
    const ml = waterLog[waterSelectedDate] || 0;
    const target = waterTargetMl();
    document.getElementById('waterScreenValue').textContent = `${fmtL(ml)} L`;
    document.getElementById('waterScreenSub').textContent = `Target: ${(target/1000).toFixed(1)} L`;
    document.getElementById('waterScreenBar').style.width = Math.min(100, target ? ml/target*100 : 0) + '%';
    document.getElementById('waterManualMl').value = '';
  }

  function adjustWater(deltaMl){
    const ml = Math.max(0, (waterLog[waterSelectedDate] || 0) + deltaMl);
    waterLog[waterSelectedDate] = ml;
    saveWater();
    renderWaterForm();
    renderWaterHistory();
    if(waterSelectedDate === dateStrForOffset(0)) renderTodayGlance();
  }
  document.getElementById('waterScreenPlus').addEventListener('click', ()=> adjustWater(250));
  document.getElementById('waterScreenMinus').addEventListener('click', ()=> adjustWater(-250));
  document.getElementById('waterManualSetBtn').addEventListener('click', ()=>{
    const val = parseInt(document.getElementById('waterManualMl').value, 10);
    if(isNaN(val) || val < 0) return;
    waterLog[waterSelectedDate] = val;
    saveWater();
    renderWaterForm();
    renderWaterHistory();
    if(waterSelectedDate === dateStrForOffset(0)) renderTodayGlance();
  });

  function renderWaterHistory(){
    const entries = Object.entries(waterLog)
      .map(([date, ml]) => ({date, ml}))
      .filter(e => e.ml > 0)
      .sort((a,b)=> a.date < b.date ? 1 : -1);

    const chartEl = document.getElementById('waterScreenChart');
    const recent = [...entries].reverse().slice(-14);
    renderTrendLineChart(chartEl, recent.map(e => ({y: e.ml, label: formatDateLabel(e.date)})), {
      color: '#4A90D9', dotColor: '#2E6DA8',
      goalValue: waterTargetMl(), emptyText: 'Log a couple of days to see your trend.'
    });

    const listEl = document.getElementById('waterScreenHistoryList');
    if(!entries.length){
      listEl.innerHTML = `<div class="dash-empty">No water logged yet.</div>`;
    } else {
      listEl.innerHTML = entries.slice(0, 10).map(e => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line);font-size:12.5px;">
          <span style="color:var(--ink-soft);">${formatDateLabel(e.date)}</span>
          <span style="font-weight:600;">${fmtL(e.ml)} L</span>
        </div>
      `).join('');
    }
  }

  document.querySelector('[data-water-history-toggle="1"]').addEventListener('click', function(){
    const detail = document.querySelector('[data-water-history-detail="1"]');
    const open = detail.classList.toggle('open');
    this.classList.toggle('expanded', open);
  });
})();

checkAuthAndStart();

/* ---------- Floating rest timer ---------- */
(function(){
  const fab = document.getElementById('timerFab');
  const panel = document.getElementById('timerPanel');
  const display = document.getElementById('timerDisplay');
  const startBtn = document.getElementById('timerStart');
  const resetBtn = document.getElementById('timerReset');
  const closeBtn = document.getElementById('timerClose');
  const minusBtn = document.getElementById('timerMinus');
  const plusBtn = document.getElementById('timerPlus');
  const presets = document.querySelectorAll('.timer-preset');

  let totalSeconds = 60;
  let remaining = 60;
  let running = false;
  let intervalId = null;
  let audioCtx = null;

  function fmt(s){
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sec = (s%60).toString().padStart(2,'0');
    return `${m}:${sec}`;
  }
  function updateDisplay(){ display.textContent = fmt(remaining); }

  function setTotal(sec){
    totalSeconds = Math.max(5, sec);
    if(!running) remaining = totalSeconds;
    updateDisplay();
    presets.forEach(p => p.classList.toggle('active', parseInt(p.dataset.sec) === totalSeconds));
  }

  function unlockAudio(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === 'suspended') audioCtx.resume();
    }catch(e){}
  }

  function beep(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      for(let i=0;i<4;i++){
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + i*0.5);
        gain.gain.exponentialRampToValueAtTime(0.5, now + i*0.5 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i*0.5 + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i*0.5);
        osc.stop(now + i*0.5 + 0.4);
      }
      if(navigator.vibrate) navigator.vibrate([200,100,200,100,200]);
    }catch(e){}
  }

  function tick(){
    remaining -= 1;
    updateDisplay();
    if(remaining <= 0){
      stop();
      beep();
      fab.classList.remove('running');
      display.textContent = "Done!";
      setTimeout(()=>{ remaining = totalSeconds; updateDisplay(); }, 1500);
    }
  }

  function start(){
    if(running) return;
    unlockAudio();
    running = true;
    fab.classList.add('running');
    startBtn.textContent = 'Pause';
    intervalId = setInterval(tick, 1000);
  }
  function pause(){
    running = false;
    fab.classList.remove('running');
    startBtn.textContent = 'Start';
    clearInterval(intervalId);
  }
  function stop(){
    running = false;
    clearInterval(intervalId);
    startBtn.textContent = 'Start';
  }
  function reset(){
    stop();
    fab.classList.remove('running');
    remaining = totalSeconds;
    updateDisplay();
  }

  startBtn.addEventListener('click', ()=>{ running ? pause() : start(); });
  resetBtn.addEventListener('click', reset);
  minusBtn.addEventListener('click', ()=>{ if(!running) setTotal(totalSeconds - 15); });
  plusBtn.addEventListener('click', ()=>{ if(!running) setTotal(totalSeconds + 15); });
  presets.forEach(p=>{
    p.addEventListener('click', ()=>{ if(!running) setTotal(parseInt(p.dataset.sec)); });
  });

  fab.addEventListener('click', (e)=>{
    if(fab.dataset.dragged === 'true'){ fab.dataset.dragged = 'false'; return; }
    if(fab.dataset.suppressClick === 'true'){ fab.dataset.suppressClick = 'false'; return; }
    panel.classList.toggle('open');
  });
  closeBtn.addEventListener('click', ()=> panel.classList.remove('open'));

  /* Drag to reposition */
  let dragging = false, offsetX = 0, offsetY = 0, startX = 0, startY = 0, isTouch = false, touchOnFab = false;
  function pointerDown(e){
    const p = e.touches ? e.touches[0] : e;
    isTouch = !!e.touches;
    touchOnFab = true;
    dragging = true;
    fab.classList.add('dragging');
    fab.dataset.dragged = 'false';
    const rect = fab.getBoundingClientRect();
    offsetX = p.clientX - rect.left;
    offsetY = p.clientY - rect.top;
    startX = p.clientX; startY = p.clientY;
    if(isTouch) e.preventDefault();
  }
  function pointerMove(e){
    if(!dragging || !touchOnFab) return;
    const p = e.touches ? e.touches[0] : e;
    if(Math.abs(p.clientX - startX) > 6 || Math.abs(p.clientY - startY) > 6){
      fab.dataset.dragged = 'true';
    }
    if(fab.dataset.dragged !== 'true') return;
    let left = p.clientX - offsetX;
    let top = p.clientY - offsetY;
    left = Math.max(4, Math.min(window.innerWidth - fab.offsetWidth - 4, left));
    top = Math.max(4, Math.min(window.innerHeight - fab.offsetHeight - 4, top));
    fab.style.left = left + 'px';
    fab.style.top = top + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    panel.style.left = left + 'px';
    panel.style.top = (top - panel.offsetHeight - 10) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    if(isTouch) e.preventDefault();
  }
  function pointerUp(e){
    if(!touchOnFab){ dragging = false; return; }
    dragging = false;
    fab.classList.remove('dragging');
    if(isTouch){
      // Touch devices often suppress the synthesized click after preventDefault,
      // so handle the tap directly here instead of waiting on 'click'.
      if(fab.dataset.dragged !== 'true'){
        panel.classList.toggle('open');
        fab.dataset.suppressClick = 'true';
      }
      fab.dataset.dragged = 'false';
    }
    touchOnFab = false;
  }
  fab.addEventListener('mousedown', pointerDown);
  document.addEventListener('mousemove', pointerMove);
  document.addEventListener('mouseup', pointerUp);
  fab.addEventListener('touchstart', pointerDown, {passive:false});
  document.addEventListener('touchmove', pointerMove, {passive:false});
  document.addEventListener('touchend', pointerUp);

  updateDisplay();
})();
