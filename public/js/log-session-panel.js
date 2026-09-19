// ---------- Log a Session panel ----------
// A self-contained panel: it builds its own markup and wires its own events,
// so it can be mounted into any container with mountLogSessionPanel(el) --
// today that's the Train tab, and the Workout Routines screen can call the
// same function to host it. Only one instance exists at a time (mounting
// again moves it).
//
// Four ways to log a session:
//   plan    -- Select Workout Routine (today: tick-through checklist below the
//              panel; any other date: a "which did you do?" checklist here)
//   rest    -- Rest day, with an optional note
//   manual  -- Add Manual Exercise (category + library-searchable name)
//   ai      -- Use AI Assist (estimate / read watch stats, optionally with a name)

const LOG_SESSION_MODES = [
  {value: 'plan', icon: '📋', label: 'Select Workout Routine', note: 'Follow or log a saved routine'},
  {value: 'rest', icon: '😴', label: 'Rest', note: 'Take a recovery day'},
  {value: 'manual', icon: '✍️', label: 'Add Manual Exercise', note: 'Log exercises you did'},
  {value: 'ai', icon: '🤖', label: 'Use AI Assist', note: 'Good for estimating and reading health-watch stats data'}
];

// Manual-exercise categories: which library category they search, which
// "Logged Training" category they save as, and which metrics apply.
const MANUAL_CATEGORIES = {
  strength: {label: 'Strength', catalog: 'strength', logCat: 'strength', fields: [['sets', 'Sets'], ['reps', 'Reps'], ['weight', 'Weight (kg)']]},
  cardio: {label: 'Cardio', catalog: 'cardio', logCat: 'cardio', fields: [['duration', 'Duration (min)'], ['distance', 'Distance (km)']]},
  sport: {label: 'Sport', catalog: 'sport', logCat: 'sports', fields: [['duration', 'Duration (min)'], ['intensity', 'Intensity (1-10)']]},
  mobility: {label: 'Mobility', catalog: 'mobility', logCat: 'other', fields: [['duration', 'Duration (min)'], ['sets', 'Sets'], ['reps', 'Reps']]}
};

// Emoji for an activity, by what its name suggests, falling back to its category.
const ACTIVITY_EMOJI_RULES = [
  [/walk|hike|march/i, '🚶'], [/run|jog|sprint|treadmill/i, '🏃'], [/cycl|bike|spin/i, '🚴'],
  [/swim/i, '🏊'], [/row/i, '🚣'], [/elliptic|stair|jump rope|skipping/i, '🏃'],
  [/yoga|stretch|mobility|pilates|cat.?cow/i, '🧘'], [/basketball/i, '🏀'], [/football|soccer/i, '⚽'],
  [/tennis|pickleball|badminton|squash|racket/i, '🎾'], [/volleyball/i, '🏐'], [/box|martial|kick/i, '🥊']
];
function activityEmoji(name, category){
  const text = String(name || '');
  for(const [re, emoji] of ACTIVITY_EMOJI_RULES){ if(re.test(text)) return emoji; }
  if(category === 'cardio') return '🏃';
  if(category === 'sports' || category === 'sport') return '⚽';
  if(category === 'other' || category === 'mobility') return '🧘';
  return '🏋️';
}

