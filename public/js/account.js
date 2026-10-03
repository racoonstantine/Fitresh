// ---------- Structured import: weigh-ins, sleep, fasting, water, itemized food days, workouts ----------
// See data-import-schema.md for the JSON shape this expects.
async function importStructuredData(data, statusEl){
  const setStatus = (msg)=>{ if(statusEl){ statusEl.textContent = msg; statusEl.style.display = 'block'; } };

  if(Array.isArray(data.weighIns)){
    data.weighIns.forEach(w=>{
      if(!w || !w.date || w.kg === undefined || w.kg === null) return;
      weighIns = weighIns.filter(e => e.date !== w.date);
      weighIns.push({date: w.date, kg: parseNum(w.kg)});
    });
    weighIns.sort((a,b)=> a.date < b.date ? -1 : 1);
    await saveWeighIns();
  }

  if(Array.isArray(data.sleep)){
    data.sleep.forEach(s=>{
      if(!s || !s.date) return;
      let hours = s.hours, startIso = null, endIso = null;
      if(s.bedtime && s.waketime){
        const bd = new Date(s.bedtime), wd = new Date(s.waketime);
        if(!isNaN(bd.getTime()) && !isNaN(wd.getTime())){
          startIso = bd.toISOString();
          endIso = wd.toISOString();
          if(hours === undefined || hours === null) hours = (wd - bd) / 3600000;
        }
      }
      if(hours !== undefined && hours !== null){
        sleepLog[s.date] = {startIso, endIso, hours: parseNum(hours)};
      }
    });
    await saveSleepLog();
  }

  if(Array.isArray(data.fasting)){
    data.fasting.forEach(f=>{
      if(f && f.date && f.hours !== undefined && f.hours !== null){
        upsertNutritionFields(f.date, {fastHours: String(f.hours)});
      }
    });
  }

  if(Array.isArray(data.water)){
    data.water.forEach(w=>{
      if(w && w.date && w.ml !== undefined && w.ml !== null){
        waterLog[w.date] = Math.round(parseNum(w.ml));
      }
    });
    await saveWater();
  }

  if(Array.isArray(data.workouts)){
    data.workouts.forEach(w=>{
      if(!w || !w.date || !w.type) return;
      const exercises = Array.isArray(w.exercises) ? w.exercises : [];
      upsertSessionLog(w.date, w.type, exercises, w.notes || '', w.stats || null);
      checkedState[w.date + '_' + w.type + '_done'] = true;
    });
    await saveChecked();
  }

  if(Array.isArray(data.nutritionDays)){
    const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'custom'];
    for(let dayIdx = 0; dayIdx < data.nutritionDays.length; dayIdx++){
      const day = data.nutritionDays[dayIdx];
      if(!day || !day.date || !Array.isArray(day.meals)) continue;
      for(let mealIdx = 0; mealIdx < day.meals.length; mealIdx++){
        const meal = day.meals[mealIdx];
        const mealType = MEAL_TYPES.includes(meal.mealType) ? meal.mealType : 'custom';
        const items = Array.isArray(meal.items) ? meal.items : [];
        for(let itemIdx = 0; itemIdx < items.length; itemIdx++){
          const item = items[itemIdx];
          if(!item || !item.name) continue;
          setStatus(`Importing food — day ${dayIdx + 1}/${data.nutritionDays.length} (${day.date}), item ${itemIdx + 1}/${items.length}: ${item.name}`);
          const amount = parseNum(item.amount) || 100;
          const unit = item.unit || 'g';
          try{
            const createRes = await fetch('api/foods.php?action=create_custom', {
              method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                name: item.name, canonical_amount: amount, canonical_unit: unit,
                nutrients: {
                  ENERC_KCAL: parseNum(item.calories) || 0,
                  PROCNT: parseNum(item.protein) || 0,
                  FAT: parseNum(item.fat) || 0,
                  CHOCDF: parseNum(item.carbs) || 0,
                  FIBTG: (item.fiber !== undefined && item.fiber !== null) ? parseNum(item.fiber) : null,
                  SUGAR: (item.sugar !== undefined && item.sugar !== null) ? parseNum(item.sugar) : null,
                  NA: (item.sodiumMg !== undefined && item.sodiumMg !== null) ? parseNum(item.sodiumMg) : null,
                  CHOLE: (item.cholesterolMg !== undefined && item.cholesterolMg !== null) ? parseNum(item.cholesterolMg) : null
                }
              })
            });
            const food = await createRes.json();
            if(food && food.id){
              await fetch('api/meals.php?action=log', {
                method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({date: day.date, meal_type: mealType, component: {food_id: food.id, amount, unit}})
              });
            }
          }catch(e){ /* one bad item shouldn't stop the whole import -- keep going */ }
        }
      }
      if(day.notes){
        upsertNutritionFields(day.date, {notes: day.notes});
      }
    }
  }

  setStatus('Import complete ✓ — reloading...');
  setTimeout(()=> location.reload(), 1200);
}

