// ---------- Log a Session (mode picker + rest/manual logging) ----------
function renderLogSessionOptions(hasSchedule, dStr, isToday){
  const el = document.getElementById('logSessionOptions');
  const pickerWrap = document.getElementById('logSessionPlanPicker');
  const restWrap = document.getElementById('logSessionRestPanel');
  const manualWrap = document.getElementById('logSessionManualPanel');
  if(!el) return;
  dStr = dStr || activeSessionDate();
  isToday = isToday !== undefined ? isToday : dStr === dateStrForOffset(0);

  // A past/future day only ever offers Rest or a manual entry -- the
  // tick-to-complete plan checklist is today-only (see logSessionModeNonToday).
  const options = !isToday
    ? [{value: 'rest', icon: '😴', label: 'Rest'}, {value: 'manual', icon: '✍️', label: 'Add manual exercise'}]
    : hasSchedule
      ? [{value: 'plan', icon: '🏋️', label: 'Use Workout Today Plan'}, {value: 'rest', icon: '😴', label: 'Rest'}]
      : [{value: 'plan', icon: '📋', label: 'Select workout plan'}, {value: 'rest', icon: '😴', label: 'Rest'}, {value: 'manual', icon: '✍️', label: 'Add manual exercise'}];

  const activeMode = isToday ? logSessionMode : logSessionModeNonToday;
  el.innerHTML = options.map(o => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;font-size:13px;">
      <input type="radio" name="logSessionMode" value="${o.value}" ${activeMode === o.value ? 'checked' : ''}>
      <span style="font-size:15px;">${o.icon}</span> ${o.label}
    </label>
  `).join('');
  el.querySelectorAll('input[name="logSessionMode"]').forEach(r=>{
    r.addEventListener('change', async ()=>{
      if(!isToday){
        logSessionModeNonToday = r.value;
        renderTodaysSession();
        return;
      }
      logSessionMode = r.value;
      if(logSessionMode !== 'plan') logSessionSelectedPlanId = null;
      // Switching back to the plan while today has a Rest deviation on
      // record means "no, use the plan after all" -- clear it rather than
      // leaving the radio pointed at a plan that still resolves to Rest.
      if(logSessionMode === 'plan' && hasSchedule && userTrainingPlan && userTrainingPlan.overrides){
        const ov = userTrainingPlan.overrides[dStr];
        if(ov && ov.type === 'rest'){
          delete userTrainingPlan.overrides[dStr];
          await saveTrainingPlan();
          renderWeekPlan();
        }
      }
      renderTodaysSession();
    });
  });

  const showPicker = isToday && !hasSchedule && activeMode === 'plan';
  pickerWrap.style.display = showPicker ? 'block' : 'none';
  if(showPicker){
    const sel = document.getElementById('logSessionPlanSelect');
    sel.innerHTML = `<option value="">Choose a plan…</option>` + allWorkoutPlans().map(p => `<option value="${p.id}" ${logSessionSelectedPlanId === p.id ? 'selected' : ''}>${foodSearchEscape(p.name)}${p.kind === 'legacy' ? ' (preset)' : ''}</option>`).join('');
    if(!sel._wired){
      sel._wired = true;
      sel.addEventListener('change', ()=>{
        logSessionSelectedPlanId = sel.value || null;
        renderTodaysSession();
      });
    }
  }

  restWrap.style.display = activeMode === 'rest' ? 'block' : 'none';
  manualWrap.style.display = ((!isToday || !hasSchedule) && activeMode === 'manual') ? 'block' : 'none';
}

document.getElementById('logSessionRestSaveBtn').addEventListener('click', async ()=>{
  const note = document.getElementById('logSessionRestNotes').value.trim();
  const dStr = activeSessionDate();
  const hasSchedule = !!(userTrainingPlan && userTrainingPlan.presetKey && userTrainingPlan.presetKey !== 'open');
  if(hasSchedule){
    userTrainingPlan.overrides = userTrainingPlan.overrides || {};
    userTrainingPlan.overrides[dStr] = {type: 'rest'};
    await saveTrainingPlan();
  }
  // Also log it as today's entry (regardless of mode) so it shows up in
  // "Logged Training Today" / Today's Log with its note -- excluded from
  // session/streak counts and the workout-day nutrition target by
  // isRealSessionEntry().
  upsertSessionLog(dStr, 'rest', [], note, undefined, 'Rest');
  document.getElementById('logSessionRestNotes').value = '';
  renderWeekPlan();
  renderDashboard();
  renderHistory();
  renderTally();
  renderTodaysSession();
  renderTodayGlance();
});

// ---------- Extra exercises added to a Workout Plan for today only ----------
// Keyed by today's date + which block ('strength' or 'custom') so switching
// plans/days never mixes them up; nothing is saved to history until "Plan
// Completed & Log" actually logs the day, at which point the key is cleared.
let extraExercisesByPlanDay = {};
function extraExKey(scope){ return activeSessionDate() + ':' + scope; }
function renderExtraExercises(scope){
  const key = extraExKey(scope);
  const list = extraExercisesByPlanDay[key] || [];
  const el = document.getElementById('extraEx-' + scope);
  if(!el) return;
  el.innerHTML = list.map((ex, i) => `
    <div class="ex-card" style="padding:8px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div style="font-size:12.5px;flex:1;">${foodSearchEscape(ex.name)}${ex.weight ? ' — ' + foodSearchEscape(ex.weight) + 'kg' : ''}${ex.sets ? ' · ' + ex.sets + ' sets' : ''}${ex.reps ? ' × ' + ex.reps + ' reps' : ''}${ex.duration ? ' · ' + ex.duration + ' min' : ''}</div>
      <button type="button" data-remove-extra-ex="${i}" data-extra-scope="${scope}" style="background:none;border:none;color:inherit;cursor:pointer;font-size:14px;">✕</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-remove-extra-ex]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      extraExercisesByPlanDay[key].splice(parseInt(btn.dataset.removeExtraEx, 10), 1);
      renderExtraExercises(scope);
    });
  });
}
function extraExerciseFormHtml(scope){
  return `
    <input type="text" data-extra-name="${scope}" placeholder="Activity name" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;margin-bottom:6px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <input type="number" data-extra-sets="${scope}" placeholder="Sets" min="0" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
      <input type="number" data-extra-reps="${scope}" placeholder="Reps" min="0" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
      <input type="number" data-extra-weight="${scope}" placeholder="Weight (kg)" min="0" step="0.5" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
      <input type="number" data-extra-duration="${scope}" placeholder="Duration (min)" min="0" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
    </div>
    <button type="button" data-extra-save="${scope}" class="timer-btn start" style="width:100%;margin-top:8px;">+ Add to today's session</button>
  `;
}
document.querySelectorAll('[data-extra-add-toggle]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const scope = btn.dataset.extraAddToggle;
    const formEl = document.querySelector(`[data-extra-form="${scope}"]`);
    const showing = formEl.style.display !== 'none';
    if(showing){ formEl.style.display = 'none'; formEl.innerHTML = ''; return; }
    formEl.innerHTML = extraExerciseFormHtml(scope);
    formEl.style.display = 'block';
    formEl.querySelector(`[data-extra-save="${scope}"]`).addEventListener('click', ()=>{
      const name = formEl.querySelector(`[data-extra-name="${scope}"]`).value.trim();
      if(!name) return;
      const key = extraExKey(scope);
      extraExercisesByPlanDay[key] = extraExercisesByPlanDay[key] || [];
      extraExercisesByPlanDay[key].push({
        name,
        sets: formEl.querySelector(`[data-extra-sets="${scope}"]`).value,
        reps: formEl.querySelector(`[data-extra-reps="${scope}"]`).value,
        weight: formEl.querySelector(`[data-extra-weight="${scope}"]`).value,
        duration: formEl.querySelector(`[data-extra-duration="${scope}"]`).value
      });
      renderExtraExercises(scope);
      formEl.style.display = 'none';
      formEl.innerHTML = '';
    });
  });
});

