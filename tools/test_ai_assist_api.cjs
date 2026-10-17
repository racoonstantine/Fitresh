// api/ai_assist.php against the dev harness and a fake OpenAI server:
//   node tools/test_ai_assist_api.cjs
const assert = require('assert');
const http = require('http');
const { start } = require('./dev_harness/start.cjs');

const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]).toString('base64');
const FAKE_PNG_AS_JPEG = 'data:image/jpeg;base64,' + Buffer.from('not really a jpeg at all').toString('base64');

async function call(base, path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json, cookie: set ? set.split(';')[0] : null };
}

async function login(base, password) {
  const r = await call(base, '/api/auth.php?action=login', { method: 'POST', body: { email: 'tester@example.com', password } });
  assert.strictEqual(r.status, 200);
  return r.cookie;
}

(async () => {
  // Fake OpenAI: records what it was sent; answers 200 unless told to fail.
  const seen = [];
  let failNext = false;
  const fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
      if (failNext) { failNext = false; res.writeHead(500); return res.end('{"error":"boom"}'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'Food: Rice\nCalories: 200 kcal\n' } }] }));
    });
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  const fakeBase = `http://127.0.0.1:${fake.address().port}/v1`;

  // 1) Not configured: users see no AI button, and POST is refused.
  let h = await start({ port: 8180 + Math.floor(Math.random() * 40) });
  try {
    assert.strictEqual((await call(h.url, '/api/ai_assist.php')).status, 401, 'needs login');
    let cookie = await login(h.url, h.password);
    assert.deepStrictEqual((await call(h.url, '/api/ai_assist.php', { cookie })).json, { enabled: false });
    const r = await call(h.url, '/api/ai_assist.php', { method: 'POST', cookie, body: { prompt: 'hi' } });
    assert.strictEqual(r.status, 503);
  } finally { h.stop(); }

  // 2) Configured with a fake OpenAI and a daily limit of 3.
  process.env.HARNESS_OPENAI_BASE_URL = fakeBase;
  process.env.HARNESS_AI_DAILY_LIMIT = '3';
  h = await start({ port: 8230 + Math.floor(Math.random() * 40) });
  try {
    const cookie = await login(h.url, h.password);
    const ask = body => call(h.url, '/api/ai_assist.php', { method: 'POST', cookie, body });
    assert.deepStrictEqual((await call(h.url, '/api/ai_assist.php', { cookie })).json, { enabled: true });

    assert.strictEqual((await ask({ prompt: '   ' })).status, 400, 'empty prompt');
    assert.strictEqual((await ask({ prompt: 'x'.repeat(8001) })).status, 400, 'prompt too long');
    assert.strictEqual((await ask({ prompt: 'hi', image: 'data:text/html;base64,PGI+' })).status, 400, 'non-image type');
    assert.strictEqual((await ask({ prompt: 'hi', image: FAKE_PNG_AS_JPEG })).status, 400, 'bytes must match the image type');
    assert.strictEqual(seen.length, 0, 'rejected requests never reach OpenAI');

    const ok = await ask({ prompt: 'Estimate: rice', image: JPEG });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.json.reply, 'Food: Rice\nCalories: 200 kcal');
    const sent = seen[0];
    assert.strictEqual(sent.url, '/v1/chat/completions');
    assert.strictEqual(sent.auth, 'Bearer sk-test-harness');
    assert.strictEqual(sent.body.model, 'gpt-4o-mini');
    assert.strictEqual(sent.body.store, false, 'asks OpenAI not to store the exchange');
    const parts = sent.body.messages[1].content;
    assert.strictEqual(parts[0].text, 'Estimate: rice');
    assert.strictEqual(parts[1].image_url.url, JPEG);

    failNext = true;
    assert.strictEqual((await ask({ prompt: 'again' })).status, 502, 'provider failure surfaces as 502');
    const second = await ask({ prompt: 'text only' });
    assert.strictEqual(second.status, 200, 'a failed call did not use up the allowance');
    assert.strictEqual(seen[seen.length - 1].body.messages[1].content.length, 1, 'no image part without a photo');

    // Resh's progress review: its own persona, warmer settings, text only (a photo is ignored).
    const review = await ask({ prompt: 'Review my week', kind: 'review', image: JPEG });
    assert.strictEqual(review.status, 200);
    const rsent = seen[seen.length - 1].body;
    assert.ok(rsent.messages[0].content.startsWith('You are Resh'), 'review uses the Resh system prompt');
    assert.strictEqual(rsent.temperature, 0.6);
    assert.strictEqual(rsent.messages[1].content.length, 1, 'review never carries an image');

    const third = await ask({ prompt: 'one too many' });
    assert.strictEqual(third.status, 429);
    assert.strictEqual(third.json.code, 'daily_limit');
  } finally { h.stop(); fake.close(); }
  console.log('PASS: AI Assist API (login, switched off, validation, photo pass-through, no storage flag, daily limit, provider failure).');
})().catch(e => { console.error(e); process.exit(1); });
