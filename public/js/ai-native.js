// Native AI Assist: "Ask AI now" sends the same prompt the copy/paste flow builds (plus an optional photo)
// to api/ai_assist.php and hands the reply back to that panel's own parser. The photo is shrunk here,
// sent once, and never stored by the app. The buttons only appear when the server has AI switched on
// (<html data-ai-native>, see app.css); otherwise people just see the copy/paste flow.

const AI_PHOTO_MAX_SIDE = 1024;
const aiNativeHandlers = {};

// A panel registers {buildPrompt(hasPhoto) -> string|null, onReply(prompt, reply)} under its own kind.
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

async function aiNativeAsk(prompt, file){
  const body = { prompt };
  if(file){
    try{ body.image = await aiNativePhotoDataUrl(file); }
    catch(e){ throw new Error("Couldn't read that photo — try another one, or ask without it."); }
    body.prompt += '\n\nA photo is attached to this message. Use it as the main source for your estimate.';
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

// (guarded: tools/test_*.cjs run slices of the app source under a stub document)
if(typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('click', async (e) => {
  const toggle = e.target.closest('[data-ai-backup-toggle]');
  if(toggle){
    const open = toggle.closest('.ai-backup').classList.toggle('open');
    toggle.textContent = open ? 'Hide copy & paste' : 'Use copy & paste instead';
    return;
  }
  const btn = e.target.closest('[data-ai-ask]');
  if(!btn) return;
  const block = btn.closest('[data-ai-native]');
  const handler = aiNativeHandlers[btn.dataset.aiAsk];
  const status = block.querySelector('[data-ai-status]');
  const fileInput = block.querySelector('[data-ai-photo]');
  const file = fileInput && fileInput.files[0] || null;
  const say = (text) => { status.textContent = text; status.style.display = text ? 'block' : 'none'; };
  if(!handler) return;
  const prompt = handler.buildPrompt(!!file);
  if(!prompt) return say('Describe it first, or add a photo.');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Asking AI…'; say('');
  try{
    const reply = await aiNativeAsk(prompt, file);
    handler.onReply(prompt, reply);
    if(fileInput) fileInput.value = '';
  }catch(err){
    say(err.message);
  }finally{
    btn.disabled = false; btn.textContent = label;
  }
});
