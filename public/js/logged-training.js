// ---------- "Logged Training" -- the selected day's entries ----------
// Each entry is a collapsible card: an icon, the routine/activity name and a
// small line of whichever stats exist (duration, kcal, distance, steps, HR).
// Opening it shows the exercises read-only; the ✎ Edit button switches to
// edit mode (change values, add or remove activities, edit notes), so nothing
// is changed by accident.
function loggedTodayEntries(){
  const dStr = activeSessionDate();
  return historyLog.map((e, idx) => ({e, idx})).filter(({e}) => e.date === dStr);
}
// Which fields make sense to edit per activity category -- keeps the edit
// form from showing every possible metric for every exercise.
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
function loggedTodayFieldsHtml(key, exi, ex, cat){
  const fields = LOGGEDTODAY_CATEGORY_FIELDS[cat] || LOGGEDTODAY_CATEGORY_FIELDS.other;
  return fields.map(([field, label]) => `<input type="text" inputmode="decimal" data-num data-lt-field="${exi}:${field}" value="${foodSearchEscape(ex[field] || '')}" placeholder="${label}" aria-label="${label}" style="width:110px;padding:5px 7px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12px;">`).join('');
}

// One entry's icon: rest/cardio/strength by its kind, else by its first exercise.
function loggedEntryEmoji(e){
  if(e.day === 'rest') return '😴';
  if(e.day === 'A' || e.day === 'B') return '🏋️';
  if(e.day === 'steady' || e.day === 'interval') return activityEmoji((e.exercises && e.exercises[0] && e.exercises[0].name) || '', 'cardio');
  const first = e.exercises && e.exercises[0];
  if(first) return activityEmoji(first.name, guessLoggedTodayCategory(first));
  return e.day === 'custom' ? '✍️' : '🏋️';
}
// Colour family for a card's edge: rest, cardio, strength, or other.
function loggedEntryKind(e){
  if(e.day === 'rest') return 'rest';
  if(e.day === 'A' || e.day === 'B') return 'strength';
  if(e.day === 'steady' || e.day === 'interval') return 'cardio';
  const first = e.exercises && e.exercises[0];
  const cat = first ? guessLoggedTodayCategory(first) : 'other';
  return cat === 'strength' ? 'strength' : (cat === 'cardio' ? 'cardio' : 'other');
}
// "⏱ 45:00 · 🔥 1,180 kcal · 📍 5.2 km · 👟 6,800 steps · ♥ 132 bpm" -- only what exists.
function loggedStatsLine(stats){
  if(!stats) return '';
  const parts = [];
  if(stats.duration) parts.push(`⏱ ${foodSearchEscape(stats.duration)}`);
  if(stats.calories) parts.push(`🔥 ${fmtNum(stats.calories)} kcal`);
  if(stats.distance) parts.push(`📍 ${foodSearchEscape(String(stats.distance))} km`);
  if(stats.steps) parts.push(`👟 ${fmtNum(stats.steps)} steps`);
  if(stats.hr) parts.push(`♥ ${foodSearchEscape(String(stats.hr))} bpm`);
  return parts.join(' · ');
}
// Metrics for one exercise, without its name.
function exerciseMetricsText(ex){
  const parts = [];
  if(ex.sets && ex.reps) parts.push(`${ex.sets} × ${ex.reps}`);
  else { if(ex.sets) parts.push(`${ex.sets} sets`); if(ex.reps) parts.push(`${ex.reps} reps`); }
  if(ex.weight) parts.push(`${ex.weight} kg`);
  if(ex.duration) parts.push(`${ex.duration} min`);
  if(ex.distance) parts.push(`${ex.distance} km`);
  if(ex.intensity) parts.push(`intensity ${ex.intensity}`);
  return parts.join(' · ');
}

// Which cards are expanded and which one is in edit mode survive re-renders
// (keyed by date + day id, since list positions shift as entries change).
let loggedTodayOpen = new Set();
let loggedTodayEdit = null; // {key, exercises: [...draft], notes}
function loggedEntryKey(e){ return e.date + '|' + e.day; }

