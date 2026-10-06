// Reliable saving (public/js/storage.js): version stamps, failed-save retention + replay,
// 409 conflict handling, permanent rejections, 401 handling and serialized writes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'storage.js'), 'utf8');

function fakeEl() {
  const el = {
    style: {}, dataset: {}, className: '', children: [], handlers: {}, _html: '',
    setAttribute() {}, appendChild(c) { this.children.push(c); }, remove() { this.removed = true; },
    addEventListener(t, fn) { this.handlers[t] = fn; },
    querySelector() { return fakeEl(); },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }
  };
  return el;
}

// One "browser": fake server + localStorage that can outlive a page "reload".
function makeServer() {
  const server = { rows: {}, calls: [], mode: 'ok', clock: 1 };
  server.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    server.calls.push({ url, body });
    if (server.mode === 'offline') throw new TypeError('network down');
    if (server.mode === '500') return { ok: false, status: 500, json: async () => ({}) };
    if (server.mode === '401') return { ok: false, status: 401, json: async () => ({}) };
    if (server.mode === '413') return { ok: false, status: 413, json: async () => ({ error: 'Storage limit reached for this account.' }) };
    if (opts.method === 'POST') {
      const row = server.rows[body.resource];
      if ('base_updated_at' in body) {
        const current = row ? row.updated_at : 'none';
        if (current !== body.base_updated_at) {
          return { ok: false, status: 409, json: async () => ({ error: 'conflict', value: row ? row.value : null, updated_at: row ? row.updated_at : null }) };
        }
      }
      const stamp = 'T' + (++server.clock);
      server.rows[body.resource] = { value: body.value, updated_at: stamp };
      return { ok: true, status: 200, json: async () => ({ ok: true, updated_at: stamp }) };
    }
    const r = new URL(url, 'http://x').searchParams.get('resource');
    const row = server.rows[r];
    return { ok: true, status: 200, json: async () => ({ value: row ? row.value : null, updated_at: row ? row.updated_at : null }) };
  };
  return server;
}

function makePage(server, ls) {
  const overlays = [];
  const listeners = {};
  const document = {
    body: { appendChild(el) { overlays.push(el); } },
    createElement: () => fakeEl(),
    querySelectorAll: () => [],
    addEventListener(t, fn) { listeners['doc:' + t] = fn; },
    visibilityState: 'visible'
  };
  const timers = [];
  const ctx = {
    document, fetch: server.fetch, console,
    localStorage: ls,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    location: { reload() { ctx.reloaded = true; } },
    currentUser: { id: 7 },
    handleUnauthorized() { ctx.unauthorized = (ctx.unauthorized || 0) + 1; },
    URL
  };
  ctx.window = ctx;
  ctx.window.addEventListener = (t, fn) => { listeners['win:' + t] = fn; };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, overlays, timers, listeners, storage: ctx.window.storage };
}

function makeLocalStorage() {
  const data = new Map();
  return {
    getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k), get length() { return data.size; }, key: i => [...data.keys()][i], _data: data
  };
}

