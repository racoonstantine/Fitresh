/* Separate session store: legacy checkmarks/history remain untouched. */
(() => {
 'use strict';
 const root=document.getElementById('workoutLibrary');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let catalog=[],templates=[],sessions=[],draft=null,busy=false;
 const $=id=>document.getElementById(id);
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const blank=()=>({id:crypto.randomUUID(),date:today(),title:'My workout',style:'straight',notes:'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,items:[]});
 const number=v=>v===''?null:Number(v);
 const unit=()=> $('wlUnit').value;
 const status=s=>{$('wlStatus').textContent=s;};
 async function api(body){
  const r=await fetch('api/workouts.php',{credentials:'same-origin',signal:AbortSignal.timeout(15000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to load workouts');return data;
 }
 function stats(item){
  const sets=item.sets||[];
  const volume=sets.reduce((sum,s)=>sum+(Number(s.reps)||0)*(Number(s.weightKg)||0),0);
  const m=item.metrics||{};
  const parts=[];
  if(sets.length)parts.push(`${sets.length} sets`);
  if(volume)parts.push(`${Math.round(volume*100)/100} kg recorded volume`);
  if(m.durationSeconds)parts.push(`${Math.round(m.durationSeconds/60*10)/10} min`);
  if(m.distanceKm!=null)parts.push(`${m.distanceKm} km`);
  if(m.calories!=null)parts.push(`${m.calories} kcal entered`);
  if(m.avgHr!=null)parts.push(`${m.avgHr} bpm average`);
  if(m.effort!=null)parts.push(`effort ${m.effort}/10`);
  if(m.durationSeconds && m.distanceKm>0){const sec=Math.round(m.durationSeconds/m.distanceKm);parts.push(`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')} /km`);}
  return parts.join(' · ');
 }
 function library(){
  const q=$('wlSearch').value.trim().toLowerCase(),cat=$('wlCategory').value;
  const matches=catalog.filter(a=>(!cat||a.category===cat)&&`${a.name} ${a.focus} ${a.equipment}`.toLowerCase().includes(q));
  $('wlResults').innerHTML=matches.map(a=>`<article class="wl-card"><strong>${esc(a.name)}</strong><p>${esc(a.category)} · ${esc(a.focus)}</p><p>${esc(a.equipment)}</p><details><summary>Details</summary><p>${esc(a.instructions)}</p><p>${esc(a.loadConvention)}</p></details><button type="button" class="timer-btn" data-add="${esc(a.id)}">+ Add activity</button></article>`).join('')||'<p>No activities match your search.</p>';
 }
 function field(label,key,value,type='number',extra='') {return `<label>${esc(label)}<input type="${type}" data-field="${key}" value="${esc(value)}" ${extra}></label>`;}
 function editor(){
  $('wlTitle').value=draft.title;$('wlDate').value=draft.date;$('wlStyle').value=draft.style;$('wlNotes').value=draft.notes;
  $('wlItems').innerHTML=draft.items.map((item,i)=>{
   const a=item.snapshot;const load=a.tracking==='load',hold=a.tracking==='hold',session=a.tracking==='session';
   const rows=session?`<div class="wl-grid" data-metrics>${field('Duration (minutes)','minutes',item.metrics.durationSeconds==null?'':item.metrics.durationSeconds/60,'number','min="0.01" step="any" required')}${field('Distance (km), optional','distanceKm',item.metrics.distanceKm,'number','min="0" step="any"')}${field('Calories, optional','calories',item.metrics.calories,'number','min="0" step="any"')}${field('Average heart rate, optional','avgHr',item.metrics.avgHr,'number','min="20" max="300" step="any"')}${field('Effort (1–10), optional','effort',item.metrics.effort,'number','min="1" max="10" step="any"')}</div>`:item.sets.map((s,j)=>`<div class="wl-set" data-set="${j}"><span>Set ${j+1}</span>${hold?field('Seconds','durationSeconds',s.durationSeconds,'number','min="1" step="1" required'):field('Reps','reps',s.reps,'number','min="1" step="1" required')}${load?field(`Total load (${unit()})`,'weight',s.weightKg==null?'':+(s.weightKg*(unit()==='lb'?2.2046226218:1)).toFixed(3),'number','min="0" step="any" required'):''}<button type="button" class="timer-btn" data-remove-set="${j}" aria-label="Remove set ${j+1}">Remove</button></div>`).join('');
   return `<article class="wl-card" data-item="${i}"><strong>${esc(a.name)}</strong>${item.target?`<p>Template target: ${esc(item.target)}</p>`:''}<p>${esc(a.loadConvention)}</p>${rows}<div class="wl-actions">${session?'':'<button type="button" class="timer-btn" data-add-set>Add set</button>'}<button type="button" class="timer-btn" data-remove-item>Remove activity</button></div></article>`;
  }).join('')||'<p class="note">Choose an activity above or load a starter template.</p>';
 }
 function capture(){
  draft.title=$('wlTitle').value;draft.date=$('wlDate').value;draft.style=$('wlStyle').value;draft.notes=$('wlNotes').value;
  root.querySelectorAll('[data-item]').forEach(card=>{
   const item=draft.items[Number(card.dataset.item)];
   card.querySelectorAll('[data-set]').forEach(row=>{const s=item.sets[Number(row.dataset.set)];row.querySelectorAll('[data-field]').forEach(input=>{const v=number(input.value);if(input.dataset.field==='weight'){if(input.value!==input.defaultValue)s.weightKg=v===null?null:v/(unit()==='lb'?2.2046226218:1);}else s[input.dataset.field]=v;});});
   card.querySelectorAll('[data-metrics] [data-field]').forEach(input=>{const v=number(input.value);item.metrics[input.dataset.field==='minutes'?'durationSeconds':input.dataset.field]=input.dataset.field==='minutes'&&v!==null?v*60:v;});
  });
 }
 const emptySet=()=>({reps:null,weightKg:null,durationSeconds:null});
 function add(id,target='',setCount=1){const a=catalog.find(a=>a.id===id);if(!a)return;draft.items.push({activityId:id,snapshot:a,target,metrics:{},sets:a.tracking==='session'?[]:Array.from({length:setCount},emptySet)});}
 function history(){
  $('wlHistory').innerHTML=sessions.map(s=>`<article class="wl-card"><strong>${esc(s.date)} · ${esc(s.title)}</strong><p>${esc(s.style)} · ${esc(s.source||'manual')}</p>${s.items.map(i=>`<p><strong>${esc(i.snapshot.name)}</strong> — ${esc(stats(i))}</p>`).join('')}<p>${esc(s.notes)}</p><div class="wl-actions"><button type="button" class="timer-btn" data-edit="${esc(s.id)}">Edit</button><button type="button" class="timer-btn" data-delete="${esc(s.id)}">Delete</button></div></article>`).join('')||'<p>No sessions logged here yet. Your previous entries remain in Workout History Log below.</p>';
 }
 async function refresh(){const data=await api();catalog=data.activities;templates=data.templates;sessions=data.sessions;library();history();$('wlTemplate').innerHTML='<option value="">Choose a starter template</option>'+templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');}
 root.innerHTML=`<div class="block-title">Exercise & activity library</div><p class="note">Build a session with strength, cardio, mobility, or sports. Log what you actually completed.</p><div class="wl-grid"><label>Search by activity, focus, or equipment<input id="wlSearch" type="search" placeholder="Try shoulders or pickleball"></label><label>Category<select id="wlCategory"><option value="">All activities</option><option value="strength">Strength</option><option value="cardio">Cardio</option><option value="mobility">Mobility</option><option value="sport">Sports</option></select></label></div><div id="wlStatus" role="status" aria-live="polite"></div><button type="button" id="wlRetry" class="timer-btn">Refresh library</button><div id="wlResults" class="wl-list"></div><form id="wlForm"><fieldset id="wlEditor" style="border:0;padding:0;min-width:0"><legend class="block-title">Log a session</legend><div class="wl-actions"><select id="wlTemplate" aria-label="Starter template"></select><button type="button" id="wlLoad" class="timer-btn">Load template</button></div><div class="wl-grid"><label>Session title<input id="wlTitle" required maxlength="140"></label><label>Date<input id="wlDate" type="date" required></label><label>Style<select id="wlStyle"><option value="straight">Straight sets</option><option value="superset">Superset</option><option value="circuit">Circuit</option><option value="interval">Intervals</option><option value="steady">Steady cardio</option><option value="sport">Sports session</option></select></label><label>Weight unit<select id="wlUnit"><option value="kg">kg</option><option value="lb">lb</option></select></label></div><div id="wlItems"></div><label>Session notes<textarea id="wlNotes" maxlength="4000" rows="2" placeholder="For example: doubles pickleball, or circuit order and rest periods"></textarea></label><div class="wl-actions"><button class="timer-btn start" type="submit">Save session</button><button class="timer-btn" type="button" id="wlNew">New / cancel edit</button></div></fieldset></form><details open><summary>Recent sessions (latest 200)</summary><div id="wlHistory" class="wl-grid"></div></details>`;
 draft=blank();editor();
 $('wlSearch').addEventListener('input',library);$('wlCategory').addEventListener('change',library);
 // Capture in the old unit before redrawing in the new one.
 let previousUnit='kg';$('wlUnit').addEventListener('change',()=>{const next=unit();$('wlUnit').value=previousUnit;capture();$('wlUnit').value=next;previousUnit=next;editor();});
 root.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||busy)return;
  try {
   if(b.id==='wlRetry'){await refresh();status('Library refreshed.');return;}
   if(b.dataset.edit){const s=sessions.find(s=>s.id===b.dataset.edit);draft=JSON.parse(JSON.stringify(s));editor();$('wlTitle').focus();status('Editing saved session.');return;}
   if(b.dataset.delete){if(!confirm('Delete this workout session?'))return;busy=true;await api({action:'delete',id:b.dataset.delete});if(draft.id===b.dataset.delete){draft=blank();editor();}await refresh();status('Session deleted.');return;}
   capture();
   if(b.dataset.add){if(draft.items.length>=50)throw new Error('Maximum 50 activities per session.');add(b.dataset.add);editor();}
   const card=b.closest('[data-item]');if(card){const i=Number(card.dataset.item);if(b.hasAttribute('data-add-set')){if(draft.items[i].sets.length>=50)throw new Error('Maximum 50 sets per activity.');draft.items[i].sets.push(emptySet());}if(b.hasAttribute('data-remove-set'))draft.items[i].sets.splice(Number(b.dataset.removeSet),1);if(b.hasAttribute('data-remove-item'))draft.items.splice(i,1);editor();}
   if(b.id==='wlNew'){if(draft.items.length&&!confirm('Discard the current draft and start a new session?'))return;draft=blank();editor();status('New session.');}
   if(b.id==='wlLoad'){const t=templates.find(t=>t.id===$('wlTemplate').value);if(!t)return;if(draft.items.length&&!confirm('Replace the current draft with this template?'))return;draft=blank();draft.title=t.name;draft.style=t.style;t.items.forEach(i=>add(i.activityId,i.target,i.setCount));editor();status('Template loaded. Enter your completed reps and loads.');}
  } catch(err){status(err.message);}finally{busy=false;}
 });
 $('wlForm').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;capture();if(!draft.items.length){status('Add an activity before saving.');return;}
  busy=true;$('wlEditor').disabled=true;
  try{
   await api(draft);draft=blank();editor();
   try{await refresh();status('Session saved.');}catch(err){status('Session saved, but history could not refresh. Use Refresh library to try again.');}
  }catch(err){status(err.message);}finally{busy=false;$('wlEditor').disabled=false;}
 });
 window.workoutLibraryStart=async()=>{sessions=[];history();draft=blank();editor();status('Loading activity library…');try{await refresh();status(catalog.length?`${catalog.length} activities available.`:'The activity library needs its database seed installed.');}catch(err){status(err.message);}};
})();
