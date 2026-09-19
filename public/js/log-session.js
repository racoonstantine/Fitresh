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

