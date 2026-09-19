// Dev harness: real api/*.php on a throwaway SQLite DB with fixture data, plus
// the repo's live public/ folder, on http://127.0.0.1:<port>.
//   node tools/dev_harness/start.cjs [--port 8124]
// Fresh temp copy every start; Ctrl+C kills php and deletes it.
// Accounts (password testpass123): tester@example.com (fixture data),
// other@example.com (empty), admin@example.com (admin).
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');

async function start({ port = 8124 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-harness-'));
  const setup = spawnSync('php', [path.join(__dirname, 'setup.php'), repo, tmp], { encoding: 'utf8' });
  if (setup.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error('harness setup failed:\n' + setup.stderr + setup.stdout);
  }
  const info = JSON.parse(setup.stdout.trim().split('\n').pop());
  const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(repo, 'public'), path.join(__dirname, 'router.php')], {
    env: { ...process.env, HARNESS_API_DIR: path.join(tmp, 'api') },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(url + '/index.html'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    php.kill();
    // php.exe on Windows may hold the sqlite file briefly.
    setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }, 300);
  };
  return { url, tmp, stop, ...info };
}

module.exports = { start };

if (require.main === module) {
  const i = process.argv.indexOf('--port');
  start({ port: i > -1 ? Number(process.argv[i + 1]) : 8124 }).then(h => {
    console.log(`Harness running at ${h.url}\n  tester@example.com / ${h.password} (fixture data)\n  other@example.com  (empty)   admin@example.com (admin)\nCtrl+C to stop and clean up.`);
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { h.stop(); setTimeout(() => process.exit(0), 400); });
  }).catch(e => { console.error(e.message); process.exit(1); });
}
