const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/index.html', 'utf8');
// Parse every inline script, then exercise the actual search functions with
// controlled responses; no authenticated account or live database is needed.
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
const escape = html.slice(html.indexOf('function foodSearchEscape('), html.indexOf('async function searchFoodsCombined('));
async function test(name, endMarker, prefix, statusId, resultsId, renderer) {
  const start = html.indexOf('async function '+name+'(');
  const code = html.slice(start, html.indexOf(endMarker, start));
  const elements = Object.fromEntries([statusId,resultsId].map(id=>[id,{style:{},innerHTML:'',textContent:'',querySelectorAll:()=>[]} ]));
  const context = vm.createContext({document:{getElementById:id=>elements[id]},Set,console});
  context[prefix+'Generation']=0;context[prefix+'ResultsCache']=[];
  context[renderer]=()=>{};
  context.fetch=async url=>({json:async()=>url.includes('food_catalog')?{results:[],suggestions:['sayote']}:{results:[]}});
  vm.runInContext(escape+code,context);
  await context[name]('sayotte');
  assert.match(elements[statusId].innerHTML,/Did you mean.*sayote/);
  assert.equal(context[prefix+'ResultsCache'].length,0,'Suggestion must not select a food');
  context.fetch=async url=>({json:async()=>url.includes('food_catalog')?{results:[{name:'Chayote',external_id:'v:FC000075',nutrients:{ENERC_KCAL:20}}]}:{results:[]}});
  await context[name]('sayote');
  assert.equal(context[prefix+'ResultsCache'][0].name,'Chayote');
  assert.match(elements[statusId].innerHTML,/preparation and edible part/);
  await context[name]('');
  assert.equal(context[prefix+'ResultsCache'].length,0);
  assert.equal(elements[statusId].style.display,'none');
  let release;
  context.fetch=async url=>{
    const q = new URL(url,'http://localhost').searchParams.get('q');
    if(url.includes('food_catalog') && q==='oldquery') await new Promise(resolve=>release=resolve);
    return {json:async()=>({results:url.includes('food_catalog')?[{name:q,external_id:q,nutrients:{ENERC_KCAL:20}}]:[]})};
  };
  const old=context[name]('oldquery');
  await context[name]('newquery');
  release();await old;
  assert.equal(context[prefix+'ResultsCache'][0].name,'newquery','Stale responses must not replace current results');
  assert.equal(context.foodSearchEscape('<script>'), '&lt;script&gt;');
  const optId=name==='lmSearchFoods'?'lmIncludeEstimates':'foodIncludeEstimates';
  elements[optId]={checked:false};
  const estimated={name:'KFC (estimate)',label:'Estimated',external_id:'v:FC002260',nutrients:{ENERC_KCAL:269}};
  context.fetch=async url=>({json:async()=>url.includes('food_catalog')?{results:url.includes('include_estimates=1')?[estimated]:[]}:url.includes('search_library')?{results:[estimated]}:{results:[]}});
  await context[name]('kfc');assert.equal(context[prefix+'ResultsCache'].length,0,'Default search hides saved estimates too');
  elements[optId].checked=true;
  await context[name]('kfc');assert.ok(context[prefix+'ResultsCache'].some(r=>r.label==='Estimated'),'Opt-in request includes estimates');
  elements[optId].checked=false;
  await context[name]('kfc');assert.equal(context[prefix+'ResultsCache'].length,0,'Unchecking removes estimates');
}
(async()=>{
  await test('searchFoodsCombined','// Scales a result', 'foodSearch','foodSearchStatus','foodSearchResults','renderFoodSearchResults');
  await test('lmSearchFoods','  function renderLmSearchResults', 'lmSearch','lmSearchStatus','lmSearchResults','renderLmSearchResults');
  console.log('PASS: frontend syntax and both search flows: suggestions, explicit choices, clearing, escaping, and stale-response protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
