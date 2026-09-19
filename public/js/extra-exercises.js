// ---------- Extra exercises added to a Workout Routine for today only ----------
// Keyed by today's date + which block ('strength' or 'custom') so switching
// plans/days never mixes them up; nothing is saved to history until "Routine
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
      <input type="text" inputmode="decimal" data-num data-extra-sets="${scope}" placeholder="Sets" min="0" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
      <input type="text" inputmode="decimal" data-num data-extra-reps="${scope}" placeholder="Reps" min="0" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
      <input type="text" inputmode="decimal" data-num data-extra-weight="${scope}" placeholder="Weight (kg)" min="0" step="0.5" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
      <input type="text" inputmode="decimal" data-num data-extra-duration="${scope}" placeholder="Duration (min)" min="0" style="width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
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
