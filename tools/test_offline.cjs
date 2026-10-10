// Offline support: the meal outbox + offline meal views (public/js/offline.js) and the
// service worker (public/sw.js).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const offlineSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'offline.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');

function makeLocalStorage() {
  const data = new Map();
  return {
    getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k), get length() { return data.size; }, key: i => [...data.keys()][i], _data: data
  };
}

// fake server: remembers client_keys like api/meals.php does
function makeServer() {
  const server = { mode: 'ok', calls: [], meals: [], keys: new Set(), day: { entries: [], totals: {} }, bannerCalls: [] };
  server.fetch = async (url, opts = {}) => {
    server.calls.push({ url, opts });
    if (server.mode === 'offline') throw new TypeError('network down');
    if (server.mode === '500') return { ok: false, status: 500, json: async () => ({}) };
    if (server.mode === '401') return { ok: false, status: 401, json: async () => ({}) };
    if (server.mode === '400') return { ok: false, status: 400, json: async () => ({ error: 'Invalid amount or unit.' }) };
    if (opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      assert.strictEqual(opts.headers['Content-Type'], 'application/json');
      if (body.client_key && server.keys.has(body.client_key)) return { ok: true, status: 200, json: async () => ({ ok: true, duplicate: true }) };
      if (body.client_key) server.keys.add(body.client_key);
      server.meals.push(body);
      return { ok: true, status: 200, json: async () => ({ ok: true, meal_entry_id: server.meals.length }) };
    }
    if (/action=day/.test(url)) return { ok: true, status: 200, json: async () => server.day };
    if (/action=range_totals/.test(url)) return { ok: true, status: 200, json: async () => ({ totals: { '2026-10-01': { ENERC_KCAL: 500 } } }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return server;
}

function makePage(server, ls, userId = 7) {
  const timers = [];
  const listeners = {};
  const ctx = {
    fetch: server.fetch, console, localStorage: ls, URL,
    navigator: { onLine: true },
    document: { visibilityState: 'visible', addEventListener(t, fn) { listeners['doc:' + t] = fn; } },
    location: { protocol: 'http:', hostname: 'example.test' },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout() {},
    currentUser: { id: userId },
    handleUnauthorized() { ctx.unauthorized = (ctx.unauthorized || 0) + 1; },
    AbortController
  };
  ctx.window = ctx;
  ctx.storage = { refreshBanner(saved) { server.bannerCalls.push(saved); } };
  ctx.window.addEventListener = (t, fn) => { listeners['win:' + t] = fn; };
  vm.createContext(ctx);
  vm.runInContext(offlineSrc, ctx);
  return { ctx, outbox: ctx.window.outbox, timers, listeners };
}

const meal = (extra = {}) => ({ date: '2026-10-01', meal_type: 'lunch', component: { food_id: 5, amount: 150, unit: 'g' }, ...extra });
const meta = { name: 'Rice', amount: 150, unit: 'g', kcal: 195, protein: 4, fat: 0.4, carbs: 43 };

(async () => {
  // 1) online: sent immediately with a client key, nothing queued
  {
    const server = makeServer(); const { outbox } = makePage(server, makeLocalStorage());
    const r = await outbox.logMeal(meal(), meta);
    assert.deepStrictEqual([r.ok, r.queued], [true, false]);
    assert.strictEqual(outbox.count(), 0);
    assert.ok(/^[A-Za-z0-9_-]{8,64}$/.test(server.meals[0].client_key), 'every log carries a valid idempotency key');
  }

  // 2) no signal: queued, persisted, shown over the cached day; replayed once online
  {
    const server = makeServer(); const ls = makeLocalStorage();
    const { ctx, outbox, listeners } = makePage(server, ls);
    server.day = { entries: [{ id: 1, meal_type: 'lunch', display_name: null, components: [{ id: 11, name: 'Soup', amount: 1, unit: 'serving', nutrients: { ENERC_KCAL: 100 } }] }], totals: { ENERC_KCAL: 100 } };
    await outbox.mealsDay('2026-10-01');                      // online read fills the local copy
    ctx.navigator.onLine = false; server.mode = 'offline';
    const calls = server.calls.length;
    const r = await outbox.logMeal(meal(), meta);
    assert.deepStrictEqual([r.ok, r.queued], [true, true]);
    assert.strictEqual(server.calls.length, calls, 'no request is attempted while offline');
    assert.ok([...ls._data.keys()].some(k => k.indexOf('fitresh.outbox.v1.7') === 0), 'queue survives a reload');
    const day = await outbox.mealsDay('2026-10-01');          // fetch throws -> cached copy + queued meal
    assert.strictEqual(day.offline, true);
    const lunch = day.entries.filter(e => e.meal_type === 'lunch');
    assert.strictEqual(lunch.length, 1, 'queued meal joins the existing Lunch group');
    assert.strictEqual(JSON.stringify(lunch[0].components.map(c => c.name)), '["Soup","Rice"]');
    assert.strictEqual(lunch[0].components[1].queued, true);
    assert.strictEqual(day.totals.ENERC_KCAL, 295, 'totals include the waiting meal');
    const range = await outbox.mealsRange('2026-09-30', '2026-10-02');
    assert.ok(range['2026-10-01'].ENERC_KCAL >= 195, 'range totals offline include the queued meal');

    // back online -> replay
    let synced = 0; outbox.onSynced(() => synced++);
    ctx.navigator.onLine = true; server.mode = 'ok';
    listeners['win:online']();
    await outbox.flush();
    assert.strictEqual(outbox.count(), 0);
    assert.strictEqual(server.meals.length, 1);
    assert.strictEqual(synced, 1);
    assert.strictEqual([...ls._data.keys()].filter(k => k.indexOf('fitresh.outbox') === 0).length, 1);
    assert.strictEqual(JSON.parse(ls.getItem('fitresh.outbox.v1.7')).length, 0);
  }

  // 3) a lost reply: the same key is replayed, the server de-duplicates, so the meal exists once
  {
    const server = makeServer(); const { outbox } = makePage(server, makeLocalStorage());
    const realFetch = server.fetch;
    let dropReply = true;
    const page = makePage({ ...server, fetch: async (u, o) => { const res = await realFetch(u, o); if (dropReply && o && o.method === 'POST') { dropReply = false; throw new TypeError('reply lost'); } return res; }, calls: [], bannerCalls: [] }, makeLocalStorage());
    const r = await page.outbox.logMeal(meal(), meta);
    assert.strictEqual(r.queued, true, 'unknown outcome is queued, not reported as failed');
    await page.outbox.flush();
    assert.strictEqual(page.outbox.count(), 0);
    assert.strictEqual(server.meals.length, 1, 'stored exactly once');
  }

  // 4) outcomes: 5xx waits and retries with back-off, 4xx is reported and dropped, 401 keeps the entry
  {
    const server = makeServer(); const { ctx, outbox, timers } = makePage(server, makeLocalStorage());
    server.mode = '500';
    assert.strictEqual((await outbox.logMeal(meal(), meta)).queued, true);
    assert.strictEqual(outbox.count(), 1);
    assert.ok(timers.some(t => t.ms >= 4000), 'retry scheduled');
    server.mode = '401'; await outbox.flush(); await outbox.flush();
    assert.strictEqual(ctx.unauthorized >= 1, true); assert.strictEqual(outbox.count(), 1, 'kept for after the next login');
    server.mode = '400'; await outbox.flush(); await outbox.flush();
    assert.strictEqual(outbox.count(), 0);
    assert.strictEqual(JSON.stringify(outbox.failures().map(f => f.error)), '["Invalid amount or unit."]');
    outbox.dismissFailures(); assert.strictEqual(outbox.failures().length, 0);
    // 400 on the first, direct attempt is returned to the caller instead of queued
    const direct = await outbox.logMeal(meal(), meta);
    assert.deepStrictEqual([direct.ok, direct.status], [false, 400]);
    assert.strictEqual(outbox.count(), 0);
  }

  // 5) order is preserved, cancel removes, users are isolated
  {
    const server = makeServer(); const ls = makeLocalStorage();
    const a = makePage(server, ls); a.ctx.navigator.onLine = false; server.mode = 'offline';
    await a.outbox.logMeal(meal({ meal_type: 'breakfast' }), { ...meta, name: 'One' });
    await a.outbox.logMeal(meal({ meal_type: 'lunch' }), { ...meta, name: 'Two' });
    const gone = a.outbox.queuedLogs()[0].key;
    await a.outbox.logMeal(meal({ meal_type: 'dinner' }), { ...meta, name: 'Three' });
    assert.strictEqual(a.outbox.cancel(gone), true);
    const b = makePage(server, ls, 8);
    assert.strictEqual(b.outbox.count(), 0, 'another account on this device sees nothing');
    a.ctx.navigator.onLine = true; server.mode = 'ok';
    await a.outbox.flush();
    assert.strictEqual(JSON.stringify(server.meals.map(m => m.meal_type)), '["lunch","dinner"]', 'replayed in the order logged');
  }

  // ---- service worker ----
  {
    const handlers = {};
    const cacheStore = new Map();
    const cache = {
      match: async req => cacheStore.get(typeof req === 'string' ? req : req.url),
      put: async (req, res) => { cacheStore.set(typeof req === 'string' ? req : req.url, res); },
      keys: async () => [...cacheStore.keys()].map(url => ({ url })),
      delete: async req => cacheStore.delete(typeof req === 'string' ? req : req.url),
      add: async () => {}
    };
    let online = true;
    const sw = {
      addEventListener: (t, fn) => { handlers[t] = fn; },
      location: { origin: 'https://fitresh.com' }, registration: { scope: 'https://fitresh.com/' },
      skipWaiting() {}, clients: { claim: async () => {} },
      caches: { open: async () => cache, keys: async () => ['fitresh-shell-v1'], delete: async () => true },
      fetch: async (req) => { if (!online) throw new TypeError('offline'); return { ok: true, clone() { return this; }, tag: 'network' }; },
      URL, Request: function (u) { this.url = u; }
    };
    sw.self = sw;
    vm.createContext(sw);
    vm.runInContext(swSrc, sw);
    const fire = (req) => { let p = null; handlers.fetch({ request: req, respondWith: x => { p = x; } }); return p; };

    assert.strictEqual(fire({ method: 'GET', url: 'https://fitresh.com/api/data.php?resource=water', mode: 'cors' }), null, 'API reads are never intercepted');
    assert.strictEqual(fire({ method: 'POST', url: 'https://fitresh.com/api/data.php', mode: 'cors' }), null, 'writes are never intercepted');
    assert.strictEqual(fire({ method: 'GET', url: 'https://cdn.example.com/x.js', mode: 'cors' }), null, 'other origins are left alone');

    const nav = { method: 'GET', url: 'https://fitresh.com/', mode: 'navigate' };
    assert.strictEqual((await fire(nav)).tag, 'network', 'online: page comes from the network');
    online = false;
    assert.strictEqual((await fire(nav)).tag, 'network', 'offline: falls back to the copy cached while online');
    const asset = { method: 'GET', url: 'https://fitresh.com/js/core.js?v=abc123', mode: 'no-cors' };
    online = true; await fire(asset);
    online = false;
    assert.strictEqual((await fire(asset)).tag, 'network', 'stamped assets are served from cache offline');
    online = true; await fire({ method: 'GET', url: 'https://fitresh.com/js/core.js?v=def456', mode: 'no-cors' });
    assert.ok(![...cacheStore.keys()].some(k => k.endsWith('v=abc123')), 'old hashed copies are dropped when the file changes');
  }

  console.log('PASS: offline outbox (queue, de-duplicated replay, ordering, failures, per-user), offline meal views, service worker routing.');
})().catch(e => { console.error(e); process.exit(1); });