// ---------- Manual exercise entry (Open mode, no library-backed Workout Plan) ----------
let manualExPending = [];
let manualExChosenActivityId = null;
let manualExPendingStats = null; // set via the shared AI-assist/watch-stats form; attached on Save session
function renderManualExStatsNote(){
  const el = document.getElementById('manualExStatsNote');
  if(!el) return;
  el.textContent = manualExPendingStats ? '📊 Stats attached — will be saved with this session.' : '';
}
document.getElementById('manualExStatsBtn').addEventListener('click', ()=> openStatsForm('manual-pending', activeSessionDate()));
document.getElementById('manualExSearchToggle').addEventListener('click', ()=>{
  const input = document.getElementById('manualExSearchInput');
  const showing = input.style.display !== 'none';
  input.style.display = showing ? 'none' : 'block';
  if(showing){ input.value = ''; document.getElementById('manualExSearchResults').innerHTML = ''; }
  else input.focus();
});
document.getElementById('manualExSearchInput').addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase();
  const resultsEl = document.getElementById('manualExSearchResults');
  if(!q){ resultsEl.innerHTML = ''; return; }
  const matches = (window.getWorkoutCatalog ? window.getWorkoutCatalog() : []).filter(a => a.name.toLowerCase().includes(q)).slice(0, 8);
  resultsEl.innerHTML = matches.map(a => `<button type="button" class="timer-btn" data-pick-activity="${a.id}" style="display:block;width:100%;text-align:left;margin-top:3px;padding:6px 8px;font-size:12px;">+ ${foodSearchEscape(a.name)}</button>`).join('') || '<div class="dash-empty" style="padding:6px 0;">No matches.</div>';
  resultsEl.querySelectorAll('[data-pick-activity]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      manualExChosenActivityId = btn.dataset.pickActivity;
      document.getElementById('manualExName').value = btn.textContent.replace(/^\+\s*/, '');
      resultsEl.innerHTML = '';
      document.getElementById('manualExSearchInput').value = '';
    });
  });
});
document.getElementById('manualExName').addEventListener('input', ()=>{ manualExChosenActivityId = null; });
function renderManualExPending(){
  const el = document.getElementById('manualExPending');
  el.innerHTML = manualExPending.map((ex, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">
      <div style="font-size:12.5px;flex:1;">${foodSearchEscape(ex.name)}${ex.weight ? ' — ' + foodSearchEscape(ex.weight) + 'kg' : ''}${ex.sets ? ' · ' + ex.sets + ' sets' : ''}${ex.reps ? ' × ' + ex.reps + ' reps' : ''}${ex.duration ? ' · ' + ex.duration + ' min' : ''}</div>
      <button type="button" data-remove-manual-ex="${i}" style="background:none;border:none;color:inherit;cursor:pointer;font-size:14px;">✕</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-remove-manual-ex]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      manualExPending.splice(parseInt(btn.dataset.removeManualEx, 10), 1);
      renderManualExPending();
      document.getElementById('manualExSaveBtn').style.display = manualExPending.length ? 'block' : 'none';
    });
  });
}
document.getElementById('manualExAddBtn').addEventListener('click', ()=>{
  const name = document.getElementById('manualExName').value.trim();
  if(!name) return;
  const sets = document.getElementById('manualExSets').value;
  const reps = document.getElementById('manualExReps').value;
  const weight = document.getElementById('manualExWeight').value;
  const duration = document.getElementById('manualExDuration').value;
  manualExPending.push({name, activityId: manualExChosenActivityId, sets, reps, weight, duration});
  document.getElementById('manualExName').value = '';
  document.getElementById('manualExSets').value = '';
  document.getElementById('manualExReps').value = '';
  document.getElementById('manualExWeight').value = '';
  document.getElementById('manualExDuration').value = '';
  manualExChosenActivityId = null;
  renderManualExPending();
  document.getElementById('manualExSaveBtn').style.display = 'block';
});
document.getElementById('manualExSaveBtn').addEventListener('click', ()=>{
  if(!manualExPending.length) return;
  const dStr = activeSessionDate();
  const snapshot = manualExPending.map(ex => ({
    name: ex.name,
    weight: ex.weight || '',
    sets: ex.sets || '',
    reps: ex.reps || '',
    duration: ex.duration || ''
  }));
  upsertSessionLog(dStr, 'manual-' + Date.now().toString(36), snapshot, undefined, manualExPendingStats || undefined, 'Manual entry');
  manualExPending = [];
  manualExPendingStats = null;
  renderManualExPending();
  renderManualExStatsNote();
  document.getElementById('manualExSaveBtn').style.display = 'none';
  renderWeekPlan();
  renderDashboard();
  renderHistory();
  renderTally();
  renderTodaysSession();
  renderTodayGlance();
});

