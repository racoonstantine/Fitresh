const vm = require('node:vm'), assert = require('node:assert/strict'), fs = require('node:fs');
const src = fs.readFileSync('public/js/ai-native.js', 'utf8').split('\r\n').join('\n');
const start = src.indexOf('const aiNativePhotoCache');
const end = src.indexOf('// ---- Photo control');
assert.ok(start > 0 && end > start, 'photo prep section not found');

let shrinks = 0, failNext = false;
const ctx = vm.createContext({
  AI_MAX_PHOTOS: 5, WeakMap, Promise, setTimeout, clearTimeout, AbortController,
  aiPhotoDefaultNote: () => '',
  safeFetchJson: async () => ({ ok: true, status: 200, data: { reply: 'ok' } }),
  handleUnauthorized() {}, navigator: { onLine: true }
});
// Stand in for the canvas work: count calls, optionally fail once.
vm.runInContext(src.slice(start, end).replace(/async function aiNativePhotoShrink[\s\S]*?\n}\n/, `
async function aiNativePhotoShrink(file){ shrinks++; if(failNext){ failNext = false; throw new Error('decode'); } return 'data:image/jpeg;base64,' + file.name; }
`), ctx);
ctx.shrinks = 0;
vm.runInContext('var shrinks = 0, failNext = false;', ctx);

(async () => {
  const a = { name: 'a' }, b = { name: 'b' };
  // Shrinking at pick time is reused at send time: one decode per file.
  const first = await ctx.aiNativePhotoDataUrl(a);
  const again = await ctx.aiNativePhotoDataUrl(a);
  assert.equal(first, again);
  assert.equal(vm.runInContext('shrinks', ctx), 1, 'same file is shrunk once');
  await ctx.aiNativePhotoDataUrl(b);
  assert.equal(vm.runInContext('shrinks', ctx), 2, 'a different file is shrunk separately');

  // A failed decode is not cached, so sending retries it.
  const c = { name: 'c' };
  vm.runInContext('failNext = true', ctx);
  await assert.rejects(ctx.aiNativePhotoDataUrl(c));
  assert.equal(await ctx.aiNativePhotoDataUrl(c), 'data:image/jpeg;base64,c');

  // Stages: text-only goes straight to 'ask'; photos report 'photos' first.
  const seen = [];
  await ctx.aiNativeAsk('hi', [], undefined, undefined, s => seen.push(s));
  assert.deepEqual(JSON.parse(JSON.stringify(seen)), ['ask']);
  seen.length = 0;
  await ctx.aiNativeAsk('hi', [a], undefined, undefined, s => seen.push(s));
  assert.deepEqual(JSON.parse(JSON.stringify(seen)), ['photos', 'ask']);
  // onStage is optional.
  assert.equal(await ctx.aiNativeAsk('hi', [], undefined), 'ok');
  console.log('ai photo prep tests passed');
})().catch(e => { console.error(e); process.exit(1); });