/* ---------- Auth: gate the app behind login/signup ---------- */
let currentUser = null;

function showLoginScreen(message){
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
  const err = document.getElementById('authError');
  if(message){
    err.textContent = message;
    err.style.display = 'block';
  } else {
    err.style.display = 'none';
  }
  document.getElementById('forgotPasswordForm').style.display = 'none';
  document.getElementById('authForm').style.display = 'block';
}

function revealApp(){
  document.getElementById('onboardingScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
}

// Shows/hides the cm vs ft/in height inputs and updates the weight field
// labels to match whatever unit is currently selected in the onboarding
// form -- called on open and whenever either unit select changes.
function applyObUnitDisplay(){
  const wUnit = document.getElementById('obWeightUnit').value;
  const hUnit = document.getElementById('obHeightUnit').value;
  document.getElementById('obCurrentWeightLabel').textContent = `Current weight (${wUnit === 'lbs' ? 'lb' : 'kg'})`;
  document.getElementById('obGoalWeightLabel').textContent = `Goal weight (${wUnit === 'lbs' ? 'lb' : 'kg'})`;
  const isFt = hUnit === 'ft';
  document.getElementById('obHeightLabel').textContent = isFt ? 'Height (ft/in)' : 'Height (cm)';
  document.getElementById('obHeight').style.display = isFt ? 'none' : 'block';
  document.getElementById('obHeightFtWrap').style.display = isFt ? 'flex' : 'none';
}
let obWeightUnitPrev = 'kg';
let obHeightUnitPrev = 'cm';
function showOnboarding(){
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('onboardingScreen').style.display = 'flex';
  const p = userProfile || {};
  document.getElementById('obUsername').value = (currentUser && currentUser.username) || '';
  document.getElementById('obGender').value = p.gender || '';
  document.getElementById('obAge').value = p.age || '';
  document.getElementById('obActivity').value = p.activityLevel || 'light';
  document.getElementById('obDietPreset').value = p.dietPreset || 'open';

  obWeightUnitPrev = p.weightUnit || 'kg';
  obHeightUnitPrev = p.heightUnit || 'cm';
  document.getElementById('obWeightUnit').value = obWeightUnitPrev;
  document.getElementById('obHeightUnit').value = obHeightUnitPrev;

  const heightCm = p.heightCm || null;
  if(obHeightUnitPrev === 'ft' && heightCm){
    const {feet, inches} = cmToFeetInches(heightCm);
    document.getElementById('obHeightFt').value = feet;
    document.getElementById('obHeightIn').value = inches;
    document.getElementById('obHeight').value = '';
  } else {
    document.getElementById('obHeight').value = heightCm || '';
    document.getElementById('obHeightFt').value = '';
    document.getElementById('obHeightIn').value = '';
  }

  const curKg = p.currentWeightKg || currentWeightKg() || null;
  const goalKg = p.goalWeightKg || GOAL_WEIGHT || null;
  document.getElementById('obCurrentWeight').value = curKg
    ? (obWeightUnitPrev === 'lbs' ? (Math.round(kgToLbs(curKg) * 10) / 10) : curKg) : '';
  document.getElementById('obGoalWeight').value = goalKg
    ? (obWeightUnitPrev === 'lbs' ? (Math.round(kgToLbs(goalKg) * 10) / 10) : goalKg) : '';

  document.getElementById('obNotes').value = p.notes || '';
  document.getElementById('onboardingError').style.display = 'none';
  applyObUnitDisplay();
}

function setUserBadge(name){
  document.getElementById('userBadge').textContent = name;
  const initial = String(name || '').trim().charAt(0).toUpperCase();
  document.getElementById('userAvatar').textContent = initial || '•';
}

async function showAppFor(user){
  currentUser = user;
  document.getElementById('loginScreen').style.display = 'none';
  setUserBadge(user.display_name || user.email);
  // Client-side visibility only -- api/admin.php re-checks this server-side
  // on every request, so hiding/showing this tab is purely cosmetic.
  const adminBtn = document.getElementById('adminSubnavBtn');
  if(adminBtn) adminBtn.style.display = (user.email || '').toLowerCase() === 'sherwinllona@gmail.com' ? '' : 'none';
  await startApp();
  if(!userProfile){
    showOnboarding();
  } else {
    revealApp();
  }
}

async function checkAuthAndStart(){
  try{
    const res = await fetch('api/auth.php?action=me', { credentials: 'same-origin' });
    if(res.ok){
      const user = await res.json();
      await showAppFor(user);
      return;
    }
  }catch(e){}
  showLoginScreen();
}

(function(){
  let mode = 'login';
  const tabs = document.getElementById('authTabs');
  const nameRow = document.getElementById('authNameRow');
  const submitBtn = document.getElementById('authSubmit');
  const form = document.getElementById('authForm');
  const errBox = document.getElementById('authError');

  tabs.addEventListener('click', (e)=>{
    const btn = e.target.closest('.main-tab');
    if(!btn) return;
    mode = btn.dataset.auth;
    document.querySelectorAll('#authTabs .main-tab').forEach(t => t.classList.toggle('active', t === btn));
    nameRow.style.display = mode === 'register' ? 'block' : 'none';
    submitBtn.textContent = mode === 'register' ? 'Sign Up' : 'Log In';
    document.getElementById('authPassword').setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
    errBox.style.display = 'none';
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    errBox.style.display = 'none';
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const displayName = document.getElementById('authName').value.trim();
    submitBtn.disabled = true;
    const prevLabel = submitBtn.textContent;
    submitBtn.textContent = mode === 'register' ? 'Signing up…' : 'Logging in…';
    try{
      const res = await fetch(`api/auth.php?action=${mode}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password, display_name: displayName })
      });
      const data = await res.json();
      if(!res.ok){
        errBox.style.color = '#B4472A';
        errBox.textContent = data.error || 'Something went wrong — try again.';
        errBox.style.display = 'block';
        return;
      }
      if(data.pending){
        errBox.style.color = 'var(--forest-dark)';
        errBox.textContent = data.message || 'Your account needs admin approval before you can log in.';
        errBox.style.display = 'block';
        form.reset();
        return;
      }
      await showAppFor(data);
    }catch(err){
      errBox.style.color = '#B4472A';
      errBox.textContent = 'Could not reach the server — check your connection and try again.';
      errBox.style.display = 'block';
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = prevLabel;
    }
  });

  document.getElementById('logoutLink').addEventListener('click', async (e)=>{
    e.preventDefault();
    try{ await fetch('api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' }); }catch(err){}
    currentUser = null;
    location.reload();
  });

  const forgotForm = document.getElementById('forgotPasswordForm');
  const forgotStatus = document.getElementById('forgotPasswordStatus');
  document.getElementById('forgotPasswordLink').addEventListener('click', ()=>{
    form.style.display = 'none';
    forgotForm.style.display = 'block';
    forgotStatus.style.display = 'none';
    document.getElementById('forgotPasswordEmail').value = document.getElementById('authEmail').value.trim();
  });
  document.getElementById('forgotPasswordCancel').addEventListener('click', ()=>{
    forgotForm.style.display = 'none';
    form.style.display = 'block';
  });
  document.getElementById('forgotPasswordSubmit').addEventListener('click', async ()=>{
    const email = document.getElementById('forgotPasswordEmail').value.trim();
    const btn = document.getElementById('forgotPasswordSubmit');
    forgotStatus.style.display = 'none';
    if(!email){
      forgotStatus.style.color = '#B4472A';
      forgotStatus.textContent = 'Enter your email.';
      forgotStatus.style.display = 'block';
      return;
    }
    btn.disabled = true;
    const prevLabel = btn.textContent;
    btn.textContent = 'Sending…';
    try{
      const res = await fetch('api/auth.php?action=request_password_reset', {
        method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email})
      });
      const data = await res.json();
      forgotStatus.style.color = res.ok ? 'var(--forest-dark)' : '#B4472A';
      forgotStatus.textContent = res.ok ? (data.message || 'Request sent.') : (data.error || 'Something went wrong — try again.');
      forgotStatus.style.display = 'block';
    }catch(err){
      forgotStatus.style.color = '#B4472A';
      forgotStatus.textContent = 'Could not reach the server — check your connection and try again.';
      forgotStatus.style.display = 'block';
    }finally{
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  });
})();

/* ---------- Onboarding: username + health profile ---------- */
(function(){
  const form = document.getElementById('onboardingForm');
  const errBox = document.getElementById('onboardingError');
  const submitBtn = document.getElementById('onboardingSubmit');

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    errBox.style.display = 'none';
    submitBtn.disabled = true;
    const prevLabel = submitBtn.textContent;
    submitBtn.textContent = 'Saving…';
    try{
      const username = document.getElementById('obUsername').value.trim();
      if(username && username !== (currentUser.username || '')){
        const res = await fetch('api/auth.php?action=set_username', {
          method: 'POST', credentials: 'same-origin',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ username })
        });
        const data = await res.json();
        if(!res.ok){
          errBox.textContent = data.error || 'Could not save that username.';
          errBox.style.display = 'block';
          return;
        }
        currentUser.username = data.username;
      }

      const wUnit = document.getElementById('obWeightUnit').value;
      const hUnit = document.getElementById('obHeightUnit').value;
      const heightCm = hUnit === 'ft'
        ? feetInchesToCm(document.getElementById('obHeightFt').value, document.getElementById('obHeightIn').value)
        : (parseNum(document.getElementById('obHeight').value) || null);
      const rawCurrent = parseNum(document.getElementById('obCurrentWeight').value);
      const rawGoal = parseNum(document.getElementById('obGoalWeight').value);
      const currentWeightKgVal = isNaN(rawCurrent) ? null : (wUnit === 'lbs' ? lbsToKg(rawCurrent) : rawCurrent);
      const goalWeightKgVal = isNaN(rawGoal) ? null : (wUnit === 'lbs' ? lbsToKg(rawGoal) : rawGoal);

      const profile = {
        ...(userProfile || {}),
        gender: document.getElementById('obGender').value || null,
        age: parseInt(document.getElementById('obAge').value, 10) || null,
        heightCm,
        weightUnit: wUnit,
        heightUnit: hUnit,
        activityLevel: document.getElementById('obActivity').value,
        dietPreset: document.getElementById('obDietPreset').value,
        currentWeightKg: currentWeightKgVal,
        goalWeightKg: goalWeightKgVal,
        notes: document.getElementById('obNotes').value.trim() || null
      };
      await saveProfile(profile);

      if(profile.currentWeightKg && !weighIns.length){
        addWeighIn(dateStrForOffset(0), profile.currentWeightKg);
      }

      revealApp();
      renderBodyPlaceholders();
      renderBodySleepCard();
      renderDashboard();
      renderNutrition();
      renderWeightSection();
      renderTodayGlance();
      renderAccountSnapshot();
    }catch(err){
      errBox.textContent = 'Could not reach the server — check your connection and try again.';
      errBox.style.display = 'block';
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = prevLabel;
    }
  });

  document.getElementById('onboardingSkip').addEventListener('click', ()=>{
    revealApp();
  });

  // Switching a unit mid-edit converts whatever is currently typed instead
  // of just relabeling the field, so a half-filled form doesn't silently
  // get reinterpreted in the new unit.
  document.getElementById('obWeightUnit').addEventListener('change', (e)=>{
    const newUnit = e.target.value;
    if(newUnit === obWeightUnitPrev){ return; }
    ['obCurrentWeight', 'obGoalWeight'].forEach(id=>{
      const input = document.getElementById(id);
      const val = parseNum(input.value);
      if(isNaN(val)) return;
      const kg = obWeightUnitPrev === 'lbs' ? lbsToKg(val) : val;
      input.value = Math.round((newUnit === 'lbs' ? kgToLbs(kg) : kg) * 10) / 10;
    });
    obWeightUnitPrev = newUnit;
    applyObUnitDisplay();
  });
  document.getElementById('obHeightUnit').addEventListener('change', (e)=>{
    const newUnit = e.target.value;
    if(newUnit === obHeightUnitPrev){ return; }
    let cm = null;
    if(obHeightUnitPrev === 'ft'){
      cm = feetInchesToCm(document.getElementById('obHeightFt').value, document.getElementById('obHeightIn').value);
    } else {
      const val = parseNum(document.getElementById('obHeight').value);
      cm = isNaN(val) ? null : val;
    }
    if(cm){
      if(newUnit === 'ft'){
        const {feet, inches} = cmToFeetInches(cm);
        document.getElementById('obHeightFt').value = feet;
        document.getElementById('obHeightIn').value = inches;
      } else {
        document.getElementById('obHeight').value = Math.round(cm);
      }
    }
    obHeightUnitPrev = newUnit;
    applyObUnitDisplay();
  });

  document.getElementById('userBadge').addEventListener('click', ()=> showView('account'));
  document.getElementById('userAvatar').addEventListener('click', ()=> showView('account'));
  document.getElementById('userBadge').style.cursor = 'pointer';
})();

/* ---------- Account tab: Goals overrides, Account settings, Feedback ---------- */
(function(){
  // ---- Goals: every target is read-only until its pencil is tapped; ✓ saves just that field, ✕ reverts it ----
  const G = id => document.getElementById(id);
  const numOrNull = id => parseNum(G(id).value) || null;
  function goalsToast(msg){
    const el = G('goalsSavedMsg');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(window.__goalsSavedTimeout);
    window.__goalsSavedTimeout = setTimeout(()=>{ el.style.display = 'none'; }, 2200);
  }
  function goalsRerender(){
    renderAccountGoals();
    renderBodyPlaceholders();
    renderBodySleepCard();
    renderNutrition();
    renderTodayGlance();
    renderFasting();
    renderWeightSection();
    renderAccountSnapshot();
    if(document.getElementById('summaryCards')) renderSummary();
  }
  const gateDefs = [
    {inputs:['goalDietPreset','goalProteinCustom','goalCarbsCustom','goalFatCustom'], editable:['goalDietPreset'],
      commit(p){ p.dietPreset = G('goalDietPreset').value; p.customProteinTarget = numOrNull('goalProteinCustom'); p.customCarbTarget = numOrNull('goalCarbsCustom'); p.customFatTarget = numOrNull('goalFatCustom'); },
      onCancel(){ renderDietPresetNote(G('goalDietPreset').value); }},
    {inputs:['goalEnergyCustom'], commit(p){ p.customCalorieTarget = numOrNull('goalEnergyCustom'); }},
    {inputs:['goalProteinCustom'], commit(p){ p.customProteinTarget = numOrNull('goalProteinCustom'); }},
    {inputs:['goalCarbsCustom'], commit(p){ p.customCarbTarget = numOrNull('goalCarbsCustom'); }},
    {inputs:['goalFatCustom'], commit(p){ p.customFatTarget = numOrNull('goalFatCustom'); }},
    {inputs:['goalSodiumCustom'], commit(p){ p.customSodiumTarget = numOrNull('goalSodiumCustom'); }},
    {inputs:['goalFiberCustom'], commit(p){ p.customFiberTarget = numOrNull('goalFiberCustom'); }},
    {inputs:['goalSugarCustom'], commit(p){ p.customSugarTarget = numOrNull('goalSugarCustom'); }},
    {inputs:['goalTargetWeight','goalWeightUnit'], editable:['goalTargetWeight','goalWeightUnit'],
      commit(p){
        const unit = G('goalWeightUnit').value;
        p.weightUnit = unit;
        const raw = parseNum(G('goalTargetWeight').value);
        p.goalWeightKg = isNaN(raw) ? null : (unit === 'lbs' ? lbsToKg(raw) : raw);
      },
      capture(){ return {unit: G('goalWeightUnit').value, prev: goalWeightUnitPrev, val: G('goalTargetWeight').value}; },
      restore(c){
        G('goalWeightUnit').value = c.unit; goalWeightUnitPrev = c.prev; G('goalTargetWeight').value = c.val;
        G('goalTargetWeightLabel').textContent = `Target weight (${c.unit === 'lbs' ? 'lb' : 'kg'})`;
      }},
    {inputs:['goalSleepHours'], commit(p){ p.sleepGoalHours = numOrNull('goalSleepHours'); }},
    {inputs:['goalSteps'], commit(p){ p.stepsGoal = parseInt(G('goalSteps').value, 10) || null; }},
    {inputs:['goalCalorieBurn'], commit(p){ p.calorieBurnGoal = numOrNull('goalCalorieBurn'); }},
    {inputs:['goalWater'], commit(p){ p.waterGoalMl = parseInt(G('goalWater').value, 10) || null; }},
    {inputs:['goalFastingHours'], skipProfile:true,
      async afterSave(){ fastingState.goalHours = numOrNull('goalFastingHours') || 16; await saveFasting(); }}
  ];

  // Puts the pencil / check / cross controls beside the field's label.
  function gateHost(def){
    const el = G(def.inputs[0]);
    const field = el.closest('.goal-field');
    if(field){
      let head = field.querySelector('.goal-field-head');
      if(!head){
        head = document.createElement('div');
        head.className = 'goal-field-head';
        const lab = field.querySelector('label');
        field.insertBefore(head, lab);
        head.appendChild(lab);
      }
      return {host: head, box: field};
    }
    // Diet style and Daily energy sit in cards with a label just above the control.
    const lab = el.previousElementSibling;
    const wrap = document.createElement('div');
    wrap.className = 'goal-head-wrap';
    lab.parentNode.insertBefore(wrap, lab);
    wrap.appendChild(lab);
    return {host: wrap, box: el.closest('.hub-card') || el.parentNode};
  }

  async function commitGate(def){
    const errEl = G('goalsError');
    errEl.style.display = 'none';
    const profile = {...(userProfile || {})};
    if(def.commit) def.commit(profile);
    if(!userProfile && (profile.customCalorieTarget || profile.customProteinTarget)){
      errEl.textContent = 'Set up your personal profile first (age, height, weight) — energy and protein targets are calculated from it.';
      errEl.style.display = 'block';
      return false;
    }
    if(!def.skipProfile) await saveProfile(profile);
    if(def.afterSave) await def.afterSave();
    goalsRerender();
    goalsToast('✓ Goal saved');
    return true;
  }

  gateDefs.forEach(def => {
    const {host, box} = gateHost(def);
    const editable = def.editable || def.inputs;
    const ctl = document.createElement('span');
    ctl.className = 'goal-ctl';
    ctl.innerHTML = '<button type="button" class="goal-ctl-edit" title="Edit" aria-label="Edit this target">✎</button>' +
      '<button type="button" class="goal-ctl-ok" title="Save" aria-label="Save" hidden>✓</button>' +
      '<button type="button" class="goal-ctl-cancel" title="Cancel" aria-label="Cancel" hidden>✕</button>';
    host.appendChild(ctl);
    const editBtn = ctl.querySelector('.goal-ctl-edit'), okBtn = ctl.querySelector('.goal-ctl-ok'), cancelBtn = ctl.querySelector('.goal-ctl-cancel');
    let snapshot = null;
    def.setEditing = (on)=>{
      editable.forEach(id => { const e = G(id); if(e.tagName === 'SELECT') e.disabled = !on; else e.readOnly = !on; });
      box.classList.toggle('goal-editing', on);
      editBtn.hidden = on; okBtn.hidden = !on; cancelBtn.hidden = !on;
    };
    def.setEditing(false);
    editBtn.addEventListener('click', ()=>{
      snapshot = def.capture ? def.capture() : def.inputs.map(id => G(id).value);
      def.setEditing(true);
      const first = G(editable[0]);
      first.focus();
      if(first.select) first.select();
    });
    cancelBtn.addEventListener('click', ()=>{
      if(def.restore) def.restore(snapshot); else def.inputs.forEach((id, i)=>{ G(id).value = snapshot[i]; });
      if(def.onCancel) def.onCancel();
      def.setEditing(false);
    });
    okBtn.addEventListener('click', async ()=>{
      okBtn.disabled = true;
      try{ if(await commitGate(def)) def.setEditing(false); }
      finally{ okBtn.disabled = false; }
    });
    editable.forEach(id => {
      const e = G(id);
      if(e.tagName === 'INPUT') e.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Enter'){ ev.preventDefault(); okBtn.click(); }
        else if(ev.key === 'Escape'){ cancelBtn.click(); }
      });
    });
  });
  // renderAccountGoals() repopulates the fields from the saved profile, so
  // anything still mid-edit goes back to locked with it.
  window.goalGatesLockAll = ()=> gateDefs.forEach(d => d.setEditing(false));

  // ---- Use recommended: review what would change, then confirm ----
  function recommendedGoalSet(){
    recomputeHealthTargets();
    const t = userHealthTargets;
    const rec = {sodium: 2300, fiber: 30, sugar: 50, steps: 10000, burn: 400};
    if(t){
      rec.cal = t.recommendedCalorieTarget;
      rec.protein = t.recommendedProteinTarget;
      rec.carbs = 180;
      rec.fat = Math.round(rec.cal * 0.3 / 9);
    }
    return rec;
  }
  function openRecommendedReview(){
    window.goalGatesLockAll();
    renderAccountGoals(); // discard any half-typed edits so "current" is what is saved
    const rec = recommendedGoalSet();
    const dietSel = G('goalDietPreset');
    const rows = [];
    const addRow = (label, cur, recVal, unit)=>{ if(recVal !== undefined) rows.push({label, cur, rec: recVal, unit: unit || ''}); };
    rows.push({label: 'Diet style', cur: dietSel.options[dietSel.selectedIndex].text, rec: 'No specific diet', unit: '', same: dietSel.value === 'open'});
    addRow('Daily energy', parseNum(G('goalEnergyCustom').value), rec.cal, ' kcal');
    addRow('Protein', parseNum(G('goalProteinCustom').value), rec.protein, ' g');
    addRow('Carbs', parseNum(G('goalCarbsCustom').value), rec.carbs, ' g');
    addRow('Fat', parseNum(G('goalFatCustom').value), rec.fat, ' g');
    addRow('Sodium', parseNum(G('goalSodiumCustom').value), rec.sodium, ' mg');
    addRow('Fiber', parseNum(G('goalFiberCustom').value), rec.fiber, ' g');
    addRow('Sugar', parseNum(G('goalSugarCustom').value), rec.sugar, ' g');
    addRow('Steps', parseNum(G('goalSteps').value), rec.steps, '');
    addRow('Calories burned', parseNum(G('goalCalorieBurn').value), rec.burn, ' kcal');
    rows.forEach(r => { if(r.same === undefined) r.same = Number(r.cur) === Number(r.rec); });
    const changed = rows.filter(r => !r.same);
    const fmt = (v, u)=> (typeof v === 'number' ? fmtNum(v) : foodSearchEscape(String(v))) + u;
    const overlay = document.createElement('div');
    overlay.className = 'goal-modal-overlay';
    overlay.innerHTML = `
      <div class="goal-modal" role="dialog" aria-modal="true" aria-label="Use recommended targets">
        <div class="goal-modal-title">Use recommended targets?</div>
        <div class="goal-modal-note">This replaces your nutrition and activity targets with the values calculated from your profile. Your sleep, water, fasting and target-weight goals are not touched.${userHealthTargets ? '' : ' Set up your profile to also get recommended calories and macros.'}</div>
        ${changed.length ? `<div class="goal-modal-list">${changed.map(r => `
          <div class="goal-modal-row"><span>${r.label}</span><span><s>${fmt(r.cur, r.unit)}</s> → <strong>${fmt(r.rec, r.unit)}</strong></span></div>`).join('')}</div>
          <div class="goal-modal-note">${rows.length - changed.length} other target${rows.length - changed.length === 1 ? '' : 's'} already match.</div>`
          : `<div class="goal-modal-note"><strong>Everything already matches the recommendation.</strong></div>`}
        <div class="goal-modal-actions">
          <button type="button" class="timer-btn reset" data-act="cancel">${changed.length ? 'Cancel' : 'Close'}</button>
          ${changed.length ? '<button type="button" class="timer-btn start" data-act="apply">Apply recommended</button>' : ''}
        </div>
      </div>`;
    const close = ()=> overlay.remove();
    overlay.addEventListener('click', async (e)=>{
      if(e.target === overlay || e.target.closest('[data-act="cancel"]')){ close(); return; }
      if(e.target.closest('[data-act="apply"]')){
        const profile = {...(userProfile || {})};
        profile.customCalorieTarget = null;
        profile.customProteinTarget = null;
        profile.customCarbTarget = null;
        profile.customFatTarget = null;
        profile.customSodiumTarget = null;
        profile.customFiberTarget = null;
        profile.customSugarTarget = null;
        profile.dietPreset = 'open';
        profile.stepsGoal = null;
        profile.calorieBurnGoal = null;
        await saveProfile(profile);
        close();
        goalsRerender();
        goalsToast('✓ Recommended targets applied');
      }
    });
    document.body.appendChild(overlay);
    const focusBtn = overlay.querySelector('[data-act="apply"]') || overlay.querySelector('[data-act="cancel"]');
    focusBtn.focus();
  }
  G('useRecommendedBtn').addEventListener('click', openRecommendedReview);

  document.getElementById('goalDietPreset').addEventListener('change', (e)=>{
    applyDietPreset(e.target.value);
  });
  document.getElementById('goalWeightUnit').addEventListener('change', (e)=>{
    const newUnit = e.target.value;
    if(newUnit === goalWeightUnitPrev) return;
    const input = document.getElementById('goalTargetWeight');
    const val = parseNum(input.value);
    if(!isNaN(val)){
      const kg = goalWeightUnitPrev === 'lbs' ? lbsToKg(val) : val;
      input.value = Math.round((newUnit === 'lbs' ? kgToLbs(kg) : kg) * 10) / 10;
    }
    goalWeightUnitPrev = newUnit;
    document.getElementById('goalTargetWeightLabel').textContent = `Target weight (${newUnit === 'lbs' ? 'lb' : 'kg'})`;
  });
  document.getElementById('toggleMoreMacros').addEventListener('click', ()=>{
    const grid = document.getElementById('moreMacrosGrid');
    grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
  });

  let usernameCheckTimeout;
  document.getElementById('acctUsername').addEventListener('input', (e)=>{
    clearTimeout(usernameCheckTimeout);
    const val = e.target.value.trim();
    const statusEl = document.getElementById('acctUsernameStatus');
    if(val === '' || val === (currentUser.username || '')){ statusEl.textContent = ''; return; }
    if(val.length < 6){ statusEl.textContent = 'Must be 6+ characters'; statusEl.style.color = '#B4472A'; return; }
    statusEl.textContent = 'Checking…';
    statusEl.style.color = 'var(--ink-soft)';
    usernameCheckTimeout = setTimeout(async ()=>{
      try{
        const res = await fetch(`api/auth.php?action=check_username&username=${encodeURIComponent(val)}`, {credentials:'same-origin'});
        const data = await res.json();
        if(data.available){ statusEl.textContent = 'Available'; statusEl.style.color = 'var(--forest-dark)'; }
        else { statusEl.textContent = data.reason || 'Not available'; statusEl.style.color = '#B4472A'; }
      }catch(err){ statusEl.textContent = ''; }
    }, 500);
  });

  document.getElementById('acctSaveBtn').addEventListener('click', async ()=>{
    const errBox = document.getElementById('acctError');
    errBox.style.display = 'none';
    const displayName = document.getElementById('acctDisplayName').value.trim();
    const username = document.getElementById('acctUsername').value.trim();
    try{
      const res = await fetch('api/auth.php?action=update_account', {
        method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({display_name: displayName, username})
      });
      const data = await res.json();
      if(!res.ok){
        errBox.textContent = data.error || 'Could not save changes.';
        errBox.style.display = 'block';
        return;
      }
      currentUser.display_name = data.display_name;
      currentUser.username = data.username;
      setUserBadge(data.display_name);
      const statusEl = document.getElementById('acctUsernameStatus');
      statusEl.textContent = 'Saved ✓';
      statusEl.style.color = 'var(--forest-dark)';
    }catch(err){
      errBox.textContent = 'Could not reach the server — check your connection and try again.';
      errBox.style.display = 'block';
    }
  });

  let feedbackCategory = 'idea';
  document.getElementById('feedbackCategoryRow').addEventListener('click', (e)=>{
    const btn = e.target.closest('.feedback-cat');
    if(!btn) return;
    feedbackCategory = btn.dataset.cat;
    document.querySelectorAll('.feedback-cat').forEach(b => b.classList.toggle('active', b === btn));
  });

  document.getElementById('feedbackSubmitBtn').addEventListener('click', async ()=>{
    const statusEl = document.getElementById('feedbackStatus');
    const message = document.getElementById('feedbackMessage').value.trim();
    if(!message){
      statusEl.textContent = 'Write a message first.';
      statusEl.style.color = '#B4472A';
      statusEl.style.display = 'block';
      return;
    }
    try{
      const res = await fetch('api/feedback.php', {
        method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({category: feedbackCategory, message})
      });
      const data = await res.json();
      if(!res.ok){
        statusEl.textContent = data.error || 'Could not send feedback.';
        statusEl.style.color = '#B4472A';
      } else {
        statusEl.textContent = 'Thanks — feedback sent.';
        statusEl.style.color = 'var(--forest-dark)';
        document.getElementById('feedbackMessage').value = '';
      }
      statusEl.style.display = 'block';
    }catch(err){
      statusEl.textContent = 'Could not reach the server — check your connection and try again.';
      statusEl.style.color = '#B4472A';
      statusEl.style.display = 'block';
    }
  });
})();

