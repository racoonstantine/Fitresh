// Isolated, in-memory browser fixture. Never connects to a real account/database.
const http=require('node:http'),fs=require('node:fs');
const sql=fs.readFileSync('db/workout_seed.sql','utf8');
const definitions=sql.split('\n').filter(l=>l.startsWith('INSERT')).map(l=>JSON.parse(l.match(/,'(\{.*\})'\) ON/)[1].replace(/''/g,"'")));
const data={activities:definitions.filter(d=>d.category),templates:definitions.filter(d=>d.items),sessions:[]};
const server=http.createServer((req,res)=>{
 if(req.url==='/api/workouts.php'){
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET'){res.end(JSON.stringify(data));return;}
  let raw='';req.on('data',b=>raw+=b);req.on('end',()=>{const w=JSON.parse(raw);data.sessions=data.sessions.filter(s=>s.id!==w.id);if(w.action!=='delete')data.sessions.unshift({...w,source:'manual'});res.end('{"ok":true}');});return;
 }
 if(req.url==='/workouts.js'||req.url==='/workouts.css'){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript; charset=utf-8':'text/css');res.end(fs.readFileSync('public'+req.url));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--line:#d5d9d1;--paper:#fafbf8;--paper-raised:#fff;--ink:#203328;--ink-soft:#566257}body{font:15px system-ui;margin:24px auto;padding:0 16px;max-width:1000px;background:var(--paper);color:var(--ink)}.block-title{font-size:22px;font-weight:650}.timer-btn{padding:9px 14px;border:1px solid #ccd1c8;border-radius:7px;background:white}.start{background:#326c4e;color:white}.note{font-size:13px}</style><link rel="stylesheet" href="workouts.css"></head><body><h1>Workout preview — test data only</h1><section id="workoutLibrary"></section><script src="workouts.js"></script><script>workoutLibraryStart()</script></body></html>`);
});
server.listen(8766,'127.0.0.1',()=>console.log('Isolated workout preview: http://127.0.0.1:8766'));
