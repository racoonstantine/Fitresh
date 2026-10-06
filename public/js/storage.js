/* ---------- Reliable saving: window.storage ----------
 * Every resource (nutrition, history, profile, ...) is stored on the server as
 * one JSON blob that the app rewrites in full on each change. That makes two
 * things dangerous, and this file guards against both:
 *
 *  1. A failed save (offline, server hiccup) used to vanish silently. Now the
 *     value is kept, written to localStorage so it survives a reload, retried
 *     with back-off / when the connection returns, and a banner says so.
 *  2. A device holding an old copy would overwrite edits made on another
 *     device. Reads remember the server's version stamp (updated_at) and
 *     writes send it back; the server answers 409 if the stamp moved, and the
 *     person picks which version to keep instead of one silently winning.
 *
 * Saves for the same resource are serialized and coalesced (only the latest
 * value is sent), which also keeps a device from conflicting with itself.
 */
(function(){
  const API = 'api/data.php';
  const resources = {};
  const LABELS = {
    nutrition: 'food and nutrition', weighins: 'weigh-ins', history: 'workout history', checked: 'workout check-offs',
    weights: 'exercise weights', theme: 'theme', profile: 'profile and goals', fasting: 'fasting', water: 'water',
    sleep: 'sleep', steps: 'steps', recentFoods: 'recent foods', favoriteFoods: 'favorite foods', workoutPlan: 'workout plan',
    trainingPlan: 'training plan', customWorkoutPlans: 'workout routines', sharing: 'sharing settings'
  };

  function st(name){
    return resources[name] || (resources[name] = {
      stamp: undefined,      // undefined = never read; null = server has nothing; string = version stamp
      pending: undefined, hasPending: false,
      waiters: [], flushing: null,
      conflict: null, rejected: null, force: false,
      retryMs: 0, retryTimer: null
    });
  }

  // ---- local persistence of unsent values ----
  function userId(){
    try{ return (typeof currentUser !== 'undefined' && currentUser && currentUser.id) ? String(currentUser.id) : 'anon'; }
    catch(e){ return 'anon'; }
  }
  function lsKey(name){ return 'fitresh.pending.v1.' + userId() + '.' + name; }
  function persist(name){
    const s = st(name);
    try{ localStorage.setItem(lsKey(name), JSON.stringify({value: s.pending, stamp: s.stamp === undefined ? null : s.stamp, unknownBase: s.stamp === undefined})); }catch(e){}
  }
  function unpersist(name){ try{ localStorage.removeItem(lsKey(name)); }catch(e){} }

  // ---- banner ----
  let banner = null, bannerTimer = null;
  function ensureBanner(){
    if(banner || typeof document === 'undefined' || !document.body) return banner;
    banner = document.createElement('div');
    banner.id = 'syncBanner';
    banner.setAttribute('role', 'status');
    banner.style.display = 'none';
    banner.innerHTML = '<span class="sync-text"></span><button type="button" class="sync-retry">Retry now</button>';
    banner.querySelector('.sync-retry').addEventListener('click', ()=>{ flushAll(true); });
    document.body.appendChild(banner);
    return banner;
  }
  function names(){ return Object.keys(resources); }
  function updateBanner(savedJustNow){
    const b = ensureBanner();
    if(!b) return;
    clearTimeout(bannerTimer);
    const stuck = names().filter(n => resources[n].hasPending && !resources[n].conflict);
    const rejected = names().filter(n => resources[n].rejected);
    const conflicts = names().filter(n => resources[n].conflict);
    const text = b.querySelector('.sync-text'), btn = b.querySelector('.sync-retry');
    if(rejected.length){
      text.textContent = '⚠ Couldn’t save ' + (LABELS[rejected[0]] || rejected[0]) + ': ' + resources[rejected[0]].rejected;
      btn.style.display = 'none'; b.className = 'sync-bad'; b.style.display = 'flex';
    } else if(conflicts.length){
      text.textContent = '⚠ ' + (LABELS[conflicts[0]] || conflicts[0]) + ' changed on another device — choose which version to keep.';
      btn.textContent = 'Review'; btn.style.display = ''; b.className = 'sync-bad'; b.style.display = 'flex';
      btn.onclick = ()=> showConflict(conflicts[0]);
    } else if(stuck.length){
      text.textContent = '⚠ Not saved yet — will keep trying.';
      btn.textContent = 'Retry now'; btn.style.display = ''; b.className = 'sync-bad'; b.style.display = 'flex';
      btn.onclick = ()=> flushAll(true);
    } else if(savedJustNow){
      text.textContent = '✓ Saved';
      btn.style.display = 'none'; b.className = 'sync-ok'; b.style.display = 'flex';
      bannerTimer = setTimeout(()=>{ b.style.display = 'none'; }, 1600);
    } else {
      b.style.display = 'none';
    }
  }

  // ---- conflict dialog ----
  let conflictOpen = false;
  function showConflict(name){
    if(conflictOpen || typeof document === 'undefined') return;
    const s = st(name);
    if(!s.conflict) return;
    conflictOpen = true;
    const label = LABELS[name] || name;
    const overlay = document.createElement('div');
    overlay.className = 'goal-modal-overlay';
    overlay.innerHTML = '<div class="goal-modal" role="dialog" aria-modal="true">' +
      '<div class="goal-modal-title">Your ' + label + ' changed on another device</div>' +
      '<div class="goal-modal-note">This device was about to save, but a newer version of your ' + label + ' was saved elsewhere in the meantime. ' +
      'Pick the one to keep — the other is discarded.</div>' +
      '<div class="goal-modal-actions" style="flex-direction:column;">' +
      '<button type="button" class="timer-btn start" data-act="theirs">Use the newer version (reload)</button>' +
      '<button type="button" class="timer-btn reset" data-act="mine">Keep what I just entered</button>' +
      '</div></div>';
    overlay.addEventListener('click', (e)=>{
      const act = e.target.closest('[data-act]');
      if(!act) return;
      overlay.remove();
      conflictOpen = false;
      if(act.dataset.act === 'mine'){
        s.conflict = null; s.force = true;   // deliberate overwrite: send without a base stamp
        updateBanner();
        flush(name);
      } else {
        s.conflict = null; s.hasPending = false; s.pending = undefined;
        unpersist(name);
        location.reload();
      }
    });
    document.body.appendChild(overlay);
  }

  // ---- the writer ----
  function scheduleRetry(name){
    const s = st(name);
    clearTimeout(s.retryTimer);
    s.retryMs = Math.min(60000, s.retryMs ? s.retryMs * 2 : 4000);
    s.retryTimer = setTimeout(()=>{ flush(name); }, s.retryMs);
  }

  async function flushLoop(name){
    const s = st(name);
    while(s.hasPending && !s.conflict && !s.rejected){
      const value = s.pending;
      s.hasPending = false;
      const waiters = s.waiters.splice(0);
      const body = {resource: name, value};
      if(!s.force && s.stamp !== undefined) body.base_updated_at = s.stamp === null ? 'none' : s.stamp;
      const requeue = ()=>{ if(!s.hasPending){ s.pending = value; s.hasPending = true; } };
      let res = null;
      try{
        res = await fetch(API, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      }catch(e){ res = null; }

      if(res && res.ok){
        let data = {};
        try{ data = await res.json(); }catch(e){}
        s.stamp = (data && data.updated_at) ? data.updated_at : s.stamp;
        s.force = false; s.retryMs = 0;
        waiters.forEach(w => w(true));
        if(!s.hasPending) unpersist(name);
        continue;
      }
      if(res && res.status === 401){
        requeue(); persist(name);
        waiters.forEach(w => w(false));
        if(typeof handleUnauthorized === 'function') handleUnauthorized();
        break;
      }
      if(res && res.status === 409){
        let data = {};
        try{ data = await res.json(); }catch(e){}
        requeue(); persist(name);
        s.conflict = {server: data.value, stamp: data.updated_at};
        s.stamp = data.updated_at || null;   // the next attempt (if "keep mine") is based on what is stored now
        waiters.forEach(w => w(false));
        showConflict(name);
        break;
      }
      if(res && res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429){
        // The server refused this value outright (too big, invalid): retrying cannot help.
        let msg = 'the server rejected it';
        try{ const d = await res.json(); if(d && d.error) msg = d.error; }catch(e){}
        s.rejected = msg; s.hasPending = false; s.pending = undefined;
        unpersist(name);
        waiters.forEach(w => w(false));
        break;
      }
      // Network error, 5xx, 408, 429: keep the value and try again later.
      requeue(); persist(name);
      waiters.forEach(w => w(false));
      scheduleRetry(name);
      break;
    }
    s.flushing = null;
    updateBanner(!s.hasPending && !s.conflict && !s.rejected && s._wasStuck);
    s._wasStuck = s.hasPending || !!s.conflict;
  }

  function flush(name){
    const s = st(name);
    if(s.flushing) return s.flushing;
    if(s.retryTimer){ clearTimeout(s.retryTimer); s.retryTimer = null; }
    s.flushing = flushLoop(name);
    return s.flushing;
  }
  function flushAll(manual){
    if(manual) names().forEach(n => { if(resources[n].rejected) resources[n].rejected = null; });
    return Promise.all(names().filter(n => resources[n].hasPending && !resources[n].conflict).map(flush));
  }

  // ---- public API (same shape the app always used) ----
  window.storage = {
    async get(key){
      try{
        const resource = key.replace(/^log:/, '');
        const s = st(resource);
        // An unsent local value is newer than anything the server could return.
        if(s.hasPending) return {value: s.pending};
        const res = await fetch(`${API}?resource=${encodeURIComponent(resource)}`, { credentials: 'same-origin' });
        if(res.status === 401){ if(typeof handleUnauthorized === 'function') handleUnauthorized(); return null; }
        if(!res.ok) return null;
        const data = await res.json();
        s.stamp = data.updated_at || null;
        return (data.value === null || data.value === undefined) ? null : { value: data.value };
      }catch(e){ return null; }
    },
    set(key, value){
      const resource = key.replace(/^log:/, '');
      const s = st(resource);
      s.pending = value; s.hasPending = true; s.rejected = null;
      persist(resource);
      const done = new Promise(resolve => s.waiters.push(resolve));
      if(!s.conflict) flush(resource);
      else updateBanner();
      return done;
    },
    flushAll,
    hasUnsaved(){ return names().some(n => resources[n].hasPending || resources[n].flushing); },
    // After login: replay values that never reached the server (closed tab, offline, expired session).
    async restorePending(){
      const prefix = 'fitresh.pending.v1.' + userId() + '.';
      let keys = [];
      try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.indexOf(prefix) === 0) keys.push(k); } }catch(e){}
      for(const k of keys){
        const name = k.slice(prefix.length);
        let saved = null;
        try{ saved = JSON.parse(localStorage.getItem(k)); }catch(e){}
        if(!saved || typeof saved.value !== 'string'){ try{ localStorage.removeItem(k); }catch(e){} continue; }
        const s = st(name);
        if(s.hasPending) continue;
        s.pending = saved.value; s.hasPending = true;
        s.stamp = saved.unknownBase ? undefined : saved.stamp;
        flush(name);
      }
      await Promise.all(names().map(n => resources[n].flushing).filter(Boolean));
    },
    _state: resources   // exposed for tests
  };

  // ---- housekeeping ----
  if(typeof window !== 'undefined' && window.addEventListener){
    window.addEventListener('online', ()=>{ flushAll(); });
    window.addEventListener('beforeunload', (e)=>{
      if(window.storage.hasUnsaved()){ e.preventDefault(); e.returnValue = ''; }
    });
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState === 'hidden'){ hiddenAt = Date.now(); return; }
      flushAll();
      // A tab left open for a long while holds an old copy of everything; reload it
      // (when nothing is unsaved and nothing is half-filled in) so edits start from current data.
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if(away < 10 * 60 * 1000) return;
      if(typeof currentUser === 'undefined' || !currentUser) return;
      if(window.storage.hasUnsaved() || names().some(n => resources[n].conflict)) return;
      const modalOpen = Array.from(document.querySelectorAll('.fullscreen-modal')).some(m => m.style.display && m.style.display !== 'none');
      if(modalOpen) return;
      location.reload();
    });
  }
})();
