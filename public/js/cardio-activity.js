// ---------- Cardio sessions: optionally list the activity (Walking, Running, ...) ----------
// A Cardio Steady/Intervals log used to record only watch stats, so the
// Logged Training list read "(no exercises listed)". This lets the user tick
// "List the activity in my log" and pick what they actually did; the chosen
// activity is written into the session's exercise list with the duration and
// distance from the watch stats. The choice is remembered on this device.

const CARDIO_ACTIVITY_FALLBACK = [
  {id: 'walking', name: 'Walking'}, {id: 'running', name: 'Running'}, {id: 'cycling', name: 'Cycling'},
  {id: 'rowing', name: 'Rowing'}, {id: 'swimming', name: 'Swimming'}, {id: 'elliptical', name: 'Elliptical'},
  {id: 'jump-rope', name: 'Jump rope'}
];
function cardioActivityChoices(){
  const catalog = window.getWorkoutCatalog ? window.getWorkoutCatalog() : [];
  const fromCatalog = catalog.filter(a => a.category === 'cardio' && (!a.phase || a.phase === 'main')).map(a => ({id: a.id, name: a.name}));
  return fromCatalog.length ? fromCatalog : CARDIO_ACTIVITY_FALLBACK;
}
function cardioListPref(){
  try{ return localStorage.getItem('fc_cardio_list') !== '0'; }catch(e){ return true; }
}
function cardioActivityPref(){
  try{ return localStorage.getItem('fc_cardio_activity') || 'walking'; }catch(e){ return 'walking'; }
}
function saveCardioPrefs(list, activityId){
  try{
    localStorage.setItem('fc_cardio_list', list ? '1' : '0');
    localStorage.setItem('fc_cardio_activity', activityId);
  }catch(e){}
}
// "h:mm:ss" or "m:ss" -> whole minutes (0 when blank/unparseable).
function durationToMinutes(durationStr){
  const parts = String(durationStr || '').split(':').map(p => parseInt(p, 10));
  if(!parts.length || parts.some(n => isNaN(n))) return 0;
  let h = 0, m = 0, s = 0;
  if(parts.length === 3){ [h, m, s] = parts; } else if(parts.length === 2){ [m, s] = parts; } else { return 0; }
  return Math.round(h * 60 + m + s / 60);
}

// Returns the exercise list a cardio session should carry: the auto-listed
// activity first (created or refreshed from the stats), then any exercises the
// user added by hand. With the option off, the auto-listed item is removed.
function syncCardioExercise(exercises, stats){
  const existing = Array.isArray(exercises) ? exercises : [];
  const manual = existing.filter(ex => !ex.fromCardio);
  if(!cardioListPref()) return manual;
  const id = cardioActivityPref();
  const choice = cardioActivityChoices().find(a => a.id === id) || CARDIO_ACTIVITY_FALLBACK.find(a => a.id === id);
  const item = existing.find(ex => ex.fromCardio) || {category: 'cardio', fromCardio: true};
  item.activityId = id;
  item.name = choice ? choice.name : id;
  const minutes = durationToMinutes(stats && stats.duration);
  if(minutes) item.duration = String(minutes);
  if(stats && stats.distance) item.distance = String(stats.distance);
  return [item, ...manual];
}

function cardioActivityControlsHtml(){
  const selected = cardioActivityPref();
  const options = cardioActivityChoices().map(a =>
    `<option value="${foodSearchEscape(a.id)}" ${a.id === selected ? 'selected' : ''}>${foodSearchEscape(a.name)}</option>`).join('');
  return `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">
      <label style="font-size:12.5px;display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input type="checkbox" id="cardioListActivity" ${cardioListPref() ? 'checked' : ''}> List the activity in my log
      </label>
      <select id="cardioActivitySelect" aria-label="Cardio activity" style="padding:5px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;">${options}</select>
    </div>`;
}

// Wires the checkbox + activity picker on the cardio card. Changing either
// updates today's already-logged session for this cardio kind, if there is one.
function wireCardioActivityControls(kind){
  const checkbox = document.getElementById('cardioListActivity');
  const select = document.getElementById('cardioActivitySelect');
  if(!checkbox || !select) return;
  select.disabled = !checkbox.checked;
  const apply = ()=>{
    saveCardioPrefs(checkbox.checked, select.value);
    select.disabled = !checkbox.checked;
    const entry = historyLog.find(e => e.date === dateStrForOffset(0) && e.day === kind);
    if(!entry) return;
    entry.exercises = syncCardioExercise(entry.exercises, entry.stats);
    saveHistory();
    renderLoggedToday();
    renderHistory();
  };
  checkbox.addEventListener('change', apply);
  select.addEventListener('change', apply);
}
