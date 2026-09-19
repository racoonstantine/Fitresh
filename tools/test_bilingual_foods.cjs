const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./app_source.cjs')();
const start=html.indexOf('function foodDisplayName(');
const end=html.indexOf('// ============================================================================',start);
const ctx=vm.createContext({});vm.runInContext(html.slice(start,end),ctx);
assert.equal(ctx.foodDisplayName({name:'Chayote fruit, boiled',local_name:'Sayote bunga, nilaga'}),'Sayote bunga, nilaga · Chayote fruit, boiled');
assert.equal(ctx.foodDisplayName({name:'Cabbage, green',local_name:'Repolyo, berde'}),'Repolyo, berde · Cabbage, green');
assert.equal(ctx.foodDisplayName({name:'My food'}),'My food');
assert.equal(ctx.foodDisplayName({name:'Okra',local_name:'okra'}),'Okra');
assert.equal(ctx.foodSearchEscape(ctx.foodDisplayName({name:'<img>',local_name:'<script>'})),'&lt;script&gt; · &lt;img&gt;');
// Both result screens render rows through the one shared, escaping template.
assert.equal((html.match(/foodSearchEscape\(foodDisplayName\(r\)\)/g)||[]).length,1);
assert.equal((html.match(/return foodResultRowHtml\(r, i,/g)||[]).length,2);
const active=JSON.parse(fs.readFileSync('api/catalog-active.json','utf8')).version;
const before=JSON.parse(fs.readFileSync('api/catalog-history/09af77faeebeea1e07575de4.json','utf8')).foods;
const after=JSON.parse(fs.readFileSync(`api/catalog-history/${active}.json`,'utf8')).foods;
for(const id of Object.keys(before))assert.ok(after[id],`${id}: baseline record removed`);
for(const id of Object.keys(before)){
  const row=after[id];
  for(const field of ['name','nutrients','nutrient_provenance','portions','confidence'])assert.deepEqual(row[field],before[id][field],`${id}: ${field} changed`);
  for(const alias of before[id].aliases)assert.ok(row.aliases.includes(alias));
}
const sayote=Object.values(after).filter(r=>r.local_name?.startsWith('Sayote'));
assert.ok(sayote.some(r=>r.local_name.includes('nilaga') && r.name.includes('boiled')));
assert.ok(sayote.some(r=>!r.name.includes('boiled')));
assert.ok(Object.values(after).some(r=>r.name==='Cabbage, green' && r.aliases.includes('Repolyo')));
console.log('PASS: bilingual labels, escaping, both result screens, preparation distinctions, additive aliases and unchanged nutrition/portions for all 2514 search records.');