function loggedTodayViewHtml(e, key, idx){
  const exRows = (e.exercises || []).map(ex => `
    <div class="lt-ex">
      <span class="lt-ex-icon">${activityEmoji(ex.name, guessLoggedTodayCategory(ex))}</span>
      <div style="min-width:0;flex:1;">
        <div style="font-size:12.5px;">${foodSearchEscape(ex.name)}</div>
        ${exerciseMetricsText(ex) ? `<div class="lt-sub">${foodSearchEscape(exerciseMetricsText(ex))}</div>` : ''}
      </div>
    </div>`).join('');
  return `
    ${exRows || '<div class="log-line">(no exercises listed)</div>'}
    ${e.notes ? `<div class="lt-notes"><span class="lt-sub">Notes</span><div style="font-size:12.5px;white-space:pre-wrap;">${foodSearchEscape(e.notes)}</div></div>` : ''}
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="timer-btn" data-lt-edit="${idx}" type="button" style="flex:1;">✎ Edit</button>
      <button class="timer-btn" data-lt-stats="${idx}" type="button" style="flex:1;">📊 ${e.stats ? 'Edit stats' : 'Add stats'}</button>
    </div>`;
}

function loggedTodayEditHtml(e, draft, idx){
  const exRows = draft.exercises.map((ex, exi) => {
    const cat = guessLoggedTodayCategory(ex);
    return `
    <div style="padding:6px 0;border-bottom:1px solid var(--line);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px;">
        <span style="font-size:12.5px;flex:1;">${activityEmoji(ex.name, cat)} ${foodSearchEscape(ex.name)}</span>
        <select data-lt-cat="${exi}" aria-label="Category" style="padding:4px 6px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:11px;">
          <option value="strength" ${cat === 'strength' ? 'selected' : ''}>Strength</option>
          <option value="cardio" ${cat === 'cardio' ? 'selected' : ''}>Cardio</option>
          <option value="sports" ${cat === 'sports' ? 'selected' : ''}>Sports</option>
          <option value="other" ${cat === 'other' ? 'selected' : ''}>Other</option>
        </select>
        <button type="button" data-lt-remove="${exi}" aria-label="Remove ${foodSearchEscape(ex.name)}" style="background:none;border:none;color:inherit;cursor:pointer;font-size:14px;">✕</button>
      </div>
      <div data-lt-fields="${exi}" style="display:flex;flex-wrap:wrap;gap:6px;">${loggedTodayFieldsHtml(draft.key, exi, ex, cat)}</div>
    </div>`;
  }).join('');
  return `
    ${exRows || '<div class="log-line">(no exercises listed)</div>'}
    <div class="lt-add">
      <div class="lt-sub" style="margin-bottom:4px;">Add an activity</div>
      <div style="display:flex;gap:6px;align-items:stretch;">
        <select data-lt-add-cat aria-label="Category" style="flex:0 0 auto;padding:6px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12px;">
          ${Object.entries(MANUAL_CATEGORIES).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('')}
        </select>
        <input type="text" data-lt-add-name aria-label="Activity name" placeholder="Activity name" autocomplete="off" style="flex:1;min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;">
        <button type="button" class="timer-btn" data-lt-add-search aria-label="Search the library" title="Search the library" style="flex:0 0 auto;width:auto;padding:6px 10px;">🔍</button>
        <button type="button" class="timer-btn start" data-lt-add-btn style="flex:0 0 auto;width:auto;padding:6px 12px;">+ Add</button>
      </div>
      <div data-lt-add-results style="margin-top:4px;"></div>
    </div>
    <label class="lt-sub" style="display:block;margin-top:8px;">Notes</label>
    <textarea data-lt-notes rows="2" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;font-family:var(--font-body,inherit);margin-top:2px;resize:vertical;">${foodSearchEscape(draft.notes || '')}</textarea>
    <div data-lt-error class="note" style="display:none;color:#B4472A;margin-top:6px;"></div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="timer-btn start" data-lt-save="${idx}" type="button" style="flex:1;">Save changes</button>
      <button class="timer-btn" data-lt-cancel="${idx}" type="button" style="flex:1;">Cancel</button>
      <button class="wi-del" data-lt-delete="${idx}" type="button" title="Delete this entry">✕ Delete</button>
    </div>`;
}

