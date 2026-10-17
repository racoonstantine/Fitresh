// Native AI Assist: "Ask AI now" sends the same prompt the copy/paste flow builds (plus an optional photo)
// to api/ai_assist.php and hands the reply back to that panel's own parser. The photo is shrunk here,
// sent once, and never stored by the app. The buttons only appear when the server has AI switched on
// (<html data-ai-native>, see app.css); otherwise people just see the copy/paste flow.

const AI_PHOTO_MAX_SIDE = 1024;
const AI_PHOTO_DEFAULT_NOTE = 'A photo is attached to this message. Use it as the main source for your estimate.';
const aiNativeHandlers = {};

// A panel registers {buildPrompt(hasPhoto, say) -> string|null, onReply(prompt, reply), photoNote?} under its own kind.
// buildPrompt may call say(message) to explain why it returned null. photoNote is appended to the prompt when a
// photo is sent ('' = the prompt already covers it).
function aiNativeRegister(kind, handler){ aiNativeHandlers[kind] = handler; }

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

// kind 'review' is the Resh progress review (text only, a different system prompt on the server).
async function aiNativeAsk(prompt, file, note, kind){
  const body = { prompt };
  if(kind) body.kind = kind;
  if(file){
    try{ body.image = await aiNativePhotoDataUrl(file); }
    catch(e){ throw new Error("Couldn't read that photo — try another one, or ask without it."); }
    const extra = note === undefined ? AI_PHOTO_DEFAULT_NOTE : note;
    if(extra) body.prompt += '\n\n' + extra;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
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

// ---- Photo control: "Use photo" -> Take a photo / Choose from gallery ----
// Two real file inputs (one with capture so phones open the camera) behind one button, so the choice is
// the same in browsers, the installed web app and the Android shell.
function aiNativePhotoHtml(){
  return '<div class="ai-photo" data-ai-photo-ui>'
    + '<button type="button" class="timer-btn ai-photo-open" data-ai-photo-open>📷 Use photo</button>'
    + '<div class="ai-photo-choices" hidden>'
    + '<button type="button" class="timer-btn" data-ai-photo-pick="camera">Take a photo</button>'
    + '<button type="button" class="timer-btn" data-ai-photo-pick="gallery">Choose from gallery</button>'
    + '</div>'
    + '<input type="file" accept="image/*" capture="environment" hidden data-ai-photo-input="camera">'
    + '<input type="file" accept="image/*" hidden data-ai-photo-input="gallery">'
    + '<div class="ai-photo-chosen" hidden><img alt="" width="44" height="44"><span>Photo added</span>'
    + '<button type="button" data-ai-photo-clear aria-label="Remove photo">✕</button></div>'
    + '</div>';
}
function aiNativeFile(block){
  const ui = block.querySelector('[data-ai-photo-ui]');
  return (ui && ui._aiFile) || null;
}
function aiNativePhotoReset(ui){
  if(!ui) return;
  ui._aiFile = null;
  if(ui._aiUrl){ URL.revokeObjectURL(ui._aiUrl); ui._aiUrl = null; }
  ui.querySelectorAll('input[type=file]').forEach(i => { i.value = ''; });
  ui.querySelector('.ai-photo-chosen').hidden = true;
  ui.querySelector('.ai-photo-choices').hidden = true;
  ui.querySelector('[data-ai-photo-open]').textContent = '📷 Use photo';
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
    const file = input.files[0];
    if(!file) return;
    aiNativePhotoReset(ui);
    ui._aiFile = file;
    ui._aiUrl = URL.createObjectURL(file);
    const chosen = ui.querySelector('.ai-photo-chosen');
    chosen.querySelector('img').src = ui._aiUrl;
    chosen.hidden = false;
    ui.querySelector('[data-ai-photo-open]').textContent = '📷 Change photo';
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
    const clear = e.target.closest('[data-ai-photo-clear]');
    if(clear){ aiNativePhotoReset(clear.closest('[data-ai-photo-ui]')); return; }

    const btn = e.target.closest('[data-ai-ask]');
    if(!btn) return;
    const block = btn.closest('[data-ai-native]');
    const handler = aiNativeHandlers[btn.dataset.aiAsk];
    const status = block.querySelector('[data-ai-status]');
    const file = aiNativeFile(block);
    const say = (text) => { status.textContent = text; status.style.display = text ? 'block' : 'none'; };
    if(!handler) return;
    say('');
    const prompt = handler.buildPrompt(!!file, say);
    if(!prompt){ if(!status.textContent) say('Describe it first, or add a photo.'); return; }
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Asking AI…';
    try{
      const reply = await aiNativeAsk(prompt, file, handler.photoNote);
      handler.onReply(prompt, reply);
      aiNativePhotoReset(block.querySelector('[data-ai-photo-ui]'));
    }catch(err){
      say(err.message);
    }finally{
      btn.disabled = false; btn.textContent = label;
    }
  });
}