// Library search shared by the manual form and the Logged Training editor.
// Returns up to 8 catalog activities of the category matching the query; an
// empty query only returns results when force is true (the search button).
function librarySearchMatches(query, categoryKey, force){
  const q = String(query || '').trim().toLowerCase();
  if(!q && !force) return [];
  const wanted = (MANUAL_CATEGORIES[categoryKey] || {}).catalog;
  const catalog = window.getWorkoutCatalog ? window.getWorkoutCatalog() : [];
  return catalog
    .filter(a => (!a.phase || a.phase === 'main') && (!wanted || a.category === wanted) && (!q || a.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);
}
function manualCategoryForCatalog(catalogCategory){
  const hit = Object.entries(MANUAL_CATEGORIES).find(([, c]) => c.catalog === catalogCategory);
  return hit ? hit[0] : null;
}

// ---- state shared with the stats form (stats-form.js reads/writes these) ----
let manualExPending = [];
let manualExChosenActivityId = null;
let manualExPendingStats = null; // set via the shared AI-assist/watch-stats form; attached on Save session

const LSP_INPUT_STYLE = 'padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;';

function logSessionPanelHtml(){
  return `
    <button type="button" id="logSessionToggleBtn" class="timer-btn start lsp-toggle" style="width:100%;">+ Log a Session</button>
    <div id="logSessionPanel" style="display:none;margin-top:12px;">
      <div class="lsp-title">How do you want to log it?</div>
      <div id="logSessionOptions" class="lsp-opts"></div>

      <div id="logSessionPlanPicker" style="display:none;margin-bottom:10px;">
        <label id="logSessionPlanLabel" style="font-size:11px;color:var(--ink-soft);">Choose a workout routine</label>
        <select id="logSessionPlanSelect" style="width:100%;${LSP_INPUT_STYLE}margin-top:2px;"></select>
      </div>
      <div id="logSessionPastRoutine" style="display:none;margin-bottom:10px;"></div>

      <div id="logSessionRestPanel" style="display:none;margin-bottom:10px;">
        <label style="font-size:11px;color:var(--ink-soft);">Notes (optional)</label>
        <textarea id="logSessionRestNotes" rows="2" placeholder="e.g. sore legs, taking it easy today" style="width:100%;${LSP_INPUT_STYLE}margin-top:2px;resize:vertical;"></textarea>
        <button class="timer-btn start" id="logSessionRestSaveBtn" type="button" style="width:100%;margin-top:8px;">Save rest day</button>
      </div>

      <div id="logSessionManualPanel" style="display:none;margin-bottom:6px;">
        <div style="display:flex;gap:6px;align-items:stretch;">
          <select id="manualExCategory" aria-label="Category" style="flex:0 0 auto;${LSP_INPUT_STYLE}">
            ${Object.entries(MANUAL_CATEGORIES).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('')}
          </select>
          <input type="text" id="manualExName" aria-label="Activity name" placeholder="Activity name — searches the library" autocomplete="off" style="flex:1;min-width:0;${LSP_INPUT_STYLE}">
          <button type="button" id="manualExSearchBtn" class="timer-btn" aria-label="Search the library" title="Search the library" style="flex:0 0 auto;width:auto;padding:7px 11px;">🔍</button>
        </div>
        <div id="manualExSearchResults" style="margin:6px 0;"></div>
        <div id="manualExFields" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;"></div>
        <div id="manualExError" class="note" style="display:none;color:#B4472A;margin-top:6px;"></div>
        <button class="timer-btn start" id="manualExAddBtn" type="button" style="width:100%;margin-top:8px;">+ Add exercise</button>
        <div id="manualExPending" style="margin-top:10px;"></div>
        <button class="today-btn" id="manualExSaveBtn" type="button" style="width:100%;margin-top:10px;padding:11px 0;display:none;">Save session</button>
      </div>

      <div id="logSessionAiPanel" style="display:none;margin-bottom:6px;">
        <div class="ai-guide">
          <strong>🤖 AI Assist</strong> — good for estimating and reading health-watch stats data.
          <ol>
            <li>Describe what you did below</li>
            <li>Copy the prompt into your AI chat (ChatGPT, Gemini…)</li>
            <li>Paste its reply back, review the numbers, save</li>
          </ol>
        </div>
        <label class="lsp-label" for="aiSessDesc">What did you do?</label>
        <textarea id="aiSessDesc" rows="3" placeholder="e.g. Strength: squats 3×10 @ 20 kg, rows 3×12 @ 15 kg. 45 min total. Felt strong, knees a bit tight." style="width:100%;${LSP_INPUT_STYLE}margin-top:2px;resize:vertical;"></textarea>
        <div class="ai-tips">💡 Include the type of workout, sets · reps · weight, duration, and how it felt. For a better estimate, attach a screenshot of your sports-watch summary to your AI chat.</div>
        <button class="timer-btn start" id="aiSessGenerateBtn" type="button" style="width:100%;">✨ Generate prompt</button>

        <div id="aiSessPromptWrap" style="display:none;margin-top:12px;">
          <label class="lsp-label" for="aiSessPromptOut">Copy this into your AI chat</label>
          <textarea id="aiSessPromptOut" rows="7" readonly style="width:100%;${LSP_INPUT_STYLE}background:var(--paper-raised);margin-top:2px;font-size:12px;font-family:monospace;"></textarea>
          <button type="button" id="aiSessCopyBtn" class="timer-btn" style="width:100%;margin-top:6px;">📋 Copy prompt</button>
          <div id="aiSessCopied" class="note" style="margin-top:6px;"></div>

          <label class="lsp-label" for="aiSessReplyIn" style="margin-top:12px;display:block;">Paste the AI's reply here</label>
          <textarea id="aiSessReplyIn" rows="6" placeholder="Paste the reply from ChatGPT / Gemini / etc. here" style="width:100%;${LSP_INPUT_STYLE}margin-top:2px;resize:vertical;"></textarea>
          <div id="aiSessParseError" class="note" style="display:none;color:#B4472A;margin-top:6px;"></div>
          <button type="button" id="aiSessParseBtn" class="timer-btn start" style="width:100%;margin-top:8px;">Parse &amp; review</button>
        </div>

        <div id="aiSessReview" style="display:none;margin-top:14px;">
          <div class="lsp-title" style="margin-bottom:6px;">Review before saving</div>
          <label class="lsp-label" for="aiRevName">Session name</label>
          <input type="text" id="aiRevName" placeholder="e.g. Evening jog" style="width:100%;${LSP_INPUT_STYLE}margin:2px 0 8px;">
          <div id="aiRevFields" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>
          <div id="aiSessSaveError" class="note" style="display:none;color:#B4472A;margin-top:8px;"></div>
          <button class="today-btn" id="aiSessSaveBtn" type="button" style="width:100%;margin-top:10px;padding:11px 0;">Save session</button>
        </div>
      </div>
    </div>`;
}

// Builds (once) and mounts the panel into a container; mounting again moves it.
function mountLogSessionPanel(container){
  let root = document.getElementById('logSessionRoot');
  if(!root){
    root = document.createElement('div');
    root.id = 'logSessionRoot';
    root.innerHTML = logSessionPanelHtml();
    container.appendChild(root);
    wireLogSessionPanel();
  } else if(root.parentNode !== container){
    container.appendChild(root);
  }
  return root;
}

// After any successful save: close the panel (which also wipes its fields)
// and refresh everything that shows sessions.
function finishLogSessionSave(){
  collapseLogSessionPanel();
  renderWeekPlan();
  renderDashboard();
  renderHistory();
  renderTally();
  renderTodaysSession();
  renderLoggedToday();
  renderTodayGlance();
}

// Clears every field/result/selection in the panel and returns it to the
// first option. Called whenever the panel collapses (including on tab change).
function resetLogSessionPanel(){
  manualExPending = [];
  manualExPendingStats = null;
  manualExChosenActivityId = null;
  const set = (id, value) => { const el = document.getElementById(id); if(el) el.value = value; };
  set('manualExName', '');
  set('logSessionRestNotes', '');
  set('manualExCategory', 'strength');
  resetAiSessionFlow();
  const clear = id => { const el = document.getElementById(id); if(el) el.innerHTML = ''; };
  clear('manualExSearchResults');
  clear('logSessionPastRoutine');
  const err = document.getElementById('manualExError');
  if(err) err.style.display = 'none';
  if(document.getElementById('manualExFields')) renderManualFields();
  if(document.getElementById('manualExPending')){ renderManualExPending(); renderManualExStatsNote(); }
}

// ---- mode buttons + sub-panel visibility (called by renderTodaysSession) ----
function renderLogSessionOptions(hasSchedule, dStr, isToday){
  const el = document.getElementById('logSessionOptions');
  if(!el) return;
  dStr = dStr || activeSessionDate();
  isToday = isToday !== undefined ? isToday : dStr === dateStrForOffset(0);

  el.innerHTML = LOG_SESSION_MODES.map(m => `
    <button type="button" class="lsp-opt lsp-${m.value} ${logSessionMode === m.value ? 'active' : ''}" data-lsp-mode="${m.value}" aria-pressed="${logSessionMode === m.value}">
      <span class="lsp-opt-icon">${m.icon}</span>
      <span class="lsp-opt-text"><strong>${m.label}</strong>${m.note ? `<small>${m.note}</small>` : ''}</span>
      <span class="lsp-opt-check" aria-hidden="true">✓</span>
    </button>`).join('');
  el.querySelectorAll('[data-lsp-mode]').forEach(btn => {
    btn.addEventListener('click', async ()=>{
      logSessionMode = btn.dataset.lspMode;
      if(logSessionMode !== 'plan') logSessionSelectedPlanId = null;
      // Switching back to the routine while today has a Rest deviation on
      // record means "no, use the routine after all" -- clear it rather than
      // leaving a routine that still resolves to Rest.
      if(isToday && logSessionMode === 'plan' && hasSchedule && userTrainingPlan && userTrainingPlan.overrides){
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

  const show = (id, on) => { const node = document.getElementById(id); if(node) node.style.display = on ? 'block' : 'none'; };
  show('logSessionPlanPicker', logSessionMode === 'plan');
  show('logSessionRestPanel', logSessionMode === 'rest');
  show('logSessionManualPanel', logSessionMode === 'manual');
  show('logSessionAiPanel', logSessionMode === 'ai');

  if(logSessionMode === 'plan'){
    const scheduled = hasSchedule && isToday ? scheduledPlanFor(new Date(dStr + 'T00:00:00').getDay(), dStr) : null;
    document.getElementById('logSessionPlanLabel').textContent = isToday
      ? (scheduled ? 'Use a different routine today (optional)' : 'Choose a routine for today')
      : `Choose the routine you did on ${formatDateLabel(dStr)}`;
    const sel = document.getElementById('logSessionPlanSelect');
    sel.innerHTML = `<option value="">${scheduled ? foodSearchEscape("Today's scheduled: " + scheduled.name) : 'Choose a routine…'}</option>`
      + allWorkoutPlans().map(p => `<option value="${p.id}" ${logSessionSelectedPlanId === p.id ? 'selected' : ''}>${foodSearchEscape(p.name)}</option>`).join('');
    if(!sel._wired){
      sel._wired = true;
      sel.addEventListener('change', ()=>{
        logSessionSelectedPlanId = sel.value || null;
        renderTodaysSession();
      });
    }
  }
  renderPastRoutineLogger(dStr, isToday);
  refreshSessionSaveButtons();
}

// ---- Select Workout Routine on a past/future date ----
// The tick-through checklist under the panel is today-only (it shares one
// checkedState), so for any other date the routine is logged from here:
// pick it, untick what was skipped, save.
function pastRoutineItems(plan){
  if(plan.kind === 'legacy' && dayData[plan.legacyKey]){
    return dayData[plan.legacyKey].exercises.map(ex => ({name: ex.name, category: 'strength'}));
  }
  if(plan.kind !== 'legacy'){
    return (plan.items || []).map(item => {
      const name = item.name || (window.workoutActivityName ? window.workoutActivityName(item.activityId) : item.activityId);
      const activity = (window.getWorkoutCatalog ? window.getWorkoutCatalog() : []).find(a => a.id === item.activityId);
      return {name, activityId: item.activityId, category: activity ? (manualCategoryForCatalog(activity.category) ? MANUAL_CATEGORIES[manualCategoryForCatalog(activity.category)].logCat : 'other') : 'other'};
    });
  }
  return [];
}
function renderPastRoutineLogger(dStr, isToday){
  const wrap = document.getElementById('logSessionPastRoutine');
  if(!wrap) return;
  const plan = (!isToday && logSessionMode === 'plan' && logSessionSelectedPlanId) ? getWorkoutPlan(logSessionSelectedPlanId) : null;
  if(!plan){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  const isCardioKind = plan.kind === 'legacy' && cardioData[plan.legacyKey];
  const items = pastRoutineItems(plan);
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="note" style="margin-bottom:6px;">${isCardioKind ? 'Cardio routine — pick what you did.' : 'Untick anything you skipped.'}</div>
    ${isCardioKind ? `
      <select id="pastRoutineActivity" aria-label="Cardio activity" style="width:100%;${LSP_INPUT_STYLE}">
        ${cardioActivityChoices().map(a => `<option value="${foodSearchEscape(a.id)}" ${a.id === cardioActivityPref() ? 'selected' : ''}>${foodSearchEscape(a.name)}</option>`).join('')}
      </select>` : items.map((it, i) => `
      <label style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;cursor:pointer;">
        <input type="checkbox" data-past-item="${i}" checked> <span>${activityEmoji(it.name, it.category)} ${foodSearchEscape(it.name)}</span>
      </label>`).join('') || '<div class="dash-empty">This routine has no exercises.</div>'}
    <label style="font-size:11px;color:var(--ink-soft);display:block;margin-top:8px;">Notes (optional)</label>
    <textarea id="pastRoutineNotes" rows="2" style="width:100%;${LSP_INPUT_STYLE}margin-top:2px;resize:vertical;"></textarea>
    <button class="timer-btn start" id="pastRoutineSaveBtn" type="button" style="width:100%;margin-top:8px;">Log ${foodSearchEscape(plan.name)} for ${foodSearchEscape(formatDateLabel(dStr))}</button>`;
  document.getElementById('pastRoutineSaveBtn').addEventListener('click', ()=>{
    const dayId = plan.kind === 'legacy' ? plan.legacyKey : 'plan:' + plan.id;
    let snapshot;
    if(isCardioKind){
      const activityId = document.getElementById('pastRoutineActivity').value;
      const choice = cardioActivityChoices().find(a => a.id === activityId);
      snapshot = [{name: choice ? choice.name : activityId, activityId, category: 'cardio', fromCardio: true}];
    } else {
      snapshot = items.filter((it, i) => wrap.querySelector(`[data-past-item="${i}"]`).checked)
        .map(it => ({name: it.name, activityId: it.activityId, category: it.category, weight: ''}));
    }
    checkedState[dStr + '_' + dayId + '_done'] = true;
    saveChecked();
    upsertSessionLog(dStr, dayId, snapshot, document.getElementById('pastRoutineNotes').value.trim(), undefined, plan.name);
    finishLogSessionSave();
  });
}

// ---- Manual exercise form ----
function renderManualFields(){
  const cat = MANUAL_CATEGORIES[document.getElementById('manualExCategory').value] || MANUAL_CATEGORIES.strength;
  const wrap = document.getElementById('manualExFields');
  const keep = {};
  wrap.querySelectorAll('input[data-manual-field]').forEach(inp => { keep[inp.dataset.manualField] = inp.value; });
  wrap.innerHTML = cat.fields.map(([key, label]) => `
    <div><label style="font-size:11px;color:var(--ink-soft);">${label}</label>
    <input type="text" inputmode="decimal" data-num data-manual-field="${key}" min="0" value="${foodSearchEscape(keep[key] || '')}" style="width:100%;${LSP_INPUT_STYLE}"></div>`).join('');
}
// (Called by the stats form when it attaches stats to a pending session.)
function renderManualExStatsNote(){
  refreshSessionSaveButtons();
}
function refreshSessionSaveButtons(){
  const manualBtn = document.getElementById('manualExSaveBtn');
  if(manualBtn) manualBtn.style.display = (manualExPending.length || manualExPendingStats) ? 'block' : 'none';
}

// ---- AI Assist: describe -> generate prompt -> paste reply -> review -> save ----
const AI_REVIEW_FIELDS = [
  ['duration', 'Duration (h:mm:ss or mm:ss)', false, null, null],
  ['distance', 'Distance (km)', true, 0, 1000],
  ['calories', 'Calories (kcal)', true, 0, 20000],
  ['hr', 'Avg HR (bpm)', true, 20, 260],
  ['maxHr', 'Max HR (bpm)', true, 20, 260],
  ['steps', 'Steps', true, 0, 200000],
  ['pace', 'Avg pace (per km)', false, null, null],
  ['elevation', 'Elevation gain (m)', true, 0, 20000]
];
function buildSessionAiPrompt(desc, exerciseSummary){
  // Same stats prompt the watch-stats form uses, plus a short workout name.
  return buildStatsAiPrompt(desc, exerciseSummary).replace(
    'Distance: <km, e.g. 5.2>', 'Workout: <short name, e.g. Evening jog>\nDistance: <km, e.g. 5.2>');
}
function resetAiSessionFlow(){
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
  ['aiSessDesc', 'aiSessPromptOut', 'aiSessReplyIn', 'aiRevName'].forEach(id => set(id, ''));
  const show = (id, on) => { const el = document.getElementById(id); if(el) el.style.display = on ? 'block' : 'none'; };
  show('aiSessPromptWrap', false); show('aiSessReview', false); show('aiSessParseError', false); show('aiSessSaveError', false);
  const copied = document.getElementById('aiSessCopied'); if(copied) copied.textContent = '';
  const fields = document.getElementById('aiRevFields'); if(fields) fields.innerHTML = '';
}
function generateAiSessionPrompt(){
  const desc = document.getElementById('aiSessDesc').value.trim();
  const pending = manualExPending.map(ex => exerciseSummaryText(ex)).join(', ');
  const out = document.getElementById('aiSessPromptOut');
  out.value = buildSessionAiPrompt(desc, pending);
  document.getElementById('aiSessPromptWrap').style.display = 'block';
  document.getElementById('aiSessReview').style.display = 'none';
  // Copy straight away -- this click is the gesture the browser needs -- and say so.
  copyTextToClipboard(out.value, document.getElementById('aiSessCopyBtn'));
  document.getElementById('aiSessCopied').textContent = '📋 Prompt copied — paste it into your AI chat, then paste its reply below.';
  document.getElementById('aiSessReplyIn').focus();
}
function parseAiSessionReply(){
  const errEl = document.getElementById('aiSessParseError');
  errEl.style.display = 'none';
  const reply = document.getElementById('aiSessReplyIn').value;
  const fail = message => { errEl.textContent = message; errEl.style.display = 'block'; };
  if(!reply.trim()) return fail("Paste your AI's reply first.");
  if(looksLikePastedPrompt(reply, document.getElementById('aiSessPromptOut').value)) return fail(PASTED_PROMPT_MESSAGE);
  const statLabels = ['Distance', 'Duration', 'Calories', 'Avg HR', 'Avg Pace', 'Steps', 'Max HR', 'Elevation gain'];
  const fields = parseLabeledReply(reply, ['Workout', ...statLabels]);
  if(!statLabels.some(k => fields[k])){
    return fail("Couldn't find any recognizable stats in that reply — make sure the AI replied using the format from the generated prompt, then try again.");
  }
  const num = v => { const n = firstNumber(v); return Number.isNaN(n) ? '' : String(n); };
  const desc = document.getElementById('aiSessDesc').value.trim();
  const values = {
    duration: (fields.Duration || '').replace(/[^0-9:]/g, ''), distance: num(fields.Distance), calories: num(fields.Calories),
    hr: num(fields['Avg HR']), maxHr: num(fields['Max HR']), steps: num(fields.Steps),
    pace: fields['Avg Pace'] || '', elevation: num(fields['Elevation gain'])
  };
  document.getElementById('aiRevName').value = (fields.Workout || desc.split(/[.\n]/)[0] || '').trim().slice(0, 60);
  document.getElementById('aiRevFields').innerHTML = AI_REVIEW_FIELDS.map(([key, label, numeric, min, max]) => `
    <div><label class="lsp-label">${label}</label>
    <input type="text" ${numeric ? `inputmode="decimal" data-num min="${min}" max="${max}"` : ''} data-ai-field="${key}" value="${foodSearchEscape(values[key])}" style="width:100%;${LSP_INPUT_STYLE}"></div>`).join('');
  document.getElementById('aiSessSaveError').style.display = 'none';
  const review = document.getElementById('aiSessReview');
  review.style.display = 'block';
  review.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
function saveAiSession(){
  const errEl = document.getElementById('aiSessSaveError');
  errEl.style.display = 'none';
  const wrap = document.getElementById('aiRevFields');
  const fail = message => { errEl.textContent = message; errEl.style.display = 'block'; };
  if(!validateNumFields(wrap)){
    const bad = wrap.querySelector('input:invalid');
    return fail((bad && bad.validationMessage) || 'Check the numbers you entered.');
  }
  const stats = {trainingStress: '', recoveryHr: '', hrZones: {}};
  wrap.querySelectorAll('[data-ai-field]').forEach(inp => { stats[inp.dataset.aiField] = inp.value.trim(); });
  if(stats.duration && !/^\d{1,2}(:\d{2}){1,2}$/.test(stats.duration)) return fail('Duration should look like 45:00 or 1:05:30 (or be left blank).');
  manualExPendingStats = stats;
  saveManualSession(document.getElementById('aiRevName').value);
}
function renderManualExPending(){
  const el = document.getElementById('manualExPending');
  if(!el) return;
  el.innerHTML = manualExPending.map((ex, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">
      <div style="font-size:12.5px;flex:1;">${activityEmoji(ex.name, ex.category)} ${foodSearchEscape(exerciseSummaryText(ex))}</div>
      <button type="button" data-remove-manual-ex="${i}" aria-label="Remove" style="background:none;border:none;color:inherit;cursor:pointer;font-size:14px;">✕</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-remove-manual-ex]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      manualExPending.splice(parseInt(btn.dataset.removeManualEx, 10), 1);
      renderManualExPending();
      renderManualExStatsNote();
    });
  });
  refreshSessionSaveButtons();
}
function runManualSearch(force){
  const resultsEl = document.getElementById('manualExSearchResults');
  const query = document.getElementById('manualExName').value;
  const matches = librarySearchMatches(query, document.getElementById('manualExCategory').value, force);
  if(!matches.length){
    resultsEl.innerHTML = (query.trim() || force)
      ? '<div class="note" style="margin:0;">Not in the library — it will be saved just as typed.</div>' : '';
    return;
  }
  resultsEl.innerHTML = matches.map(a => `<button type="button" class="timer-btn" data-pick-activity="${foodSearchEscape(a.id)}" style="display:block;width:100%;text-align:left;margin-top:3px;padding:6px 8px;font-size:12px;">${activityEmoji(a.name, a.category)} ${foodSearchEscape(a.name)}</button>`).join('');
  resultsEl.querySelectorAll('[data-pick-activity]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const activity = matches.find(a => a.id === btn.dataset.pickActivity);
      manualExChosenActivityId = activity.id;
      document.getElementById('manualExName').value = activity.name;
      const catKey = manualCategoryForCatalog(activity.category);
      if(catKey){ document.getElementById('manualExCategory').value = catKey; renderManualFields(); }
      resultsEl.innerHTML = '';
    });
  });
}
function addManualExercise(){
  const errEl = document.getElementById('manualExError');
  errEl.style.display = 'none';
  const name = document.getElementById('manualExName').value.trim();
  if(!name){
    errEl.textContent = 'Enter an activity name, or pick one from the library.';
    errEl.style.display = 'block';
    return;
  }
  const catKey = document.getElementById('manualExCategory').value;
  const cat = MANUAL_CATEGORIES[catKey];
  const wrap = document.getElementById('manualExFields');
  if(!validateNumFields(wrap)){
    const bad = wrap.querySelector('input:invalid');
    errEl.textContent = (bad && bad.validationMessage) || 'Check the numbers you entered.';
    errEl.style.display = 'block';
    return;
  }
  const exercise = {name, activityId: manualExChosenActivityId, category: cat.logCat};
  wrap.querySelectorAll('input[data-manual-field]').forEach(inp => {
    if(inp.value.trim() !== '') exercise[inp.dataset.manualField] = inp.value.trim();
  });
  manualExPending.push(exercise);
  document.getElementById('manualExName').value = '';
  document.getElementById('manualExSearchResults').innerHTML = '';
  manualExChosenActivityId = null;
  renderManualFields();
  wrap.querySelectorAll('input').forEach(inp => { inp.value = ''; });
  renderManualExPending();
  renderManualExStatsNote();
}

// Saves the pending manual exercises and/or AI-assist stats as one session.
function saveManualSession(sessionName){
  if(!manualExPending.length && !manualExPendingStats) return;
  const dStr = activeSessionDate();
  const name = (sessionName || '').trim();
  const snapshot = manualExPending.map(ex => ({...ex}));
  if(!snapshot.length && name){
    const stats = manualExPendingStats || {};
    const item = {name, category: stats.distance ? 'cardio' : 'other'};
    const minutes = durationToMinutes(stats.duration);
    if(minutes) item.duration = String(minutes);
    if(stats.distance) item.distance = String(stats.distance);
    snapshot.push(item);
  }
  upsertSessionLog(dStr, 'manual-' + Date.now().toString(36), snapshot, undefined, manualExPendingStats || undefined, name || 'Manual entry');
  finishLogSessionSave();
}

function wireLogSessionPanel(){
  renderManualFields();
  document.getElementById('manualExCategory').addEventListener('change', ()=>{
    manualExChosenActivityId = null;
    renderManualFields();
    if(document.getElementById('manualExName').value.trim()) runManualSearch(false);
  });
  let searchTimer = null;
  document.getElementById('manualExName').addEventListener('input', ()=>{
    manualExChosenActivityId = null;
    clearTimeout(searchTimer);
    // Debounced so typing never blocks on the library lookup; the search
    // button runs it immediately.
    searchTimer = setTimeout(()=> runManualSearch(false), 250);
  });
  document.getElementById('manualExName').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); clearTimeout(searchTimer); runManualSearch(true); }
  });
  document.getElementById('manualExSearchBtn').addEventListener('click', ()=>{ clearTimeout(searchTimer); runManualSearch(true); });
  document.getElementById('manualExAddBtn').addEventListener('click', addManualExercise);
  document.getElementById('manualExSaveBtn').addEventListener('click', ()=> saveManualSession(''));
  document.getElementById('aiSessGenerateBtn').addEventListener('click', generateAiSessionPrompt);
  document.getElementById('aiSessCopyBtn').addEventListener('click', e => {
    copyTextToClipboard(document.getElementById('aiSessPromptOut').value, e.currentTarget);
    document.getElementById('aiSessCopied').textContent = '📋 Prompt copied.';
  });
  document.getElementById('aiSessParseBtn').addEventListener('click', parseAiSessionReply);
  document.getElementById('aiSessSaveBtn').addEventListener('click', saveAiSession);

  document.getElementById('logSessionRestSaveBtn').addEventListener('click', async ()=>{
    const note = document.getElementById('logSessionRestNotes').value.trim();
    const dStr = activeSessionDate();
    const hasSchedule = !!(userTrainingPlan && userTrainingPlan.presetKey && userTrainingPlan.presetKey !== 'open');
    if(hasSchedule){
      userTrainingPlan.overrides = userTrainingPlan.overrides || {};
      userTrainingPlan.overrides[dStr] = {type: 'rest'};
      await saveTrainingPlan();
    }
    // Also log it as the day's entry (regardless of mode) so it shows up in
    // Logged Training with its note -- excluded from session/streak counts
    // and the workout-day nutrition target by isRealSessionEntry().
    upsertSessionLog(dStr, 'rest', [], note, undefined, 'Rest');
    finishLogSessionSave();
  });
}

mountLogSessionPanel(document.getElementById('logSessionSection'));