function renderLoggedToday(){
  const el = document.getElementById('loggedTodayList');
  if(!el) return;
  const rows = loggedTodayEntries();
  if(!rows.length){
    loggedTodayEdit = null;
    const isToday = activeSessionDate() === dateStrForOffset(0);
    el.innerHTML = `<div class="dash-empty">Nothing logged ${isToday ? 'yet today' : `for ${formatDateLabel(activeSessionDate())}`}.</div>`;
    return;
  }
  // An edit that belongs to a different day (the user paged away) is dropped.
  if(loggedTodayEdit && !rows.some(({e}) => loggedEntryKey(e) === loggedTodayEdit.key)) loggedTodayEdit = null;

  el.innerHTML = rows.map(({e, idx}) => {
    const key = loggedEntryKey(e);
    const editing = !!loggedTodayEdit && loggedTodayEdit.key === key;
    const open = loggedTodayOpen.has(key) || editing;
    const statsLine = loggedStatsLine(e.stats);
    const count = e.exercises && e.exercises.length ? ` · ${e.exercises.length} exercise${e.exercises.length === 1 ? '' : 's'}` : '';
    return `
    <div class="log-row" data-kind="${loggedEntryKind(e)}" data-lt-key="${foodSearchEscape(key)}">
      <div class="log-head ${open ? 'expanded' : ''}" data-loggedtoday-toggle="${idx}" style="align-items:center;">
        <span class="lt-icon">${loggedEntryEmoji(e)}</span>
        <div style="flex:1;min-width:0;">
          <div class="hist-type">${foodSearchEscape(e.label)}${count}</div>
          ${statsLine ? `<div class="lt-sub">${statsLine}</div>` : ''}
        </div>
        <svg class="log-caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="log-detail ${open ? 'open' : ''}" data-loggedtoday-detail="${idx}">
        <div class="log-detail-inner">${editing ? loggedTodayEditHtml(e, loggedTodayEdit, idx) : loggedTodayViewHtml(e, key, idx)}</div>
      </div>
    </div>`;
  }).join('');

  const entryAt = idx => historyLog[parseInt(idx, 10)];
  el.querySelectorAll('[data-loggedtoday-toggle]').forEach(head => {
    head.addEventListener('click', ()=>{
      const entry = entryAt(head.dataset.loggedtodayToggle);
      const detail = el.querySelector(`[data-loggedtoday-detail="${head.dataset.loggedtodayToggle}"]`);
      const isOpen = detail.classList.toggle('open');
      head.classList.toggle('expanded', isOpen);
      if(entry){ if(isOpen) loggedTodayOpen.add(loggedEntryKey(entry)); else loggedTodayOpen.delete(loggedEntryKey(entry)); }
    });
  });
  el.querySelectorAll('[data-lt-edit]').forEach(btn => {
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const entry = entryAt(btn.dataset.ltEdit);
      if(!entry) return;
      loggedTodayEdit = {key: loggedEntryKey(entry), exercises: (entry.exercises || []).map(x => ({...x})), notes: entry.notes || ''};
      loggedTodayOpen.add(loggedTodayEdit.key);
      renderLoggedToday();
    });
  });
  el.querySelectorAll('[data-lt-stats]').forEach(btn => {
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const entry = entryAt(btn.dataset.ltStats);
      if(entry) openStatsForm(entry.day, entry.date);
    });
  });
  if(loggedTodayEdit) wireLoggedTodayEdit(el);
}

// Reads the edit form's current values back into the draft (before a re-render
// caused by adding/removing an activity, and before saving).
function syncLoggedTodayDraft(scope){
  const draft = loggedTodayEdit;
  scope.querySelectorAll('[data-lt-cat]').forEach(sel => {
    const ex = draft.exercises[parseInt(sel.dataset.ltCat, 10)];
    if(ex) ex.category = sel.value;
  });
  scope.querySelectorAll('[data-lt-field]').forEach(inp => {
    const [exi, field] = inp.dataset.ltField.split(':');
    const ex = draft.exercises[parseInt(exi, 10)];
    if(ex) ex[field] = inp.value.trim();
  });
  const notesEl = scope.querySelector('[data-lt-notes]');
  if(notesEl) draft.notes = notesEl.value;
}

