/* Personal definitions are user-entered evidence, never shared catalog edits. */
(() => {
  'use strict';
  const fields=[['ENERC_KCAL','Calories (kcal)',true],['PROCNT','Protein (g)'],['CHOCDF','Carbs (g)'],['FAT','Fat (g)'],['FIBTG','Fiber (g)'],['SUGAR','Sugar (g)'],['NA','Sodium (mg)'],['CHOLE','Cholesterol (mg)']];
  const dialog=document.createElement('dialog');dialog.id='personalFoodDialog';dialog.setAttribute('aria-labelledby','pfTitle');
  dialog.innerHTML=`<header><h2 id="pfTitle">My foods</h2><button type="button" id="pfClose" class="timer-btn" aria-label="Close personal foods">Close</button></header>
    <p class="pf-note">Create a private food from its nutrition label. Enter all values for the same serving. Your entries are labeled “User entered.”</p>
    <p id="pfStatus" role="status" aria-live="polite"></p>
    <form id="pfForm"><fieldset id="pfFields">
      <label>Food name<input name="name" required maxlength="200" autocomplete="off"></label>
      <label>Brand (optional)<input name="brand" maxlength="150"></label>
      <label>One serving is…<input name="serving_label" required maxlength="80" placeholder="e.g. 1 scoop, 2 biscuits or 1 bottle"></label>
      <div class="pf-grid"><label>Serving measurement<select name="serving_measure"><option value="serving">Serving only — weight unknown</option><option value="g">Grams (g)</option><option value="ml">Milliliters (ml)</option></select></label>
      <label id="pfSizeLabel" hidden>Amount in one serving<input name="serving_size" type="number" min="0.01" max="100000" step="any" placeholder="e.g. 30"></label></div>
      <p class="pf-note">Without a measured weight or volume, log by servings. Grams and ml are not interchangeable.</p>
      <strong>Nutrition per serving</strong><div class="pf-grid">${fields.map(([code,label,required])=>`<label>${label}${required?' *':' (optional)'}<input name="${code}" type="number" min="0" max="99999999" step="any" ${required?'required':''}></label>`).join('')}</div>
      <p class="pf-note">Enter 0 only when stated on the label. Leave unlisted optional nutrients blank.</p>
      <p class="pf-note" id="pfPreview"></p>
      <label>Source or label-photo link (optional)<input name="source_url" type="url" maxlength="2048" placeholder="https://…"></label>
      <label>Notes (optional)<textarea name="notes" rows="2" maxlength="2000" placeholder="Flavor, preparation, label date…"></textarea></label>
      <label><input type="checkbox" name="submit_for_review"> Submit this version for shared-database review</label>
      <p class="pf-note">Unchecked: private only. Checked: reviewers receive these food details and your source link. Submission does not publish or verify the food.</p>
      <div class="pf-actions"><button type="submit" class="timer-btn start" id="pfSave">Save private food</button><button type="button" class="timer-btn" id="pfNew">New food</button></div>
    </fieldset></form><h3>Your latest foods</h3><p class="pf-note">Edit a food to save a new version. Past meal logs keep their original values. Showing up to 200 current entries.</p><div id="pfLibrary"></div>`;
  document.body.appendChild(dialog);
  const $=id=>document.getElementById(id),form=$('pfForm');
  let csrf='',previous=0,requestKey=crypto.randomUUID(),loaded=[],busy=false,opener=null;
  const status=(message,error=false)=>{$('pfStatus').textContent=message;$('pfStatus').style.color=error?'#B4472A':'';};
  function preview(){
    const unit=form.elements.serving_measure.value,size=Number(form.elements.serving_size.value),cal=form.elements.ENERC_KCAL.value;
    $('pfSizeLabel').hidden=unit==='serving';form.elements.serving_size.required=unit!=='serving';
    $('pfPreview').textContent=unit!=='serving' && size>0 && cal!=='' ? `${Number(cal)} kcal per ${size} ${unit} → ${(Number(cal)*100/size).toFixed(1)} kcal per 100 ${unit}. Original serving values are kept.` : 'Nutrition will be saved for one described serving.';
    $('pfSave').textContent=form.elements.submit_for_review.checked ? 'Save and submit for review' : previous ? 'Save new private version' : 'Save private food';
  }
  function fill(definition=null,id=0){
    form.reset();previous=id;requestKey=crypto.randomUUID();
    if(definition){
      for(const key of ['name','brand','serving_label','serving_measure','serving_size','source_url','notes'])form.elements[key].value=definition[key]??'';
      for(const [code] of fields)form.elements[code].value=definition.nutrients?.[code]??'';
    } else {
      // Leeway for someone who just wants to log the food and doesn't know
      // (or care about) macros yet -- calories is the only thing required,
      // so default it to 0 rather than making them type it every time.
      form.elements.ENERC_KCAL.value='0';
    }
    form.elements.submit_for_review.checked=false;preview();
  }
  async function load(){
    const response=await fetch('api/personal_foods.php',{credentials:'same-origin'}),data=await response.json();
    if(!response.ok)throw new Error(data.error||'Could not load your foods.');
    csrf=data.csrf_token;loaded=data.foods;renderLibrary();
  }
  function renderLibrary(){
    const el=$('pfLibrary');el.replaceChildren();
    if(!loaded.length){el.textContent='No personal foods yet.';return;}
    for(const row of loaded){
      const item=document.createElement('div');item.className='pf-library-item';
      const name=document.createElement('strong');name.textContent=row.definition.name;
      const detail=document.createElement('p');detail.className='pf-note';detail.textContent=`${row.definition.serving_label} · ${row.definition.nutrients.ENERC_KCAL} kcal · Version ${row.revision} · ${row.submission_status==='private'?'Private':'Review: '+row.submission_status}`;
      const edit=document.createElement('button');edit.type='button';edit.className='timer-btn';edit.textContent='Edit / submit';edit.addEventListener('click',()=>{if(busy)return;fill(row.definition,row.food_id);status('Editing creates a new version. Earlier logs stay unchanged.');dialog.scrollTop=0;form.elements.name.focus();});
      const use=document.createElement('button');use.type='button';use.className='timer-btn';use.textContent='Find in meal search';use.addEventListener('click',()=>{dialog.close();window.openLogMealScreen('snack');const input=$('lmSearchInput');input.value=row.definition.name;input.dispatchEvent(new Event('input',{bubbles:true}));});
      const actions=document.createElement('div');actions.className='pf-actions';actions.append(edit,use);item.append(name,detail,actions);el.appendChild(item);
    }
  }
  async function open(definition=null){
    if(busy)return;opener=document.activeElement;fill(definition);status('Loading your library…');$('pfFields').disabled=true;
    if(!dialog.open)dialog.showModal();
    try{await load();status(definition?'Personal copy: check the serving and label before saving.':'');$('pfFields').disabled=false;form.elements.name.focus();}
    catch(e){status(e.message,true);}
  }
  function openCopy(row){
    if(!row)return;
    const unit=['g','ml','serving'].includes(row.canonical_unit)?row.canonical_unit:'serving';
    const original=row.personal_food?.definition;
    open(original || {name:row.name,brand:row.brand||'',serving_label:`${row.canonical_amount||100} ${row.canonical_unit||'g'} reference`,serving_measure:unit,serving_size:row.canonical_amount||100,nutrients:row.nutrients||{},notes:'Personal copy of a search reference. Check against your food label.'});
  }
  form.addEventListener('input',()=>{requestKey=crypto.randomUUID();preview();});
  form.addEventListener('change',preview);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    const input={request_key:requestKey,previous_food_id:previous,submit_for_review:form.elements.submit_for_review.checked,nutrients:{}};
    for(const key of ['name','brand','serving_label','serving_measure','serving_size','source_url','notes'])input[key]=form.elements[key].value;
    for(const [code] of fields)input.nutrients[code]=form.elements[code].value===''?null:Number(form.elements[code].value);
    busy=true;$('pfFields').disabled=true;status('Saving…');
    try{
      const response=await fetch('api/personal_foods.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),data=await response.json();
      if(!response.ok)throw new Error(data.error||'Save failed.');
      // Refresh existing shortcuts after an edit; historical meal food IDs stay untouched.
      if(previous){
        try{
          const res=await fetch(`api/foods.php?action=get&id=${data.food.food_id}`,{credentials:'same-origin'});const food=await res.json();
          if(res.ok){
            const replace=r=>Number(r.id)===previous?foodSnapshot(food,food.id):r;
            recentFoods=recentFoods.map(replace);favoriteFoods=favoriteFoods.map(replace);
            await Promise.all([saveRecentFoods(),saveFavoriteFoods()]);renderRecentFavorites('food');renderRecentFavorites('lm');
          }
        }catch(_){/* The saved version remains available in the server library. */}
      }
      fill();
      try{await load();status(input.submit_for_review?'Saved privately and submitted for review. Nothing has been published.':'Saved privately. Find it by name in food search.');}
      catch(_){status('Saved successfully. Close and reopen My foods to refresh the list.');}
    }catch(e){status(e.message+' Your form is preserved; retry if needed.',true);}
    finally{busy=false;$('pfFields').disabled=false;}
  });
  $('pfNew').addEventListener('click',()=>{fill();status('');});
  $('pfClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>opener?.focus());
  for(const id of ['foodSearchInput','lmSearchInput']){
    const input=$(id);if(!input)continue;
    const button=document.createElement('button');button.type='button';button.className='timer-btn personal-food-open';button.textContent='My foods · Create food';button.addEventListener('click',()=>open());
    const anchor=id==='foodSearchInput'?input.parentElement:input;anchor.insertAdjacentElement('afterend',button);
  }
  window.personalFoods={open,openCopy};
})();
