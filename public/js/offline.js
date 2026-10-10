/* ---------- Offline support: outbox for meal logs, offline meal views, service worker ----------
 * storage.js keeps the date-keyed JSON blobs (weight, sleep, steps, water, workout history,
 * check-offs, notes ...) saved. Meals are relational (api/meals.php), so they get their own
 * outbox here:
 *  - A meal log is sent with a client-made key. If the phone has no signal (or the reply is
 *    lost) it waits in a queue kept in localStorage and is replayed, in order, when the
 *    connection returns. The server remembers keys it has seen, so a retry never doubles a meal.
 *  - The Food tab / Today read the day through mealsDay()/mealsRange(): the last server answer
 *    is kept locally and queued meals are laid on top, marked as waiting to sync.
 * Online-only on purpose: food search (Open Food Facts), saving a new database food, editing or
 * removing meals that are already on the server, admin, password reset.
 */
(function(){
  const OUTBOX = 'fitresh.outbox.v1.';
  const CACHE = 'fitresh.cache.v1.';
  const MAX_DAYS = 21;
  let loadedFor = null, queue = [], failed = [], flushing = null, retryMs = 0, retryTimer = null;
  const syncedListeners = [];

  function uid(){
    try{ return (typeof currentUser !== 'undefined' && currentUser && currentUser.id) ? String(currentUser.id) : 'anon'; }
    catch(e){ return 'anon'; }
  }
  function ensure(){
    const u = uid();
    if(loadedFor === u) return;
    loadedFor = u; failed = [];
    try{ queue = JSON.parse(localStorage.getItem(OUTBOX + u)) || []; }catch(e){ queue = []; }
    if(!Array.isArray(queue)) queue = [];
  }
  function save(){ try{ localStorage.setItem(OUTBOX + loadedFor, JSON.stringify(queue)); }catch(e){} }
  function offline(){ return typeof navigator !== 'undefined' && navigator.onLine === false; }
  function changed(savedJustNow){
    if(window.storage && window.storage.refreshBanner) window.storage.refreshBanner(savedJustNow);
  }
  function newKey(){
    try{ if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID().replace(/-/g, ''); }catch(e){}
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
  }

  async function send(item){
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(()=> ctl.abort(), 12000) : null;
    try{
      const res = await fetch(item.url, {
        method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.assign({}, item.body, {client_key: item.key})), signal: ctl ? ctl.signal : undefined
      });
      let data = {};
      try{ data = await res.json(); }catch(e){}
      return {ok: res.ok, status: res.status, data};
    }catch(e){ return {ok: false, status: 0, data: {}}; }
    finally{ if(timer) clearTimeout(timer); }
  }
  const retryable = r => r.status === 0 || r.status >= 500 || r.status === 408 || r.status === 429;

  function scheduleRetry(){
    clearTimeout(retryTimer);
    retryMs = Math.min(60000, retryMs ? retryMs * 2 : 4000);
    retryTimer = setTimeout(()=>{ flush(); }, retryMs);
  }

  function flush(){
    ensure();
    if(flushing) return flushing;
    clearTimeout(retryTimer);
    flushing = (async ()=>{
      let sent = 0;
      while(queue.length){
        if(offline()) break;
        const item = queue[0];
        const r = await send(item);
        if(r.ok){ queue.shift(); save(); sent++; retryMs = 0; continue; }
        if(r.status === 401){ if(typeof handleUnauthorized === 'function') handleUnauthorized(); break; }
        if(retryable(r)){ scheduleRetry(); break; }
        // The server refused this entry outright; retrying cannot help, so say so and move on.
        queue.shift(); save();
        failed.push({label: (item.meta && item.meta.label) || 'entry', error: (r.data && r.data.error) || 'the server rejected it'});
      }
      flushing = null;
      changed(sent > 0 && !queue.length && !failed.length);
      if(sent) syncedListeners.forEach(fn => { try{ fn(); }catch(e){} });
    })();
    return flushing;
  }

  // Send now when possible; otherwise (or on a lost connection) queue it. ok:true means "safe": saved or queued.
  async function post(url, body, meta){
    ensure();
    const item = {key: newKey(), url, body, meta: meta || {}, queuedAt: Date.now()};
    if(!offline() && !queue.length){
      const r = await send(item);
      if(r.ok) return {ok: true, queued: false, data: r.data};
      if(!retryable(r) && r.status !== 401) return {ok: false, status: r.status, data: r.data};
      if(r.status === 401 && typeof handleUnauthorized === 'function') handleUnauthorized();
    }
    queue.push(item); save();
    changed();
    if(!offline()) flush();
    return {ok: true, queued: true};
  }

  // ---- meal views: last server answer + queued meals on top ----
  function cKey(suffix){ return CACHE + uid() + '.' + suffix; }
  function cGet(suffix){ try{ return JSON.parse(localStorage.getItem(cKey(suffix))); }catch(e){ return null; } }
  function cSet(suffix, v){ try{ localStorage.setItem(cKey(suffix), JSON.stringify(v)); }catch(e){} }
  function cacheDay(date, data){
    cSet('meals.day.' + date, data);
    let days = cGet('meals.days') || [];
    days = days.filter(d => d !== date); days.push(date);
    while(days.length > MAX_DAYS){ try{ localStorage.removeItem(cKey('meals.day.' + days.shift())); }catch(e){} }
    cSet('meals.days', days);
  }

  function queuedLogs(){ ensure(); return queue.filter(i => /action=log\b/.test(i.url) && i.body && i.body.date); }
  function nutrientsOf(m){ return {ENERC_KCAL: m.kcal || 0, PROCNT: m.protein || 0, FAT: m.fat || 0, CHOCDF: m.carbs || 0}; }

  function withQueued(date, data){
    const entries = (data.entries || []).map(e => Object.assign({}, e, {components: (e.components || []).slice()}));
    const totals = Object.assign({}, data.totals || {});
    queuedLogs().filter(i => i.body.date === date).forEach(i => {
      const m = i.meta || {}, type = i.body.meal_type || 'snack';
      let entry = entries.find(e => e.meal_type === type && !e.display_name);
      if(!entry){ entry = {id: 'q-' + type, meal_type: type, display_name: null, components: []}; entries.push(entry); }
      const n = nutrientsOf(m);
      entry.components.push({id: 'q:' + i.key, queued: true, key: i.key, name: m.name || 'Food', amount: m.amount || '', unit: m.unit || '', nutrients: n, food_source: null});
      Object.keys(n).forEach(c => { totals[c] = (totals[c] || 0) + n[c]; });
    });
    return {entries, totals};
  }

  async function mealsDay(date){
    ensure();
    let data = null;
    try{
      const res = await fetch(`api/meals.php?action=day&date=${date}`, {credentials: 'same-origin'});
      if(res.status === 401 && typeof handleUnauthorized === 'function') handleUnauthorized();
      if(res.status >= 500) throw new Error('server down');
      data = await res.json();
      if(res.ok) cacheDay(date, data);
    }catch(e){
      data = cGet('meals.day.' + date) || {entries: [], totals: {}};
      data.offline = true;
    }
    const out = withQueued(date, data);
    out.offline = !!data.offline;
    return out;
  }

  async function mealsRange(start, end){
    ensure();
    let totals = null;
    try{
      const res = await fetch(`api/meals.php?action=range_totals&start=${start}&end=${end}`, {credentials: 'same-origin'});
      if(res.status >= 500) throw new Error('server down');
      const data = await res.json();
      totals = data.totals || {};
      if(res.ok) cSet('meals.range', {start, end, totals});
    }catch(e){
      // Offline: rebuild from the last range answer, then fresher per-day copies where we have them.
      totals = {};
      const r = cGet('meals.range');
      if(r && r.totals) Object.keys(r.totals).forEach(d => { if(d >= start && d <= end) totals[d] = r.totals[d]; });
      (cGet('meals.days') || []).forEach(d => {
        if(d < start || d > end) return;
        const day = cGet('meals.day.' + d);
        if(day && day.totals && Object.keys(day.totals).length) totals[d] = day.totals;
      });
    }
    queuedLogs().forEach(i => {
      const d = i.body.date;
      if(d < start || d > end) return;
      const n = nutrientsOf(i.meta || {});
      totals[d] = Object.assign({}, totals[d] || {});
      Object.keys(n).forEach(c => { totals[d][c] = (totals[d][c] || 0) + n[c]; });
    });
    return totals;
  }

  window.outbox = {
    post, flush, mealsDay, mealsRange,
    logMeal(body, meta){ return post('api/meals.php?action=log', body, Object.assign({label: 'meal'}, meta || {})); },
    queuedLogs,
    count(){ ensure(); return queue.length; },
    failures(){ ensure(); return failed.slice(); },
    dismissFailures(){ failed = []; changed(); },
    cancel(key){ ensure(); const n = queue.length; queue = queue.filter(i => i.key !== key); save(); changed(); return queue.length < n; },
    onSynced(fn){ syncedListeners.push(fn); },
    _queue(){ ensure(); return queue; }
  };

  if(typeof window !== 'undefined' && window.addEventListener){
    window.addEventListener('online', ()=>{ retryMs = 0; if(flushing) flushing.then(flush); else flush(); });   // a flush already failing must not swallow this
    window.addEventListener('offline', ()=>{ changed(); });
    if(typeof document !== 'undefined'){
      document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'visible') flush(); });
    }
    // App shell for offline launches (see sw.js). Needs https or localhost.
    if(typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof location !== 'undefined' &&
       (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')){
      window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
    }
  }
})();