function wireLoggedTodayEdit(el){
  const scope = el.querySelector(`[data-lt-key="${CSS.escape(loggedTodayEdit.key)}"]`);
  if(!scope) return;
  const entry = historyLog.find(e => loggedEntryKey(e) === loggedTodayEdit.key);
  if(!entry) return;
  const errEl = scope.querySelector('[data-lt-error]');

  // Category change swaps that exercise's fields, keeping what was typed.
  scope.querySelectorAll('[data-lt-cat]').forEach(sel => {
    sel.addEventListener('change', ()=>{
      syncLoggedTodayDraft(scope);
      renderLoggedToday();
    });
  });
  scope.querySelectorAll('[data-lt-remove]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      syncLoggedTodayDraft(scope);
      loggedTodayEdit.exercises.splice(parseInt(btn.dataset.ltRemove, 10), 1);
      renderLoggedToday();
    });
  });

  // Add an activity: typed name, or picked from the library search.
  const addCat = scope.querySelector('[data-lt-add-cat]');
  const addName = scope.querySelector('[data-lt-add-name]');
  const results = scope.querySelector('[data-lt-add-results]');
  let chosenId = null;
  const addActivity = (name, activityId, catKey)=>{
    syncLoggedTodayDraft(scope);
    loggedTodayEdit.exercises.push({name, activityId: activityId || null, category: MANUAL_CATEGORIES[catKey].logCat});
    renderLoggedToday();
  };
  const search = force => {
    const matches = librarySearchMatches(addName.value, addCat.value, force);
    if(!matches.length){ results.innerHTML = (addName.value.trim() || force) ? '<div class="note" style="margin:0;">Not in the library — it will be added just as typed.</div>' : ''; return; }
    results.innerHTML = matches.map(a => `<button type="button" class="timer-btn" data-lt-pick="${foodSearchEscape(a.id)}" style="display:block;width:100%;text-align:left;margin-top:3px;padding:5px 8px;font-size:12px;">${activityEmoji(a.name, a.category)} ${foodSearchEscape(a.name)}</button>`).join('');
    results.querySelectorAll('[data-lt-pick]').forEach(b => b.addEventListener('click', ()=>{
      const activity = matches.find(a => a.id === b.dataset.ltPick);
      addActivity(activity.name, activity.id, manualCategoryForCatalog(activity.category) || addCat.value);
    }));
  };
  let timer = null;
  addName.addEventListener('input', ()=>{ chosenId = null; clearTimeout(timer); timer = setTimeout(()=> search(false), 250); });
  addName.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); clearTimeout(timer); search(true); } });
  scope.querySelector('[data-lt-add-search]').addEventListener('click', ()=>{ clearTimeout(timer); search(true); });
  scope.querySelector('[data-lt-add-btn]').addEventListener('click', ()=>{
    const name = addName.value.trim();
    if(!name){ errEl.textContent = 'Enter an activity name, or pick one from the library.'; errEl.style.display = 'block'; return; }
    addActivity(name, chosenId, addCat.value);
  });

  scope.querySelector('[data-lt-cancel]').addEventListener('click', ()=>{
    loggedTodayEdit = null;
    renderLoggedToday();
  });
  scope.querySelector('[data-lt-save]').addEventListener('click', ()=>{
    if(!validateNumFields(scope)){
      const bad = scope.querySelector('input:invalid');
      errEl.textContent = (bad && bad.validationMessage) || 'Check the numbers you entered.';
      errEl.style.display = 'block';
      return;
    }
    syncLoggedTodayDraft(scope);
    entry.exercises = loggedTodayEdit.exercises;
    entry.notes = loggedTodayEdit.notes;
    loggedTodayEdit = null;
    saveHistory();
    renderLoggedToday();
    renderHistory();
    renderDashboard();
    renderTodayGlance();
  });
  scope.querySelector('[data-lt-delete]').addEventListener('click', ()=>{
    if(!confirm('Delete this logged entry?')) return;
    delete checkedState[entry.date + '_' + entry.day + '_done'];
    historyLog.splice(historyLog.indexOf(entry), 1);
    loggedTodayEdit = null;
    saveChecked();
    saveHistory();
    renderLoggedToday();
    renderHistory();
    renderDashboard();
    renderTally();
    renderWeekPlan();
    renderTodayGlance();
  });
}
