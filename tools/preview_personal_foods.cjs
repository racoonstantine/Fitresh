// Isolated UI fixture, with in-memory data only. No production account or database.
const http=require('node:http'),fs=require('node:fs');let foods=[],nextId=1;
http.createServer((req,res)=>{
 if(req.url==='/api/personal_foods.php'){
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET'){res.end(JSON.stringify({csrf_token:'fixture',foods}));return;}
  let raw='';req.on('data',b=>raw+=b);req.on('end',()=>{const d=JSON.parse(raw),old=foods.find(f=>f.food_id===d.previous_food_id);const food={food_id:nextId++,root_food_id:old?.root_food_id||nextId-1,revision:(old?.revision||0)+1,is_current:true,definition:d,submission_status:d.submit_for_review?'pending':'private'};foods=foods.filter(f=>f.food_id!==d.previous_food_id);foods.unshift(food);res.end(JSON.stringify({food}));});return;
 }
 if(['/personal-foods.js','/personal-foods.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript; charset=utf-8':'text/css');res.end(fs.readFileSync('public'+req.url));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="personal-foods.css"><style>:root{--paper:#fafbf8;--ink:#243228;--ink-soft:#55635b;--line:#d1d8d1}body{font:15px system-ui;background:var(--paper);margin:24px}.timer-btn{padding:9px;border:1px solid #bbb;border-radius:6px;background:white}.start{background:#326c4e;color:white}</style></head><body><h1>Personal foods — isolated test fixture</h1><div><input id="foodSearchInput" placeholder="Food search"></div><script src="personal-foods.js"></script></body></html>`);
}).listen(8781,'127.0.0.1',()=>console.log('Personal foods fixture: http://127.0.0.1:8781'));
