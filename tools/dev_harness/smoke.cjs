// API smoke test against the dev harness (real api/*.php on SQLite + fixtures).
//   node tools/dev_harness/smoke.cjs
// Starts its own harness on a spare port, runs login/data/food/meal/workout/
// personal-food/ownership checks, then tears everything down.
const assert = require('assert');
const { start } = require('./start.cjs');

let cookie = '';
async function call(base, path, { method = 'GET', body, headers = {}, as } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(as ?? cookie ? { Cookie: as ?? cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const set = res.headers.get('set-cookie');
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json, text, cookie: set ? set.split(';')[0] : null };
}

(async () => {
  const h = await start({ port: 8130 + Math.floor(Math.random() * 50) });
  const step = [];
  const check = (name, fn) => step.push([name, fn]);
  const b = h.url;
  const today = new Date().toISOString().slice(0, 10);
  let other = '';

  check('unauthenticated data call is 401', async () => {
    assert.strictEqual((await call(b, '/api/data.php?resource=profile')).status, 401);
  });
  check('wrong password is rejected', async () => {
    const r = await call(b, '/api/auth.php?action=login', { method: 'POST', body: { email: 'tester@example.com', password: 'nope' } });
    assert.strictEqual(r.status, 401);
  });
  check('login as tester', async () => {
    const r = await call(b, '/api/auth.php?action=login', { method: 'POST', body: { email: 'tester@example.com', password: h.password } });
    assert.strictEqual(r.status, 200, r.text);
    cookie = r.cookie;
    assert.strictEqual(r.json.username, 'tester');
  });
  check('all fixture resources load', async () => {
    for (const k of ['profile', 'weighins', 'nutrition', 'water', 'steps', 'sleep', 'history', 'fasting', 'trainingPlan']) {
      const r = await call(b, `/api/data.php?resource=${k}`);
      assert.ok(r.json && r.json.value, `${k} missing`);
      JSON.parse(r.json.value);
    }
  });
  check('data upsert (ON DUPLICATE KEY path) overwrites', async () => {
    for (const ml of [250, 500]) {
      const r = await call(b, '/api/data.php', { method: 'POST', body: { resource: 'water', value: JSON.stringify({ [today]: ml }) } });
      assert.strictEqual(r.status, 200, r.text);
    }
    const v = JSON.parse((await call(b, '/api/data.php?resource=water')).json.value);
    assert.strictEqual(v[today], 500);
  });
  check('non-JSON POST is rejected (CSRF guard)', async () => {
    const res = await fetch(b + '/api/data.php', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'text/plain' }, body: '{}' });
    assert.strictEqual(res.status, 415);
  });
  let catalogFood;
  check('catalog search finds adobo', async () => {
    const r = await call(b, '/api/food_catalog.php?q=adobo');
    assert.ok(r.json.results.length > 0, r.text.slice(0, 200));
    catalogFood = r.json.results[0];
  });
  check('save catalog food + log a meal + read the day back', async () => {
    const f = catalogFood;
    const save = await call(b, '/api/foods.php?action=save_external', { method: 'POST', body: { source: 'catalog', external_id: f.external_id, name: f.name, brand: f.brand, canonical_unit: f.canonical_unit, canonical_amount: f.canonical_amount, nutrients: f.nutrients } });
    assert.ok(save.json && save.json.id, save.text.slice(0, 300));
    const log = await call(b, '/api/meals.php?action=log', { method: 'POST', body: { date: today, meal_type: 'lunch', component: { food_id: save.json.id, amount: 150, unit: 'g' } } });
    assert.strictEqual(log.status, 200, log.text.slice(0, 300));
    // same date+type must reuse the entry (the <=> null-safe compare path)
    const log2 = await call(b, '/api/meals.php?action=log', { method: 'POST', body: { date: today, meal_type: 'lunch', component: { food_id: save.json.id, amount: 50, unit: 'g' } } });
    assert.strictEqual(log2.status, 200, log2.text.slice(0, 300));
    const day = await call(b, `/api/meals.php?action=day&date=${today}`);
    assert.strictEqual(day.json.entries.length, 1, 'two logs under one meal type should group');
    assert.strictEqual(day.json.entries[0].components.length, 2);
    assert.strictEqual(day.json.entries[0].components[0].food_source, 'catalog', 'logged components report how the food was made');
    assert.ok(day.json.totals.ENERC_KCAL > 0);
    const range = await call(b, `/api/meals.php?action=range_totals&start=${today}&end=${today}`);
    assert.strictEqual(range.status, 200);
  });
  check('custom food create + origin tags + Favorites grouping (my_foods)', async () => {
    const make = (name, origin) => call(b, '/api/foods.php?action=create_custom', { method: 'POST', body: { name, origin, canonical_amount: 50, canonical_unit: 'g', nutrients: { ENERC_KCAL: 200, PROCNT: 10, FAT: 8, CHOCDF: 20 } } });
    const plain = await make('Smoke Bar', undefined);
    assert.ok(plain.json && plain.json.id, plain.text.slice(0, 300));
    assert.equal(plain.json.source, 'custom');
    assert.equal((await make('Smoke Manual', 'manual')).json.source, 'manual');
    assert.equal((await make('Smoke AI', 'ai')).json.source, 'ai');
    assert.equal((await make('Smoke Bogus', 'admin')).json.source, 'custom', 'unknown origins fall back to custom');
    const mine = await call(b, '/api/foods.php?action=my_foods');
    assert.strictEqual(mine.status, 200, mine.text.slice(0, 200));
    const names = g => mine.json.groups[g].map(f => f.name);
    assert.ok(names('ai').includes('Smoke AI') && !names('manual').includes('Smoke AI'));
    assert.ok(names('manual').includes('Smoke Manual') && names('manual').includes('Smoke Bar'), 'old custom rows count as manual');
    assert.ok(mine.json.groups.manual[0].nutrients.ENERC_KCAL > 0, 'nutrients included');
  });
  let personalId;
  check('personal food save + retry idempotency + list', async () => {
    const g = await call(b, '/api/personal_foods.php');
    const csrf = g.json.csrf_token;
    const input = { name: 'Smoke Whey', brand: '', serving_label: '1 scoop', serving_measure: 'g', serving_size: 30, source_url: '', notes: '', nutrients: { ENERC_KCAL: 120, PROCNT: 24, CHOCDF: 3, FAT: 1 }, request_key: '11111111-1111-4111-8111-111111111111', submit_for_review: false };
    const noCsrf = await call(b, '/api/personal_foods.php', { method: 'POST', body: input });
    assert.strictEqual(noCsrf.status, 403);
    const a = await call(b, '/api/personal_foods.php', { method: 'POST', body: input, headers: { 'X-CSRF-Token': csrf } });
    assert.strictEqual(a.status, 200, a.text.slice(0, 300));
    personalId = a.json.food.food_id;
    const again = await call(b, '/api/personal_foods.php', { method: 'POST', body: input, headers: { 'X-CSRF-Token': csrf } });
    assert.strictEqual(again.json.food.food_id, personalId);
    const list = await call(b, '/api/personal_foods.php');
    assert.ok(list.json.foods.some(f => f.food_id === personalId));
    const mine = await call(b, '/api/foods.php?action=my_foods');
    assert.ok(mine.json.groups.personal.some(f => f.name === 'Smoke Whey'), 'personal food is in the Custom foods group');
  });
  let sessionId = '22222222-2222-4222-8222-222222222222';
  check('workout library loads and a session saves/lists/deletes', async () => {
    const lib = await call(b, '/api/workouts.php');
    assert.ok(lib.json.activities.length >= 100 && lib.json.templates.length > 0);
    const act = lib.json.activities.find(a => a.category === 'strength');
    const save = await call(b, '/api/workouts.php', { method: 'POST', body: { action: 'save', id: sessionId, date: today, title: 'Smoke session', style: 'straight', notes: '', timezone: 'UTC', items: [{ activityId: act.id, metrics: {}, sets: [{ reps: 10, weightKg: 20, durationSeconds: null }] }] } });
    assert.strictEqual(save.status, 200, save.text.slice(0, 300));
    // re-save same id (ON DUPLICATE KEY UPDATE id=id + FOR UPDATE path)
    const again = await call(b, '/api/workouts.php', { method: 'POST', body: { action: 'save', id: sessionId, date: today, title: 'Smoke session v2', style: 'straight', notes: 'x', timezone: 'UTC', items: [{ activityId: act.id, metrics: {}, sets: [{ reps: 8, weightKg: 22, durationSeconds: null }] }] } });
    assert.strictEqual(again.status, 200, again.text.slice(0, 300));
    const after = await call(b, '/api/workouts.php');
    const s = after.json.sessions.find(x => x.id === sessionId);
    assert.ok(s && s.title === 'Smoke session v2' && s.items[0].sets[0].reps === 8);
    const del = await call(b, '/api/workouts.php', { method: 'POST', body: { action: 'delete', id: sessionId } });
    assert.strictEqual(del.status, 200);
  });
  check('another user cannot see or touch tester data', async () => {
    const r = await call(b, '/api/auth.php?action=login', { method: 'POST', body: { email: 'other@example.com', password: h.password }, as: '' });
    assert.strictEqual(r.status, 200);
    other = r.cookie;
    const prof = await call(b, '/api/data.php?resource=profile', { as: other });
    assert.strictEqual(prof.json.value, null);
    const pf = await call(b, '/api/personal_foods.php', { as: other });
    assert.ok(!pf.json.foods.some(f => f.food_id === personalId));
    const w = await call(b, '/api/workouts.php', { as: other });
    assert.ok(!w.json.sessions.length);
    const theirs = await call(b, '/api/foods.php?action=my_foods', { as: other });
    assert.ok(Object.values(theirs.json.groups).every(list => list.length === 0), 'my_foods only returns your own foods');
  });
  check('signup lands pending and cannot log in', async () => {
    const r = await call(b, '/api/auth.php?action=register', { method: 'POST', body: { email: 'new@example.com', password: 'longenough1', display_name: 'New' }, as: '' });
    assert.strictEqual(r.status, 200, r.text.slice(0, 200));
    assert.ok(r.json.pending);
    const l = await call(b, '/api/auth.php?action=login', { method: 'POST', body: { email: 'new@example.com', password: 'longenough1' }, as: '' });
    assert.strictEqual(l.status, 403);
  });
  check('password reset request (DATE_ADD path)', async () => {
    const r = await call(b, '/api/auth.php?action=request_password_reset', { method: 'POST', body: { email: 'other@example.com' }, as: '' });
    assert.ok(r.status === 200, r.text.slice(0, 200));
  });
  check('admin can list users; regular user cannot', async () => {
    const a = await call(b, '/api/auth.php?action=login', { method: 'POST', body: { email: 'admin@example.com', password: h.password }, as: '' });
    const list = await call(b, '/api/admin.php?action=overview', { as: a.cookie });
    assert.strictEqual(list.status, 200, list.text.slice(0, 200));
    const denied = await call(b, '/api/admin.php?action=overview');
    assert.ok(denied.status === 403 || denied.status === 401, 'status ' + denied.status);
  });

  check('food review: opt-in sharing, candidates for the admin, cron digest, decisions', async () => {
    const { spawnSync } = require('child_process');
    const login = async email => (await call(b, '/api/auth.php?action=login', { method: 'POST', body: { email, password: h.password }, as: '' })).cookie;
    const cookies = { tester: await login('tester@example.com'), other: await login('other@example.com'), admin: await login('admin@example.com') };
    // 'sharing' is an accepted per-user setting; each user makes the same dish with a slightly different value
    let i = 0;
    for (const who of ['tester', 'other', 'admin']) {
      const set = await call(b, '/api/data.php', { method: 'POST', as: cookies[who], body: { resource: 'sharing', value: JSON.stringify({ foods: true }) } });
      assert.strictEqual(set.status, 200, set.text);
      const made = await call(b, '/api/foods.php?action=create_custom', { method: 'POST', as: cookies[who], body: { name: 'Review Adobo Bowl', origin: i % 2 ? 'manual' : 'ai', canonical_amount: 150, canonical_unit: 'g', nutrients: { ENERC_KCAL: 300 + i * 15, PROCNT: 20, FAT: 10, CHOCDF: 30 } } });
      assert.ok(made.json && made.json.id, made.text);
      i++;
    }
    // only the admin may read the review
    assert.strictEqual((await call(b, '/api/food_review.php?action=candidates', { as: cookies.tester })).status, 403);
    const list = await call(b, '/api/food_review.php?action=candidates', { as: cookies.admin });
    assert.strictEqual(list.status, 200, list.text);
    assert.strictEqual(list.json.available, true);
    const cand = list.json.candidates.find(c => c.name === 'Review Adobo Bowl');
    assert.ok(cand, 'three users made it, so it is a candidate');
    assert.strictEqual(cand.users, 3);
    assert.strictEqual(cand.basis, 'per 100 g');
    assert.strictEqual(cand.nutrients.ENERC_KCAL.median, 210, '315 kcal per 150 g -> 210 per 100 g median');
    assert.ok(!JSON.stringify(list.json).includes('@example.com'), 'no user identifiers in the review');
    // the cron script (CLI only) prints the digest in --dry-run and records nothing
    const dry = spawnSync('php', [require('path').join(h.tmp, 'api', 'food_review_digest.php'), '--dry-run'], { encoding: 'utf8' });
    assert.strictEqual(dry.status, 0, dry.stderr);
    assert.ok(dry.stdout.includes('Review Adobo Bowl') && dry.stdout.includes('Nothing is published automatically'), dry.stdout.slice(0, 300));
    assert.strictEqual((await call(b, '/api/food_review_digest.php', { as: cookies.admin })).status, 403, 'not runnable over HTTP');
    // decide: hidden afterwards; bad input rejected
    assert.strictEqual((await call(b, '/api/food_review.php', { method: 'POST', as: cookies.admin, body: { action: 'decide', norm_key: cand.key, unit_kind: 'g', decision: 'nope' } })).status, 400);
    const decided = await call(b, '/api/food_review.php', { method: 'POST', as: cookies.admin, body: { action: 'decide', norm_key: cand.key, unit_kind: 'g', decision: 'reviewed' } });
    assert.strictEqual(decided.status, 200, decided.text);
    const after = await call(b, '/api/food_review.php?action=candidates', { as: cookies.admin });
    assert.ok(!after.json.candidates.some(c => c.name === 'Review Adobo Bowl'), 'reviewed candidates disappear');
    // opting out removes a user's vote
    assert.strictEqual((await call(b, '/api/data.php', { method: 'POST', as: cookies.other, body: { resource: 'sharing', value: JSON.stringify({ foods: false }) } })).status, 200);
  });

  let failed = 0;
  try {
    for (const [name, fn] of step) {
      try { await fn(); console.log('  ok   ' + name); }
      catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n')[0]); }
    }
  } finally { h.stop(); }
  if (failed) { console.log(`\n${failed} of ${step.length} smoke checks failed`); process.exit(1); }
  console.log(`\nPASS: ${step.length} harness smoke checks (auth, data store, catalog, meals, workouts, personal foods, ownership, admin).`);
  setTimeout(() => process.exit(0), 500);
})().catch(e => { console.error(e); process.exit(1); });
