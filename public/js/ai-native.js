// Native AI Assist: "Ask AI now" sends the same prompt the copy/paste flow builds (plus up to 5 photos)
// to api/ai_assist.php and hands the reply back to that panel's own parser. Photos are shrunk here,
// sent once, and never stored by the app. The buttons only appear when the server has AI switched on
// (<html data-ai-native>, see app.css); otherwise people just see the copy/paste flow.

const AI_PHOTO_MAX_SIDE = 1024;
const AI_MAX_PHOTOS = 5;
const aiNativeHandlers = {};

// A panel registers {buildPrompt(photoCount, say) -> string|null, onReply(prompt, reply), photoNote?} under its own kind.
// buildPrompt may call say(message) to explain why it returned null. photoNote (string or function(count)) is appended
// to the prompt when photos are sent ('' = the prompt already covers it).
function aiNativeRegister(kind, handler){ aiNativeHandlers[kind] = handler; }

function aiPhotoDefaultNote(count){
  return count > 1
    ? count + ' photos are attached to this message. Use them together as the main source for your estimate.'
    : 'A photo is attached to this message. Use it as the main source for your estimate.';
}

async function refreshAiNative(){
  try{
    const r = await safeFetchJson('api/ai_assist.php', { credentials: 'same-origin' });
    if(r.ok && r.data.enabled) document.documentElement.setAttribute('data-ai-native', '');
    else document.documentElement.removeAttribute('data-ai-native');
  }catch(e){ /* offline: leave as is */ }
}