// ---------- "Logged Training Today" -- today's entries, editable in place ----------
function loggedTodayEntries(){
  const dStr = activeSessionDate();
  return historyLog.map((e, idx) => ({e, idx})).filter(({e}) => e.date === dStr);
}
// Which fields make sense to edit per activity category -- keeps the
// Logged Training Today edit form from showing every possible metric for
// every exercise regardless of whether it applies.
const LOGGEDTODAY_CATEGORY_FIELDS = {
  strength: [['sets', 'Sets'], ['reps', 'Reps'], ['weight', 'Weight (kg)']],
  cardio: [['duration', 'Duration (min)'], ['distance', 'Distance (km)']],
  sports: [['duration', 'Duration (min)'], ['intensity', 'Intensity (1-10)']],
  other: [['sets', 'Sets'], ['reps', 'Reps'], ['weight', 'Weight (kg)'], ['duration', 'Duration (min)'], ['distance', 'Distance (km)']]
};
function guessLoggedTodayCategory(ex){
  if(ex.category && LOGGEDTODAY_CATEGORY_FIELDS[ex.category]) return ex.category;
  if(ex.distance) return 'cardio';
  if(ex.duration && !ex.sets && !ex.reps && !ex.weight) return 'cardio';
  if(ex.sets || ex.reps || ex.weight) return 'strength';
  return 'other';
}
function loggedTodayFieldsHtml(idx, exi, ex, cat){
  const fields = LOGGEDTODAY_CATEGORY_FIELDS[cat] || LOGGEDTODAY_CATEGORY_FIELDS.other;
  return fields.map(([key, label]) => `<input type="text" data-loggedtoday-field="${idx}:${exi}:${key}" value="${foodSearchEscape(ex[key] || '')}" placeholder="${label}" style="width:110px;padding:5px 6px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12px;">`).join('');
}
function renderLoggedToday(){
  const el = document.getElementById('loggedTodayList');
  if(!el) return;
  const rows = loggedTodayEntries();
  if(!rows.length){
    const isToday = activeSessionDate() === dateStrForOffset(0);
    el.innerHTML = `<div class="dash-empty">Nothing logged ${isToday ? 'yet today' : `for ${formatDateLabel(activeSessionDate())}`}.</div>`;
    return;
  }
  el.innerHTML = rows.map(({e, idx}) => {
    const exRows = (e.exercises || []).map((ex, exi) => {
      const cat = guessLoggedTodayCategory(ex);
      return `
      <div style="padding:6px 0;border-bottom:1px solid var(--line);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px;">
          <span style="font-size:12.5px;flex:1;">${foodSearchEscape(ex.name)}</span>
          <select data-loggedtoday-category="${idx}:${exi}" style="padding:4px 6px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:11px;">
            <option value="strength" ${cat==='strength'?'selected':''}>Strength</option>
            <option value="cardio" ${cat==='cardio'?'selected':''}>Cardio</option>
            <option value="sports" ${cat==='sports'?'selected':''}>Sports</option>
            <option value="other" ${cat==='other'?'selected':''}>Other</option>
          </select>
        </div>
        <div data-loggedtoday-fields="${idx}:${exi}" style="display:flex;flex-wrap:wrap;gap:6px;">
          ${loggedTodayFieldsHtml(idx, exi, ex, cat)}
        </div>
      </div>
    `;
    }).join('');
    return `
    <div class="log-row">
      <div class="log-head" data-loggedtoday-toggle="${idx}">
        <div class="hist-type" style="flex:1;">${foodSearchEscape(e.label)}${e.exercises && e.exercises.length ? ' · ' + e.exercises.length + ' exercise' + (e.exercises.length===1?'':'s') : ''}</div>
        <svg class="log-caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="log-detail" data-loggedtoday-detail="${idx}">
        <div class="log-detail-inner">
          ${exRows || '<div class="log-line">(no exercises listed)</div>'}
          <label style="font-size:11px;color:var(--ink-soft);display:block;margin-top:8px;">Notes</label>
          <textarea data-loggedtoday-notes="${idx}" rows="2" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;font-family:var(--font-body);margin-top:2px;">${foodSearchEscape(e.notes || '')}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="timer-btn start" data-loggedtoday-save="${idx}" type="button" style="flex:1;">Save changes</button>
            <button class="wi-del" data-loggedtoday-delete="${idx}" type="button" title="Delete">✕ Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  el.querySelectorAll('[data-loggedtoday-toggle]').forEach(head=>{
    head.addEventListener('click', ()=>{
      const idx = head.dataset.loggedtodayToggle;
      const detail = el.querySelector(`[data-loggedtoday-detail="${idx}"]`);
      const open = detail.classList.toggle('open');
      head.classList.toggle('expanded', open);
    });
  });
  el.querySelectorAll('[data-loggedtoday-category]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const [idx, exi] = sel.dataset.loggedtodayCategory.split(':');
      const entry = historyLog[parseInt(idx, 10)];
      const ex = entry && entry.exercises[parseInt(exi, 10)];
      if(!ex) return;
      // Read back whatever's currently typed under the old category before
      // swapping fields, so switching categories doesn't drop unsaved input.
      const fieldsEl = el.querySelector(`[data-loggedtoday-fields="${idx}:${exi}"]`);
      fieldsEl.querySelectorAll('[data-loggedtoday-field]').forEach(inp=>{
        const key = inp.dataset.loggedtodayField.split(':')[2];
        ex[key] = inp.value;
      });
      fieldsEl.innerHTML = loggedTodayFieldsHtml(idx, exi, ex, sel.value);
    });
  });
  el.querySelectorAll('[data-loggedtoday-save]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = parseInt(btn.dataset.loggedtodaySave, 10);
      const entry = historyLog[idx];
      if(!entry) return;
      el.querySelectorAll(`[data-loggedtoday-category^="${idx}:"]`).forEach(sel=>{
        const exi = parseInt(sel.dataset.loggedtodayCategory.split(':')[1], 10);
        if(entry.exercises[exi]) entry.exercises[exi].category = sel.value;
      });
      el.querySelectorAll(`[data-loggedtoday-field^="${idx}:"]`).forEach(inp=>{
        const [, exiStr, key] = inp.dataset.loggedtodayField.split(':');
        const exi = parseInt(exiStr, 10);
        if(entry.exercises[exi]) entry.exercises[exi][key] = inp.value;
      });
      const notesEl = el.querySelector(`[data-loggedtoday-notes="${idx}"]`);
      entry.notes = notesEl ? notesEl.value : entry.notes;
      saveHistory();
      renderLoggedToday();
      renderHistory();
      renderDashboard();
      renderTodayGlance();
    });
  });
  el.querySelectorAll('[data-loggedtoday-delete]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = parseInt(btn.dataset.loggedtodayDelete, 10);
      const entry = historyLog[idx];
      if(!entry) return;
      if(!confirm('Delete this logged entry?')) return;
      delete checkedState[entry.date + '_' + entry.day + '_done'];
      historyLog.splice(idx, 1);
      saveChecked();
      saveHistory();
      renderLoggedToday();
      renderHistory();
      renderDashboard();
      renderTally();
      renderWeekPlan();
      renderTodayGlance();
    });
  });
}

// ---------- Today's scheduled session (Workout Plan, legacy or custom) ----------
// Replaces manual day-tab switching: the Train page now always shows whatever
// the Training Plan (with today's override applied) says is scheduled, so
// there's nothing for the user to pick -- just what's actually planned.
// Which "Log a Session" radio is active -- 'plan' (use/pick a Workout Plan),
// 'rest', or 'manual' (Open mode's free-form entry, no library plan involved).
let logSessionMode = 'plan';
// Open mode only: a plan picked one-off for today via "Select workout plan",
// separate from the Training Plan schedule -- nothing is saved until the
// user actually logs against it.
let logSessionSelectedPlanId = null;
// Separate radio memory for when the Workout Dashboard's Daily view is
// showing a past/future day -- the tick-to-complete plan checklist is a
// single shared checkedState, so it only ever means "today"; another
// day's Log a Session only offers Rest/manual entry, tracked here instead
// of overwriting logSessionMode (so today's own selection isn't disturbed
// by paging away and back).
let logSessionModeNonToday = 'rest';

// The date the whole "Log a Session" / checklist / Logged Training section
// operates on -- follows the Workout Dashboard's Daily-view day nav
// (dashSelectedDate) instead of always being today.
function activeSessionDate(){ return dashSelectedDate || dateStrForOffset(0); }

// "Log a Session" is collapsed behind a button, like "Log a meal (full
// page)" on Food -- collapseLogSessionPanel() is also called when leaving
// the Train tab, so it's never left open (or pointed at a stale
// selection) when the user comes back.
function collapseLogSessionPanel(){
  const panel = document.getElementById('logSessionPanel');
  const btn = document.getElementById('logSessionToggleBtn');
  if(panel) panel.style.display = 'none';
  if(btn) btn.textContent = '+ Log a Session';
  logSessionMode = 'plan';
  logSessionModeNonToday = 'rest';
  logSessionSelectedPlanId = null;
}
document.getElementById('logSessionToggleBtn').addEventListener('click', ()=>{
  const panel = document.getElementById('logSessionPanel');
  const btn = document.getElementById('logSessionToggleBtn');
  const showing = panel.style.display !== 'none';
  if(showing){
    collapseLogSessionPanel();
  } else {
    panel.style.display = 'block';
    btn.textContent = '− Log a Session';
    renderTodaysSession();
  }
});

function renderTodaysSession(){
  const dStr = activeSessionDate();
  const isToday = dStr === dateStrForOffset(0);
  const dayIdx = new Date(dStr + 'T00:00:00').getDay();
  const hasSchedule = !!(userTrainingPlan && userTrainingPlan.presetKey && userTrainingPlan.presetKey !== 'open');
  if(!renderTodaysSession._initialized){
    renderTodaysSession._initialized = true;
    if(hasSchedule){
      const seedEntry = effectiveDayEntry(dStr, dayIdx);
      logSessionMode = (seedEntry && seedEntry.type === 'rest') ? 'rest' : 'plan';
    }
  }
  renderLogSessionOptions(hasSchedule, dStr, isToday);

  const titleEl = document.getElementById('loggedTodayTitle');
  if(titleEl) titleEl.textContent = isToday ? 'Logged Training Today' : `Logged Training — ${formatDateLabel(dStr)}`;

  const heading = document.getElementById('sessionPlanHeading');
  const warmup = document.getElementById('warmupBlock');
  const strengthBlock = document.getElementById('strengthBlock');
  const cardioBlock = document.getElementById('cardioBlock');
  const customBlock = document.getElementById('customPlanBlock');
  const hideAllExerciseBlocks = ()=>{
    if(warmup) warmup.style.display = 'none';
    if(strengthBlock) strengthBlock.style.display = 'none';
    if(cardioBlock) cardioBlock.style.display = 'none';
    if(customBlock) customBlock.style.display = 'none';
  };

  if(!isToday){
    // Past/future day: the tick-to-complete checklist only ever applies to
    // today (see logSessionModeNonToday above), so this is Rest/manual
    // entry plus a read-only note about what was scheduled -- actually
    // editing that day's logged exercises happens in "Logged Training"
    // below, which already supports any date.
    hideAllExerciseBlocks();
    if(heading){
      heading.style.display = '';
      const entry = hasSchedule ? effectiveDayEntry(dStr, dayIdx) : (userTrainingPlan && userTrainingPlan.presetKey === 'open' ? window.openModeDayEntry(dStr) : null);
      heading.textContent = `${formatDateLabel(dStr)}: ${entry ? window.planDayLabel(entry) : 'Rest day'}`;
    }
    renderLoggedToday();
    return;
  }

  if(logSessionMode === 'rest'){
    if(heading){ heading.textContent = 'Rest day'; heading.style.display = ''; }
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }
  if(logSessionMode === 'manual'){
    // The manual-exercise form has its own "Add a Manual Exercise" header
    // right above it (inside #logSessionManualPanel) -- showing this one
    // too, with nothing else on the page below it, just left a stray
    // floating heading.
    if(heading) heading.style.display = 'none';
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }

  // logSessionMode === 'plan'
  if(heading) heading.style.display = '';
  let entry;
  if(hasSchedule){
    entry = effectiveDayEntry(dStr, dayIdx);
  } else if(logSessionSelectedPlanId){
    entry = {type: 'workoutPlan', planId: logSessionSelectedPlanId};
  } else {
    entry = null;
  }

  if(!entry || entry.type !== 'workoutPlan'){
    if(heading) heading.textContent = entry && entry.type === 'rest' ? "Today: Rest day" : (hasSchedule ? "No workout scheduled today" : "Pick a workout plan above to get started");
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }
  const plan = getWorkoutPlan(entry.planId);
  if(!plan){
    if(heading) heading.textContent = "Today's plan was removed";
    hideAllExerciseBlocks();
    renderLoggedToday();
    return;
  }

  if(heading) heading.textContent = "Today's Plan: " + plan.name;
  if(plan.kind === 'legacy'){
    if(customBlock) customBlock.style.display = 'none';
    if(warmup) warmup.style.display = 'block';
    setDay(plan.legacyKey);
  } else {
    if(warmup) warmup.style.display = 'block';
    if(strengthBlock) strengthBlock.style.display = 'none';
    if(cardioBlock) cardioBlock.style.display = 'none';
    if(customBlock) customBlock.style.display = 'block';
    renderCustomPlanSession(plan);
  }
  renderLoggedToday();
}

const GENERIC_EXERCISE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11M4 9l3-3M17 20l3-3M2 11l3.5-3.5M18.5 7.5L22 4M3 21l4-4M17 3l4 4"/><circle cx="6" cy="6" r="1.8"/><circle cx="18" cy="18" r="1.8"/></svg>`;
function customItemId(plan, idx){ return 'custom_' + plan.id + '_' + idx; }
let activeCustomPlan = null;
function renderCustomPlanSession(plan){
  activeCustomPlan = plan;
  document.getElementById('customPlanTitle').textContent = plan.name + ' · custom plan';
  const list = document.getElementById('customPlanList');
  list.innerHTML = '';
  (plan.items || []).forEach((item, idx)=>{
    const id = customItemId(plan, idx);
    const name = item.name || (window.workoutActivityName ? window.workoutActivityName(item.activityId) : item.activityId) || 'Exercise';
    const cue = (window.workoutActivityInstructions ? window.workoutActivityInstructions(item.activityId) : '') || 'No form notes yet for this exercise -- check "See example photos" below for proper technique.';
    const isDone = !!checkedState[id];
    const savedW = (window.savedWeights && window.savedWeights[id]) || '';
    const card = document.createElement('div');
    card.className = 'ex-card';
    card.innerHTML = `
      <div class="ex-head" data-id="${id}">
        <div class="ex-icon" style="display:flex;align-items:center;justify-content:center;color:var(--forest-dark);width:52px;height:52px;">${GENERIC_EXERCISE_ICON.replace('<svg ', '<svg style="width:28px;height:28px;" ')}</div>
        <div class="ex-info">
          <div class="ex-name">${foodSearchEscape(name)}</div>
          <div class="ex-scheme">${foodSearchEscape(item.target || '')}</div>
        </div>
        <svg class="caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        <button class="ex-check ${isDone?'done':''}" data-check="${id}">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
      </div>
      <div class="ex-detail" data-detail="${id}">
        <div class="ex-detail-inner">
          <div class="ex-icon-large" style="display:flex;align-items:center;justify-content:center;color:var(--forest-dark);">${GENERIC_EXERCISE_ICON.replace('<svg ', '<svg style="width:64px;height:64px;" ')}</div>
          <strong>Form cue:</strong> ${foodSearchEscape(cue)}
          <div>
            <a class="img-link" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name + ' proper form exercise')}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              See example photos
            </a>
          </div>
          <div class="weight-row">
            <label for="w-${id}">Weight used (kg):</label>
            <input type="number" id="w-${id}" data-weight="${id}" value="${savedW}" placeholder="e.g. 8" min="0" step="0.5">
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
      saveChecked();
    });
  });
  list.querySelectorAll('[data-weight]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      window.savedWeights = window.savedWeights || {};
      window.savedWeights[inp.dataset.weight] = inp.value;
      saveWeights();
    });
  });

  const dStr = dateStrForOffset(0);
  const dayId = 'plan:' + plan.id;
  const existing = historyLog.find(e => e.date === dStr && e.day === dayId);
  document.getElementById('customPlanLoggedNote').textContent = existing
    ? `Logged today at ${new Date(existing.loggedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} (${existing.exercises.length} exercise${existing.exercises.length===1?'':'s'})`
    : '';
  renderExtraExercises('custom');

  const customStats = existing ? existing.stats : null;
  const customStatsEl = document.getElementById('customPlanStatsBlock');
  customStatsEl.innerHTML = `
    ${customStats ? `
    <div class="cardio-row" style="border-bottom:none;flex-wrap:wrap;gap:6px 14px;padding-bottom:8px;">
      ${customStats.duration ? `<span style="font-size:12px;color:var(--ink-soft);">⏱ ${customStats.duration}</span>` : ''}
      ${customStats.calories ? `<span style="font-size:12px;color:var(--ink-soft);">🔥 ${customStats.calories} kcal</span>` : ''}
      ${customStats.hr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ ${customStats.hr} bpm</span>` : ''}
      ${customStats.maxHr ? `<span style="font-size:12px;color:var(--ink-soft);">♥ max ${customStats.maxHr} bpm</span>` : ''}
      ${customStats.trainingStress ? `<span style="font-size:12px;color:var(--ink-soft);">📈 TSS ${customStats.trainingStress}</span>` : ''}
      ${customStats.recoveryHr ? `<span style="font-size:12px;color:var(--ink-soft);">↘ HR recovery ${customStats.recoveryHr} bpm</span>` : ''}
    </div>` : ''}
    <button class="img-link" id="logCustomPlanStatsBtn" style="cursor:pointer;">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      ${customStats ? 'Edit watch stats' : 'Log stats from watch'}
    </button>
  `;
  document.getElementById('logCustomPlanStatsBtn').addEventListener('click', ()=> openStatsForm(dayId));
}
document.getElementById('customPlanCompleteLogBtn').addEventListener('click', ()=>{
  const plan = activeCustomPlan;
  if(!plan) return;
  const dStr = dateStrForOffset(0);
  const dayId = 'plan:' + plan.id;
  const doneItems = (plan.items || []).filter((item, idx)=> checkedState[customItemId(plan, idx)]);
  const snapshot = doneItems.map((item)=>{
    const idx = plan.items.indexOf(item);
    return {
      name: item.name || (window.workoutActivityName ? window.workoutActivityName(item.activityId) : item.activityId),
      weight: (window.savedWeights && window.savedWeights[customItemId(plan, idx)]) || ''
    };
  });
  const extraKey = extraExKey('custom');
  const extras = extraExercisesByPlanDay[extraKey] || [];
  snapshot.push(...extras);
  checkedState[dStr + '_' + dayId + '_done'] = snapshot.length > 0;
  saveChecked();
  upsertSessionLog(dStr, dayId, snapshot, undefined, undefined, plan.name);
  delete extraExercisesByPlanDay[extraKey];
  renderTally();
  renderDashboard();
  renderHistory();
  renderWeekPlan();
  renderCustomPlanSession(plan);
  renderLoggedToday();
  renderTodayGlance();
});
document.getElementById('strengthCompleteLogBtn').addEventListener('click', ()=>{
  const day = currentDay;
  if(!dayData[day]) return;
  const dStr = dateStrForOffset(0);
  const doneExercises = dayData[day].exercises.filter(ex=>checkedState[ex.id]).map(ex=>({
    name: ex.name,
    weight: (window.savedWeights && window.savedWeights[ex.id]) || ''
  }));
  const extraKey = extraExKey('strength');
  const extras = extraExercisesByPlanDay[extraKey] || [];
  doneExercises.push(...extras);
  checkedState[dStr + '_' + day + '_done'] = doneExercises.length > 0;
  saveChecked();
  upsertSessionLog(dStr, day, doneExercises);
  delete extraExercisesByPlanDay[extraKey];
  renderTally();
  renderDashboard();
  renderHistory();
  renderWeekPlan();
  renderStrength(day);
  renderLoggedToday();
  renderTodayGlance();
});

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
    const n = parseFloat(value);
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

function setDay(day){
  currentDay = day;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.day===day));
  if(day==='A' || day==='B'){
    document.getElementById('strengthBlock').style.display = 'block';
    document.getElementById('cardioBlock').style.display = 'none';
    renderStrength(day);
  } else {
    document.getElementById('strengthBlock').style.display = 'none';
    document.getElementById('cardioBlock').style.display = 'block';
    renderCardio(day);
  }
}

document.getElementById('tabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab');
  if(!btn) return;
  setDay(btn.dataset.day);
});

document.querySelector('[data-history-toggle="1"]').addEventListener('click', function(){
  const detail = document.querySelector('[data-history-detail="1"]');
  const open = detail.classList.toggle('open');
  this.classList.toggle('expanded', open);
});

// Today at a Glance cards navigate to their tab on click -- delegated on the grid
// containers (whose innerHTML gets rebuilt on every render) rather than per-card,
// and skipped when the click actually landed on an interactive control inside the
// card (Water's +/- buttons).
function wireGlanceCardNav(gridEl){
  if(!gridEl) return;
  gridEl.addEventListener('click', (e)=>{
    if(e.target.closest('button, input, select, a, textarea')) return;
    const card = e.target.closest('[data-nav-view]');
    if(!card) return;
    window.showView(card.dataset.navView);
  });
}
wireGlanceCardNav(document.getElementById('glanceGridTop'));
wireGlanceCardNav(document.getElementById('glanceGridMid'));

async function startApp(){
  // Theme: load saved preference (defaults to dark if none saved yet)
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'theme', false);
    if(res && res.value === 'light'){
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }catch(e){
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  document.getElementById('themeToggle').addEventListener('click', async ()=>{
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if(isDark){
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    try{ await window.storage.set(STORAGE_PREFIX + 'theme', isDark ? 'light' : 'dark', false); }catch(e){}
  });

  // Navigation: 5 peer tabs (Today/Body/Food/Train/Insights), shown as a top bar
  // on wide screens and a fixed bottom bar on narrow ones (see @media 760px).
  // Both bars are wired identically via the shared .tab-nav-btn/.bottom-nav-btn classes.
  const viewPanels = {
    today: 'panelToday', body: 'panelBody', food: 'panelNutrition',
    train: 'panelTrain', insights: 'panelInsights', account: 'panelAccount'
  };
  function showView(view){
    Object.entries(viewPanels).forEach(([key, id])=>{
      const el = document.getElementById(id);
      if(el) el.style.display = (key === view) ? 'block' : 'none';
    });
    document.querySelectorAll('.tab-nav-btn, .bottom-nav-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.getElementById('scrollArea').scrollTop = 0;
    if(view !== 'body'){
      // Weigh-in History defaults to collapsed and stays that way -- leaving
      // the Body tab always closes it back up rather than remembering it
      // was left open.
      const wiDetail = document.querySelector('[data-weighin-history-detail="1"]');
      const wiHead = document.querySelector('[data-weighin-history-toggle="1"]');
      if(wiDetail) wiDetail.classList.remove('open');
      if(wiHead) wiHead.classList.remove('expanded');
      weighInHistPage = 0;
    }
    if(view !== 'train'){
      collapseLogSessionPanel();
    }
    if(view === 'body'){ renderBodyPlaceholders(); renderBodySleepCard(); renderWeightSection(); }
    if(view === 'train'){ renderDashboard(); renderTodaysSession(); }
    if(view === 'insights'){ renderInsights(); renderSummary(); }
    if(view === 'account') showAccountView(currentAccountView);
  }
  window.showView = showView;

  function onTabNavClick(e){
    const btn = e.target.closest('.tab-nav-btn, .bottom-nav-btn');
    if(!btn) return;
    showView(btn.dataset.view);
  }
  document.getElementById('tabNavTop').addEventListener('click', onTabNavClick);
  document.getElementById('tabNavBottom').addEventListener('click', onTabNavClick);
  document.querySelector('.topbar-brand').addEventListener('click', ()=> showView('today'));

  // Account sub-nav: Snapshot / My data / Goals / Account / Feedback
  const accountViewPanels = {
    snapshot: 'accountSnapshot', mydata: 'accountMyData',
    goals: 'accountGoals', settings: 'accountSettings', feedback: 'accountFeedback',
    admin: 'accountAdmin'
  };
  let currentAccountView = 'snapshot';
  function showAccountView(view){
    currentAccountView = view;
    Object.entries(accountViewPanels).forEach(([key, id])=>{
      const el = document.getElementById(id);
      if(el) el.style.display = (key === view) ? 'block' : 'none';
    });
    document.querySelectorAll('.subnav-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.accountView === view);
    });
    if(view === 'snapshot') renderAccountSnapshot();
    if(view === 'goals') renderAccountGoals();
    if(view === 'settings') renderAccountSettings();
    if(view === 'admin') renderAdminPanel();
  }
  window.showAccountView = showAccountView;
  document.getElementById('accountSubnav').addEventListener('click', (e)=>{
    const btn = e.target.closest('.subnav-btn');
    if(!btn) return;
    showAccountView(btn.dataset.accountView);
  });

  await loadState();
  await loadHistory();
  await loadWeighIns();
  await loadNutrition();
  await loadProfile();
  await loadFasting();
  await loadWater();
  await loadSleep();
  await loadSteps();
  await loadRecentFoods();
  await loadFavoriteFoods();
  await loadCustomWorkoutPlans();
  await loadTrainingPlan();
  if(window.loadWorkoutCatalog) await window.loadWorkoutCatalog();


  renderDashboard();
  renderHistory();
  renderWeekPlan();
  renderWeightSection();
  renderNutrition();
  renderFasting();
  renderTodaysSession();
  renderTally();
  renderBodyPlaceholders();
  renderBodySleepCard();
  document.getElementById('exportBtn').addEventListener('click', exportLogCSV);

  const customForm = document.getElementById('customForm');
  const customDate = document.getElementById('customDate');
  const customNotes = document.getElementById('customNotes');
  document.getElementById('addCustomBtn').addEventListener('click', ()=>{
    customDate.value = dateStrForOffset(0);
    customNotes.value = '';
    customForm.style.display = customForm.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('cancelCustomBtn').addEventListener('click', ()=>{
    customForm.style.display = 'none';
  });
  document.getElementById('saveCustomBtn').addEventListener('click', ()=>{
    if(!customNotes.value.trim()) return;
    logCustomEntry(customDate.value || dateStrForOffset(0), customNotes.value.trim());
    customForm.style.display = 'none';
    renderHistory();
    renderDashboard();
  });

  document.getElementById('weighInDate').value = dateStrForOffset(0);
  document.getElementById('addWeighInBtn').addEventListener('click', ()=>{
    const dateInput = document.getElementById('weighInDate');
    const kgInput = document.getElementById('weighInKg');
    const kg = displayWeightToKg(kgInput.value);
    if(!kg || kg <= 0) return;
    addWeighIn(dateInput.value || dateStrForOffset(0), kg);
    kgInput.value = '';
    dateInput.value = dateStrForOffset(0);
    weighInHistPage = 0;
    renderWeightSection();
    renderTodayGlance();
  });

  document.querySelector('[data-weighin-history-toggle="1"]').addEventListener('click', function(){
    const detail = document.querySelector('[data-weighin-history-detail="1"]');
    const open = detail.classList.toggle('open');
    this.classList.toggle('expanded', open);
  });
  document.getElementById('weighInHistPrev').addEventListener('click', ()=>{
    weighInHistPage++;
    renderWeightSection();
  });
  document.getElementById('weighInHistNext').addEventListener('click', ()=>{
    weighInHistPage--;
    renderWeightSection();
  });

  document.getElementById('summaryRange').addEventListener('change', renderSummary);
  document.getElementById('nutriRange').addEventListener('change', renderNutrition);
  document.getElementById('dashRange').addEventListener('change', renderDashboard);

  const BACKUP_RESOURCES = ['nutrition', 'weighins', 'history', 'checked', 'weights', 'theme', 'profile', 'fasting', 'water', 'sleep', 'steps', 'recentFoods', 'favoriteFoods', 'workoutPlan', 'trainingPlan', 'customWorkoutPlans'];

  document.getElementById('exportBackupBtn').addEventListener('click', async ()=>{
    const backup = {};
    for(const resource of BACKUP_RESOURCES){
      const res = await window.storage.get(STORAGE_PREFIX + resource);
      backup[resource] = res ? res.value : null;
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full-circle-backup-${dateStrForOffset(0)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('importBackupBtn').addEventListener('click', ()=>{
    document.getElementById('importBackupFile').click();
  });
  document.getElementById('importBackupFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const status = document.getElementById('backupStatus');
    const reader = new FileReader();
    reader.onload = async ()=>{
      try{
        const data = JSON.parse(reader.result);
        for(const resource of BACKUP_RESOURCES){
          if(data[resource] !== null && data[resource] !== undefined){
            await window.storage.set(STORAGE_PREFIX + resource, data[resource]);
          }
        }
        status.style.color = 'var(--forest-dark)';
        status.textContent = 'Restored ✓ — reloading...';
        status.style.display = 'block';
        setTimeout(()=> location.reload(), 800);
      }catch(err){
        status.style.color = '#B4472A';
        status.textContent = 'Could not read that file — is it a backup exported from this app?';
        status.style.display = 'block';
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('importStructuredBtn').addEventListener('click', ()=>{
    document.getElementById('importStructuredFile').click();
  });
  document.getElementById('importStructuredFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const status = document.getElementById('importStructuredStatus');
    const reader = new FileReader();
    reader.onload = async ()=>{
      try{
        const data = JSON.parse(reader.result);
        status.style.color = 'var(--forest-dark)';
        status.style.display = 'block';
        await importStructuredData(data, status);
      }catch(err){
        status.style.color = '#B4472A';
        status.textContent = 'Could not read that file — check it matches the import schema (data-import-schema.md).';
        status.style.display = 'block';
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