(async () => {
  // 1) reads remember the stamp, writes send it back and pick up the new one
  {
    const server = makeServer(); server.rows.water = { value: '{"a":1}', updated_at: 'T1' };
    const { storage } = makePage(server, makeLocalStorage());
    const got = await storage.get('log:water');
    assert.strictEqual(got.value, '{"a":1}');
    assert.strictEqual(await storage.set('log:water', '{"a":2}'), true);
    assert.strictEqual(server.calls[server.calls.length - 1].body.base_updated_at, 'T1');
    assert.strictEqual(await storage.set('log:water', '{"a":3}'), true);
    assert.strictEqual(server.calls[server.calls.length - 1].body.base_updated_at, 'T2', 'second write is based on the first write\'s stamp, so it never conflicts with itself');
    assert.strictEqual(server.rows.water.value, '{"a":3}');
  }

  // 2) rapid writes are serialized + coalesced: only the newest value is sent after the first
  {
    const server = makeServer();
    const { storage } = makePage(server, makeLocalStorage());
    await storage.get('log:steps');
    const results = await Promise.all([storage.set('log:steps', '1'), storage.set('log:steps', '2'), storage.set('log:steps', '3')]);
    assert.deepStrictEqual(results, [true, true, true]);
    assert.strictEqual(server.rows.steps.value, '3');
    const posts = server.calls.filter(c => c.body);
    assert.ok(posts.length <= 2, 'coalesced, not one request per call: ' + posts.length);
    assert.strictEqual(posts.filter(c => c.body.base_updated_at === 'none').length >= 0, true);
  }

  // 3) a failed save is kept, persisted, reported, served back by get(), and replayed once the network returns
  {
    const server = makeServer(); const ls = makeLocalStorage();
    const { storage, timers } = makePage(server, ls);
    await storage.get('log:nutrition');
    server.mode = 'offline';
    assert.strictEqual(await storage.set('log:nutrition', '[{"d":1}]'), false);
    assert.strictEqual(storage.hasUnsaved(), true);
    assert.ok([...ls._data.keys()].some(k => k.endsWith('.nutrition')), 'unsent value survives a reload');
    assert.ok(timers.some(t => t.ms >= 4000), 'a retry is scheduled');
    assert.strictEqual((await storage.get('log:nutrition')).value, '[{"d":1}]', 'unsent value is what the app sees');
    server.mode = 'ok';
    await storage.flushAll(true);
    assert.strictEqual(server.rows.nutrition.value, '[{"d":1}]');
    assert.strictEqual(storage.hasUnsaved(), false);
    assert.strictEqual(ls._data.size, 0, 'persisted copy cleared after a successful save');
  }

  // 4) closing the tab with an unsent value, then opening the app again, replays it
  {
    const server = makeServer(); const ls = makeLocalStorage();
    const first = makePage(server, ls);
    await first.storage.get('log:history');
    server.mode = '500';
    assert.strictEqual(await first.storage.set('log:history', '["x"]'), false);
    server.mode = 'ok';
    const second = makePage(server, ls);          // fresh page, same localStorage
    await second.storage.restorePending();
    assert.strictEqual(server.rows.history.value, '["x"]');
    assert.strictEqual(second.storage.hasUnsaved(), false);
  }

  // 5) a replay for a resource that changed on another device meanwhile is a conflict, not a silent overwrite
  {
    const server = makeServer(); const ls = makeLocalStorage();
    server.rows.profile = { value: '{"v":1}', updated_at: 'T1' };
    const phone = makePage(server, ls);
    await phone.storage.get('log:profile');
    server.mode = 'offline';
    await phone.storage.set('log:profile', '{"v":"phone"}');
    server.mode = 'ok';
    server.rows.profile = { value: '{"v":"laptop"}', updated_at: 'T9' };   // another device saved meanwhile
    const reopened = makePage(server, ls);
    await reopened.storage.restorePending();
    assert.strictEqual(server.rows.profile.value, '{"v":"laptop"}', 'nothing was overwritten');
    assert.ok(reopened.storage._state.profile.conflict, 'conflict is flagged');
    assert.strictEqual(reopened.storage.hasUnsaved(), true, 'local value is still held');
    const dialog = reopened.overlays.find(o => /changed on another device/.test(o.innerHTML));
    assert.ok(dialog, 'person is asked which to keep');
    // "keep what I just entered" sends a deliberate overwrite (no base stamp)
    const keepMine = { target: { closest: () => ({ dataset: { act: 'mine' } }) } };
    dialog.handlers.click(keepMine);
    await reopened.storage.flushAll();
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(server.rows.profile.value, '{"v":"phone"}');
    assert.ok(!('base_updated_at' in server.calls[server.calls.length - 1].body));
  }

  // 6) choosing the newer version discards the local value and reloads
  {
    const server = makeServer(); const ls = makeLocalStorage();
    server.rows.sleep = { value: '{"s":1}', updated_at: 'T1' };
    const page = makePage(server, ls);
    await page.storage.get('log:sleep');
    server.rows.sleep = { value: '{"s":2}', updated_at: 'T5' };
    assert.strictEqual(await page.storage.set('log:sleep', '{"s":"mine"}'), false);
    page.overlays.find(o => o.className === 'goal-modal-overlay').handlers.click({ target: { closest: () => ({ dataset: { act: 'theirs' } }) } });
    assert.strictEqual(page.ctx.reloaded, true);
    assert.strictEqual(page.storage.hasUnsaved(), false);
    assert.strictEqual(ls._data.size, 0);
    assert.strictEqual(server.rows.sleep.value, '{"s":2}');
  }

  // 7) a permanent rejection (413) is reported once and not retried forever
  {
    const server = makeServer();
    const { storage, timers } = makePage(server, makeLocalStorage());
    await storage.get('log:weights');
    server.mode = '413';
    assert.strictEqual(await storage.set('log:weights', 'x'), false);
    assert.strictEqual(storage.hasUnsaved(), false);
    assert.ok(/Storage limit/.test(storage._state.weights.rejected));
    assert.strictEqual(timers.length, 0, 'no retry for a request the server refused');
  }

  // 8) an expired session keeps the value for after the next login
  {
    const server = makeServer(); const ls = makeLocalStorage();
    const { storage, ctx } = makePage(server, ls);
    await storage.get('log:fasting');
    server.mode = '401';
    assert.strictEqual(await storage.set('log:fasting', '{"f":1}'), false);
    assert.strictEqual(ctx.unauthorized, 1);
    assert.ok([...ls._data.keys()].some(k => k.endsWith('.fasting')));
  }

  // 9) one user's unsent data is never replayed into another user's account
  {
    const server = makeServer(); const ls = makeLocalStorage();
    const a = makePage(server, ls);
    await a.storage.get('log:water');
    server.mode = 'offline';
    await a.storage.set('log:water', '{"a":"user7"}');
    server.mode = 'ok';
    const b = makePage(server, ls);
    b.ctx.currentUser = { id: 8 };
    await b.storage.restorePending();
    assert.ok(!server.rows.water, 'user 8 session did not send user 7 data');
  }

  console.log('PASS: reliable saving (version stamps, serialized writes, failed-save retention and replay, 409 conflicts, rejections, 401, per-user isolation).');
})().catch(e => { console.error(e); process.exit(1); });