// File -> small JPEG data URL (long side <= 1024 px). Throws if the browser cannot decode it.
async function aiNativePhotoDataUrl(file){
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AI_PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if(bitmap.close) bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

// files: array of File (may be empty). kind 'review' is the Resh progress review (text only, a different system
// prompt on the server). note: text appended when photos are sent (string, function(count), or undefined for the default).
async function aiNativeAsk(prompt, files, note, kind){
  const body = { prompt };
  if(kind) body.kind = kind;
  const list = (files || []).slice(0, AI_MAX_PHOTOS);
  if(list.length){
    try{ body.images = await Promise.all(list.map(aiNativePhotoDataUrl)); }
    catch(e){ throw new Error("Couldn't read one of those photos — try another, or ask without it."); }
    const extra = note === undefined ? aiPhotoDefaultNote(list.length) : (typeof note === 'function' ? note(list.length) : note);
    if(extra) body.prompt += '\n\n' + extra;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90000);
  let r;
  try{
    r = await safeFetchJson('api/ai_assist.php', {
      method: 'POST', credentials: 'same-origin', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
  }catch(e){
    throw new Error(e.name === 'AbortError' ? 'The AI took too long. Try again.' : (navigator.onLine === false ? "You're offline — AI needs a connection." : (e.message || 'Could not reach the AI. Try again.')));
  }finally{ clearTimeout(timer); }
  if(r.status === 401){ handleUnauthorized(); throw new Error('Your session expired — log in again.'); }
  if(!r.ok || !r.data.reply) throw new Error(r.data.error || 'The AI did not answer. Try again.');
  return r.data.reply;
}

// ---- Photo control: "Use photo" -> Take a photo / Choose from gallery, up to 5 photos ----
// Two real file inputs (one with capture so phones open the camera) behind one button, so the choice is
// the same in browsers, the installed web app and the Android shell. The gallery one takes several at once.
function aiNativePhotoHtml(){
  return '<div class="ai-photo" data-ai-photo-ui>'
    + '<button type="button" class="timer-btn ai-photo-open" data-ai-photo-open>📷 Use photo</button>'
    + '<div class="ai-photo-choices" hidden>'
    + '<button type="button" class="timer-btn" data-ai-photo-pick="camera">Take a photo</button>'
    + '<button type="button" class="timer-btn" data-ai-photo-pick="gallery">Choose from gallery</button>'
    + '</div>'
    + '<input type="file" accept="image/*" capture="environment" hidden data-ai-photo-input="camera">'
    + '<input type="file" accept="image/*" multiple hidden data-ai-photo-input="gallery">'
    + '<div class="ai-photo-chosen" hidden></div>'
    + '<div class="ai-photo-msg" hidden></div>'
    + '</div>';
}
function aiNativeFiles(block){
  const ui = block.querySelector('[data-ai-photo-ui]');
  return (ui && ui._aiFiles) ? ui._aiFiles.map(p => p.file) : [];
}
function aiNativePhotoRender(ui){
  const photos = ui._aiFiles || [];
  const chosen = ui.querySelector('.ai-photo-chosen');
  chosen.hidden = !photos.length;
  chosen.innerHTML = photos.map((p, i) =>
    '<span class="ai-photo-thumb"><img alt="" src="' + p.url + '" width="52" height="52">'
    + '<button type="button" data-ai-photo-remove="' + i + '" aria-label="Remove photo ' + (i + 1) + '">✕</button></span>').join('');
  const open = ui.querySelector('[data-ai-photo-open]');
  open.disabled = photos.length >= AI_MAX_PHOTOS;
  open.textContent = !photos.length ? '📷 Use photo'
    : (photos.length >= AI_MAX_PHOTOS ? AI_MAX_PHOTOS + ' of ' + AI_MAX_PHOTOS + ' photos added' : '📷 Add another photo (' + photos.length + ' of ' + AI_MAX_PHOTOS + ')');
}
function aiNativePhotoMessage(ui, text){
  const msg = ui.querySelector('.ai-photo-msg');
  msg.textContent = text; msg.hidden = !text;
}
function aiNativePhotoAdd(ui, fileList){
  ui._aiFiles = ui._aiFiles || [];
  let skipped = 0;
  Array.from(fileList).forEach(file => {
    if(ui._aiFiles.length >= AI_MAX_PHOTOS){ skipped++; return; }
    ui._aiFiles.push({file, url: URL.createObjectURL(file)});
  });
  aiNativePhotoMessage(ui, skipped ? 'Up to ' + AI_MAX_PHOTOS + ' photos at a time, so ' + skipped + ' ' + (skipped === 1 ? 'was' : 'were') + ' left out.' : '');
  aiNativePhotoRender(ui);
}
function aiNativePhotoReset(ui){
  if(!ui) return;
  (ui._aiFiles || []).forEach(p => URL.revokeObjectURL(p.url));
  ui._aiFiles = [];
  ui.querySelectorAll('input[type=file]').forEach(i => { i.value = ''; });
  ui.querySelector('.ai-photo-choices').hidden = true;
  aiNativePhotoMessage(ui, '');
  aiNativePhotoRender(ui);
}
if(typeof document !== 'undefined' && typeof document.querySelectorAll === 'function'){
  document.querySelectorAll('[data-ai-photo-slot]').forEach(el => { el.innerHTML = aiNativePhotoHtml(); });
}

// (guarded: tools/test_*.cjs run slices of the app source under a stub document)
if(typeof document !== 'undefined' && typeof document.addEventListener === 'function'){
  document.addEventListener('change', (e) => {
    const input = e.target.closest && e.target.closest('[data-ai-photo-input]');
    if(!input) return;
    const ui = input.closest('[data-ai-photo-ui]');
    if(input.files.length) aiNativePhotoAdd(ui, input.files);
    input.value = ''; // so the same photo can be picked again after removing it
  });

  document.addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-ai-backup-toggle]');
    if(toggle){
      const open = toggle.closest('.ai-backup').classList.toggle('open');
      toggle.textContent = open ? 'Hide copy & paste' : 'Use copy & paste instead';
      return;
    }
    const photoOpen = e.target.closest('[data-ai-photo-open]');
    if(photoOpen){
      const choices = photoOpen.closest('[data-ai-photo-ui]').querySelector('.ai-photo-choices');
      choices.hidden = !choices.hidden;
      return;
    }
    const pick = e.target.closest('[data-ai-photo-pick]');
    if(pick){
      const ui = pick.closest('[data-ai-photo-ui]');
      ui.querySelector('.ai-photo-choices').hidden = true;
      ui.querySelector('[data-ai-photo-input="' + pick.dataset.aiPhotoPick + '"]').click();
      return;
    }
    const remove = e.target.closest('[data-ai-photo-remove]');
    if(remove){
      const ui = remove.closest('[data-ai-photo-ui]');
      const gone = ui._aiFiles.splice(parseInt(remove.dataset.aiPhotoRemove, 10), 1)[0];
      if(gone) URL.revokeObjectURL(gone.url);
      aiNativePhotoMessage(ui, '');
      aiNativePhotoRender(ui);
      return;
    }

    const btn = e.target.closest('[data-ai-ask]');
    if(!btn) return;
    const block = btn.closest('[data-ai-native]');
    const handler = aiNativeHandlers[btn.dataset.aiAsk];
    const status = block.querySelector('[data-ai-status]');
    const files = aiNativeFiles(block);
    const say = (text) => { status.textContent = text; status.style.display = text ? 'block' : 'none'; };
    if(!handler) return;
    say('');
    const prompt = handler.buildPrompt(files.length, say);
    if(!prompt){ if(!status.textContent) say('Describe it first, or add a photo.'); return; }
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Asking AI…';
    try{
      const reply = await aiNativeAsk(prompt, files, handler.photoNote);
      handler.onReply(prompt, reply, files);
      aiNativePhotoReset(block.querySelector('[data-ai-photo-ui]'));
    }catch(err){
      say(err.message);
    }finally{
      btn.disabled = false; btn.textContent = label;
    }
  });
}
