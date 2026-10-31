// Startup prefetch (public/js/storage.js): the first screen asks for all its resources at once,
// each later get() reuses its answer once, and nothing stale is ever served after a save.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const same = (actual, expected, msg) => assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'storage.js'), 'utf8');

function fakeEl() {
  return {
    style: {}, dataset: {}, className: '', children: [], handlers: {}, _html: '',
    setAttribute() {}, appendChild(c) { this.children.push(c); }, remove() {},
    addEventListener(t, fn) { this.handlers[t] = fn; }, querySelector() { return fakeEl(); },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }
  };
}

function makePage(mode) {
  const server = { rows: {}, calls: [], mode: mode || 'ok', clock: 1 };
  const fetch = async (url, opts = {}) => {
    server.calls.push(url);
    if (server.mode === 'offline') throw new TypeError('network down');
    if (opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      const stamp = 'T' + (++server.clock);
      server.rows[body.resource] = { value: body.value, updated_at: stamp };
      return { ok: true, status: 200, json: async () => ({ ok: true, updated_at: stamp }) };
    }
    const r = new URL(url, 'http://x').searchParams.get('resource');
    const row = server.rows[r];
    return { ok: true, status: 200, json: async () => ({ value: row ? row.value : null, updated_at: row ? row.updated_at : null }) };
  };
  const data = new Map();
  const ctx = {
    document: { body: { appendChild() {} }, createElement: () => fakeEl(), querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible' },
    fetch, console, URL, AbortController,
    localStorage: { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), get length() { return data.size; }, key: i => [...data.keys()][i] },
    setTimeout: () => 1, clearTimeout() {},
    location: { reload() {} }, currentUser: { id: 7 }, handleUnauthorized() {}
  };
  ctx.window = ctx;
  ctx.window.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, server, storage: ctx.window.storage };
}

(async () => {
  // 1) prefetch fires every read immediately; the gets then reuse them without asking again
  {
    const { server, storage } = makePage();
    server.rows.water = { value: '{"w":1}', updated_at: 'T1' };
    server.rows.sleep = { value: '{"s":2}', updated_at: 'T1' };
    storage.prefetch(['log:water', 'log:sleep', 'log:steps']);
    assert.strictEqual(server.calls.length, 3, 'all three reads start at once');
    same(await storage.get('log:water'), { value: '{"w":1}' });
    same(await storage.get('log:sleep'), { value: '{"s":2}' });
    assert.strictEqual(await storage.get('log:steps'), null, 'a resource with nothing stored is still null');
    assert.strictEqual(server.calls.length, 3, 'no second request for prefetched resources');
    // 2) an answer is used once: the next get asks the server again
    await storage.get('log:water');
    assert.strictEqual(server.calls.length, 4, 'second get of the same resource asks again');
  }

  // 3) a save after the prefetch discards it, so the next read is the saved value, not the old one
  {
    const { server, storage } = makePage();
    server.rows.water = { value: 'OLD', updated_at: 'T1' };
    storage.prefetch(['log:water']);
    await storage.set('log:water', 'NEW');
    same(await storage.get('log:water'), { value: 'NEW' });
  }

  // 4) an old prefetch is not trusted
  {
    const { ctx, server, storage } = makePage();
    server.rows.water = { value: 'A', updated_at: 'T1' };
    storage.prefetch(['log:water']);
    const real = Date.now();
    ctx.Date = { now: () => real + 60000 };
    server.rows.water = { value: 'B', updated_at: 'T2' };
    same(await storage.get('log:water'), { value: 'B' }, 'expired prefetch is dropped');
    assert.strictEqual(server.calls.length, 2);
  }

  // 5) offline: a failed prefetch behaves like a failed get (no throw, no data)
  {
    const { storage } = makePage('offline');
    storage.prefetch(['log:water']);
    assert.strictEqual(await storage.get('log:water'), null);
  }

  console.log('startup prefetch tests passed');
})().catch(e => { console.error(e); process.exit(1); });
