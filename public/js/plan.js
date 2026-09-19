/* ---------- Training Plan (weekly schedule) + Workout Routine library ---------- */
(function(){
  let workoutCatalog = [];
  async function loadWorkoutCatalog(){
    try{
      const res = await fetch('api/workouts.php', {credentials: 'same-origin'});
      if(!res.ok) return;
      const data = await res.json();
      workoutCatalog = data.activities || [];
    }catch(e){}
  }
  function workoutActivityName(id){
    const a = workoutCatalog.find(x => x.id === id);
    return a ? a.name : id;
  }
  function workoutActivityInstructions(id){
    const a = workoutCatalog.find(x => x.id === id);
    return a ? (a.instructions || '') : '';
  }
  window.loadWorkoutCatalog = loadWorkoutCatalog;
  window.workoutActivityName = workoutActivityName;
  window.workoutActivityInstructions = workoutActivityInstructions;
  window.getWorkoutCatalog = () => workoutCatalog;

  function planDayLabel(entry){
    if(!entry) return 'Not set';
    if(entry.type === 'none-logged') return 'Open';
    if(entry.type === 'logged') return entry.label || 'Logged';
    if(entry.type === 'rest') return 'Rest';
    if(entry.type === 'other') return entry.note || 'Other';
    if(entry.type === 'workoutPlan'){
      const plan = getWorkoutPlan(entry.planId);
      return plan ? plan.name : 'Routine removed';
    }
    return 'Rest';
  }
  function planDayHasAction(entry){
    return !!entry && entry.type === 'workoutPlan';
  }
  // The Today banner's "Go" button always refers to today's own scheduled
  // entry, which renderTodaysSession() already shows -- both legacy presets
  // (Strength/Cardio tabs) and custom plans have a real interactive logging
  // surface now, so "Go" just makes sure it's rendered and scrolls to it.
  function goToPlanDay(entry){
    if(!entry || entry.type !== 'workoutPlan') return;
    const plan = getWorkoutPlan(entry.planId);
    if(!plan) return;
    renderTodaysSession();
    scrollToWorkout();
  }
  const LEGACY_TO_WORKOUT_PLAN = {A: 'strengthA', B: 'strengthB', steady: 'cardioSteady', interval: 'cardioInterval'};
  // Open mode has no fixed schedule -- each day's label comes from whatever
  // was actually logged that date: a legacy or custom Workout Routine resolves
  // back to a real plan reference (so "Go" / detail views work same as a
  // scheduled day); a Rest log or manual/deviation entry has no such plan,
  // so it just carries its own label through as "logged" -- the calendar
  // only ever shows "Open" when literally nothing was recorded that day.
  function openModeDayEntry(dStr){
    const entry = historyLog.find(e => e.date === dStr && e.day !== 'custom');
    if(!entry) return {type: 'none-logged'};
    const legacyPlanId = LEGACY_TO_WORKOUT_PLAN[entry.day];
    if(legacyPlanId) return {type: 'workoutPlan', planId: legacyPlanId};
    if(entry.day.indexOf('plan:') === 0) return {type: 'workoutPlan', planId: entry.day.slice(5)};
    return {type: 'logged', label: entry.label};
  }
  window.planDayLabel = planDayLabel;
  window.planDayHasAction = planDayHasAction;
  window.goToPlanDay = goToPlanDay;
  window.openModeDayEntry = openModeDayEntry;

  // ---------- Per-date deviation override on the weekly calendar ----------
  // Click any day cell (planned or not) to correct what actually happened
  // that date without editing the whole recurring week.
  let overrideDate = null;
  function openDayOverridePanel(dStr, dayName){
    overrideDate = dStr;
    const panel = document.getElementById('dayOverridePanel');
    const sel = document.getElementById('dayOverrideSelect');
    const current = userTrainingPlan && userTrainingPlan.overrides ? userTrainingPlan.overrides[dStr] : null;
    sel.innerHTML = `<option value="unset">Not set</option><option value="rest">Rest</option>` +
      allWorkoutPlans().map(p => `<option value="wp:${p.id}">${foodSearchEscape(p.name)}${p.kind === 'legacy' ? ' (preset)' : ''}</option>`).join('');
    sel.value = current ? (current.type === 'workoutPlan' ? `wp:${current.planId}` : current.type) : 'unset';
    document.getElementById('dayOverrideLabel').textContent = `What actually happened on ${dayName}?`;
    panel.style.display = 'block';
  }
  document.getElementById('dayOverrideSaveBtn').addEventListener('click', async ()=>{
    if(!overrideDate || !userTrainingPlan) return;
    const v = document.getElementById('dayOverrideSelect').value;
    userTrainingPlan.overrides = userTrainingPlan.overrides || {};
    if(v === 'unset'){
      delete userTrainingPlan.overrides[overrideDate];
    } else if(v === 'rest'){
      userTrainingPlan.overrides[overrideDate] = {type: 'rest'};
    } else {
      userTrainingPlan.overrides[overrideDate] = {type: 'workoutPlan', planId: v.slice(3)};
    }
    await saveTrainingPlan();
    document.getElementById('dayOverridePanel').style.display = 'none';
    renderWeekPlan();
    renderDashboard();
    if(overrideDate === dateStrForOffset(0)) renderTodaysSession();
  });
  document.getElementById('dayOverrideClearBtn').addEventListener('click', async ()=>{
    if(!overrideDate || !userTrainingPlan) return;
    if(userTrainingPlan.overrides) delete userTrainingPlan.overrides[overrideDate];
    await saveTrainingPlan();
    document.getElementById('dayOverridePanel').style.display = 'none';
    renderWeekPlan();
    renderDashboard();
    if(overrideDate === dateStrForOffset(0)) renderTodaysSession();
  });
  window.openDayOverridePanel = openDayOverridePanel;

  // ---------- Training Plan screen (Preset / Custom / Just Open) ----------
  window.openWorkoutPlanScreen = function(){
    document.getElementById('wpError').style.display = 'none';
    const p = userTrainingPlan || {presetKey: null, days: []};
    if(p.presetKey === 'custom'){
      wpSetMode('custom');
      document.getElementById('wpCustomName').value = p.name || '';
      wpCustomDays = weekPlan.map((_, i) => p.days[i] || null);
    } else if(p.presetKey === 'open'){
      wpSetMode('open');
    } else {
      wpSetMode('preset');
    }
    renderWpPresetList();
    renderWpCustomDays();
    if(!workoutCatalog.length) loadWorkoutCatalog().then(renderWpCustomDays);
    document.getElementById('workoutPlanScreen').style.display = 'flex';
  };
  function closeWorkoutPlanScreen(){
    document.getElementById('workoutPlanScreen').style.display = 'none';
  }
  document.getElementById('workoutPlanScreenClose').addEventListener('click', closeWorkoutPlanScreen);
  document.getElementById('createTrainingPlanBtn').addEventListener('click', window.openWorkoutPlanScreen);
  document.getElementById('trainingPlanTile').addEventListener('click', window.openWorkoutPlanScreen);
  document.getElementById('trainingProgramBtn').addEventListener('click', (e)=>{ e.preventDefault(); });

  function wpSetMode(mode){
    document.querySelectorAll('#wpModeTabs .main-tab').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.wpMode === mode);
    });
    document.getElementById('wpPresetMode').style.display = mode === 'preset' ? 'block' : 'none';
    document.getElementById('wpCustomMode').style.display = mode === 'custom' ? 'block' : 'none';
    document.getElementById('wpOpenMode').style.display = mode === 'open' ? 'block' : 'none';
  }
  document.getElementById('wpModeTabs').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-wp-mode]');
    if(!btn) return;
    wpSetMode(btn.dataset.wpMode);
  });

  function miniWeekPreview(days){
    return weekPlan.map((base, i) => `<span style="font-size:9.5px;color:var(--ink-soft);">${base.name} <b style="color:var(--ink);">${planDayLabel(days[i])}</b></span>`).join(' · ');
  }
  function renderWpPresetList(){
    const el = document.getElementById('wpPresetList');
    el.innerHTML = Object.entries(TRAINING_PLAN_PRESETS).map(([key, preset]) => `
      <div class="hub-card" style="margin-bottom:10px;">
        <div style="font-weight:700;font-family:var(--font-heading);margin-bottom:4px;">${preset.label}</div>
        <div style="line-height:1.8;">${miniWeekPreview(preset.days)}</div>
        <button type="button" class="timer-btn start" data-use-preset="${key}" style="width:100%;margin-top:10px;padding:8px 0;">Use this preset</button>
      </div>
    `).join('');
    el.querySelectorAll('[data-use-preset]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const preset = TRAINING_PLAN_PRESETS[btn.dataset.usePreset];
        userTrainingPlan = {presetKey: btn.dataset.usePreset, name: preset.name, days: preset.days.slice(), overrides: (userTrainingPlan && userTrainingPlan.overrides) || {}};
        await saveTrainingPlan();
        renderWeekPlan();
        renderDashboard();
        renderTodaysSession();
        closeWorkoutPlanScreen();
      });
    });
  }

  // Local draft state for the Custom builder -- only written to
  // userTrainingPlan on explicit "Save custom plan", so backing out (closing
  // the screen, switching to another mode) never half-saves a plan. Each
  // day just picks a Workout Routine (or Rest) -- build the Workout Routine itself
  // first via "Edit Workout Routine" if it doesn't exist yet.
  let wpCustomDays = weekPlan.map(() => null);
  function renderWpCustomDays(){
    const el = document.getElementById('wpCustomDays');
    const plans = allWorkoutPlans();
    el.innerHTML = weekPlan.map((base, i) => {
      const entry = wpCustomDays[i];
      const kind = !entry ? 'unset' : entry.type;
      return `
        <div class="hub-card" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong style="font-family:var(--font-heading);flex-shrink:0;">${base.name}</strong>
          <select data-day-plan="${i}" style="flex:1;min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;">
            <option value="unset" ${kind === 'unset' ? 'selected' : ''}>Not set</option>
            <option value="rest" ${kind === 'rest' ? 'selected' : ''}>Rest</option>
            ${plans.map(p => `<option value="wp:${p.id}" ${kind === 'workoutPlan' && entry.planId === p.id ? 'selected' : ''}>${foodSearchEscape(p.name)}${p.kind === 'legacy' ? ' (preset)' : ''}</option>`).join('')}
          </select>
        </div>
      `;
    }).join('');
    el.querySelectorAll('[data-day-plan]').forEach(sel=>{
      sel.addEventListener('change', ()=>{
        const i = parseInt(sel.dataset.dayPlan, 10);
        const v = sel.value;
        wpCustomDays[i] = v === 'unset' ? null : v === 'rest' ? {type: 'rest'} : {type: 'workoutPlan', planId: v.slice(3)};
      });
    });
  }
  document.getElementById('wpCustomSaveBtn').addEventListener('click', async ()=>{
    const errEl = document.getElementById('wpError');
    errEl.style.display = 'none';
    const name = document.getElementById('wpCustomName').value.trim();
    if(!name){
      errEl.textContent = 'Give your plan a short name (up to 10 characters).';
      errEl.style.display = 'block';
      return;
    }
    userTrainingPlan = {presetKey: 'custom', name, days: wpCustomDays.slice(), overrides: (userTrainingPlan && userTrainingPlan.overrides) || {}};
    await saveTrainingPlan();
    renderWeekPlan();
    renderDashboard();
    renderTodaysSession();
    closeWorkoutPlanScreen();
  });

  document.getElementById('wpOpenSaveBtn').addEventListener('click', async ()=>{
    userTrainingPlan = {presetKey: 'open', name: 'Open', days: weekPlan.map(() => null), overrides: (userTrainingPlan && userTrainingPlan.overrides) || {}};
    await saveTrainingPlan();
    renderWeekPlan();
    renderDashboard();
    renderTodaysSession();
    closeWorkoutPlanScreen();
  });

  // ---------- Workout Routine library screen (browse presets, build/edit Custom) ----------
  function renderWplSelect(){
    const sel = document.getElementById('wplSelect');
    const current = sel.value;
    sel.innerHTML = allWorkoutPlans().map(p => `<option value="${p.id}">${foodSearchEscape(p.name)}${p.kind === 'legacy' ? ' (preset)' : ''}</option>`).join('');
    if(current && getWorkoutPlan(current)) sel.value = current;
    renderWplDetail(sel.value);
  }
  function renderWplDetail(planId){
    const detailEl = document.getElementById('wplDetail');
    const plan = getWorkoutPlan(planId);
    if(!plan){ detailEl.innerHTML = '<div class="dash-empty">No workout routines yet -- tap + New to build one.</div>'; return; }
    if(plan.kind === 'legacy'){
      if(dayData[plan.legacyKey]){
        const day = dayData[plan.legacyKey];
        detailEl.innerHTML = `
          <div style="font-size:11px;color:var(--ink-soft);margin-bottom:8px;">${foodSearchEscape(day.title || '')} · preset, not editable</div>
          ${day.exercises.map(ex => `
            <div class="hub-card" style="margin-bottom:6px;">
              <div style="font-weight:600;">${foodSearchEscape(ex.name)}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">${foodSearchEscape(ex.scheme)}</div>
            </div>
          `).join('')}
        `;
      } else if(cardioData[plan.legacyKey]){
        const c = cardioData[plan.legacyKey];
        detailEl.innerHTML = `
          <div style="font-size:11px;color:var(--ink-soft);margin-bottom:8px;">${foodSearchEscape(c.title || '')} · preset, not editable</div>
          ${c.phases.map(ph => `
            <div class="hub-card" style="margin-bottom:6px;display:flex;justify-content:space-between;gap:8px;">
              <div><div style="font-weight:600;">${foodSearchEscape(ph.phase)}</div><div style="font-size:11.5px;color:var(--ink-soft);">${foodSearchEscape(ph.detail)}</div></div>
              <div style="font-size:12px;color:var(--ink-soft);white-space:nowrap;">${foodSearchEscape(ph.time)}</div>
            </div>
          `).join('')}
        `;
      } else {
        detailEl.innerHTML = '<div class="dash-empty">Preset details unavailable.</div>';
      }
    } else {
      detailEl.innerHTML = `
        ${plan.items.map(it => `
          <div class="hub-card" style="margin-bottom:6px;">
            <div style="font-weight:600;">${foodSearchEscape(workoutActivityName(it.activityId))}</div>
            <div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">${foodSearchEscape(it.target || '')}${it.setCount ? ' · ' + it.setCount + ' sets' : ''}</div>
          </div>
        `).join('') || '<div class="dash-empty">No exercises added yet -- Edit to add some.</div>'}
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button type="button" class="timer-btn" data-edit-wpl="${plan.id}" style="flex:1;">Edit</button>
          <button type="button" class="timer-btn reset" data-delete-wpl="${plan.id}" style="flex:1;">Delete</button>
        </div>
      `;
    }
  }
  document.getElementById('wplSelect').addEventListener('change', (e)=> renderWplDetail(e.target.value));
  document.getElementById('wplDetail').addEventListener('click', async (e)=>{
    const editBtn = e.target.closest('[data-edit-wpl]');
    if(editBtn){ openWplBuilder(editBtn.dataset.editWpl); return; }
    const delBtn = e.target.closest('[data-delete-wpl]');
    if(delBtn){
      if(!confirm('Delete this workout routine? Any Training Plan day using it will show "Not set" until you pick something else.')) return;
      customWorkoutPlans = customWorkoutPlans.filter(p => p.id !== delBtn.dataset.deleteWpl);
      await saveCustomWorkoutPlans();
      renderWplSelect();
      renderWeekPlan();
      renderTodaysSession();
    }
  });
  document.getElementById('wplNewBtn').addEventListener('click', ()=> openWplBuilder(null));

  let wplBuilderItems = [];
  let wplBuilderEditingId = null;
  function openWplBuilder(existingId){
    wplBuilderEditingId = existingId || null;
    const existing = existingId ? customWorkoutPlans.find(p => p.id === existingId) : null;
    document.getElementById('wplBuilderName').value = existing ? existing.name : '';
    wplBuilderItems = existing ? existing.items.map(it => ({...it})) : [];
    document.getElementById('wplBuilderSearch').value = '';
    document.getElementById('wplBuilderResults').innerHTML = '';
    document.getElementById('wplError').style.display = 'none';
    renderWplBuilderItems();
    document.getElementById('wplBuilder').style.display = 'block';
  }
  function renderWplBuilderItems(){
    const el = document.getElementById('wplBuilderItems');
    el.innerHTML = wplBuilderItems.map((it, i) => `
      <div class="hub-card" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;font-size:13px;">${foodSearchEscape(workoutActivityName(it.activityId))}</div>
          <input type="text" data-item-target="${i}" value="${foodSearchEscape(it.target || '')}" placeholder="e.g. 3 x 12-15" style="width:100%;padding:4px 6px;border:1px solid var(--line);border-radius:4px;background:var(--paper);font-size:11.5px;margin-top:3px;">
        </div>
        <button type="button" data-remove-wpl-item="${i}" style="background:none;border:none;color:inherit;cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>
      </div>
    `).join('') || '<div class="dash-empty">Search below to add exercises/activities.</div>';
    el.querySelectorAll('[data-item-target]').forEach(inp=>{
      inp.addEventListener('input', ()=>{ wplBuilderItems[parseInt(inp.dataset.itemTarget, 10)].target = inp.value; });
    });
    el.querySelectorAll('[data-remove-wpl-item]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        wplBuilderItems.splice(parseInt(btn.dataset.removeWplItem, 10), 1);
        renderWplBuilderItems();
      });
    });
  }
  document.getElementById('wplBuilderSearch').addEventListener('input', (e)=>{
    const q = e.target.value.trim().toLowerCase();
    const resultsEl = document.getElementById('wplBuilderResults');
    if(!q){ resultsEl.innerHTML = ''; return; }
    const matches = workoutCatalog.filter(a => a.name.toLowerCase().includes(q)).slice(0, 8);
    resultsEl.innerHTML = matches.map(a => `<button type="button" class="timer-btn" data-add-wpl-item="${a.id}" style="display:block;width:100%;text-align:left;margin-top:3px;padding:6px 8px;font-size:12px;">+ ${foodSearchEscape(a.name)}</button>`).join('') || '<div class="dash-empty" style="padding:6px 0;">No matches.</div>';
    resultsEl.querySelectorAll('[data-add-wpl-item]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        wplBuilderItems.push({activityId: btn.dataset.addWplItem, target: '', setCount: 3});
        document.getElementById('wplBuilderSearch').value = '';
        resultsEl.innerHTML = '';
        renderWplBuilderItems();
      });
    });
  });
  document.getElementById('wplBuilderSaveBtn').addEventListener('click', async ()=>{
    const errEl = document.getElementById('wplError');
    errEl.style.display = 'none';
    const name = document.getElementById('wplBuilderName').value.trim();
    if(!name){
      errEl.textContent = 'Give your workout routine a name.';
      errEl.style.display = 'block';
      return;
    }
    if(!wplBuilderItems.length){
      errEl.textContent = 'Add at least one exercise or activity.';
      errEl.style.display = 'block';
      return;
    }
    const savedId = wplBuilderEditingId || ('cwp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    if(wplBuilderEditingId){
      const idx = customWorkoutPlans.findIndex(p => p.id === wplBuilderEditingId);
      if(idx !== -1) customWorkoutPlans[idx] = {id: savedId, name, items: wplBuilderItems.slice()};
    } else {
      customWorkoutPlans.push({id: savedId, name, items: wplBuilderItems.slice()});
    }
    await saveCustomWorkoutPlans();
    document.getElementById('wplBuilder').style.display = 'none';
    renderWplSelect();
    document.getElementById('wplSelect').value = savedId;
    renderWplDetail(savedId);
    renderWeekPlan();
    renderTodaysSession();
  });
  document.getElementById('wplBuilderCancelBtn').addEventListener('click', ()=>{
    document.getElementById('wplBuilder').style.display = 'none';
  });

  window.openWorkoutPlanLibraryScreen = function(preselectId){
    const openIt = ()=>{
      renderWplSelect();
      if(preselectId && getWorkoutPlan(preselectId)){
        document.getElementById('wplSelect').value = preselectId;
        renderWplDetail(preselectId);
      }
    };
    document.getElementById('wplBuilder').style.display = 'none';
    document.getElementById('wplError').style.display = 'none';
    if(!workoutCatalog.length){ loadWorkoutCatalog().then(openIt); } else { openIt(); }
    document.getElementById('workoutPlanLibraryScreen').style.display = 'flex';
  };
  document.getElementById('workoutPlanLibraryClose').addEventListener('click', ()=>{
    document.getElementById('workoutPlanLibraryScreen').style.display = 'none';
  });
  document.getElementById('workoutTodayTile').addEventListener('click', ()=>{
    const entry = effectiveDayEntry(dateStrForOffset(0), new Date().getDay());
    window.openWorkoutPlanLibraryScreen(entry && entry.type === 'workoutPlan' ? entry.planId : undefined);
  });
})();

