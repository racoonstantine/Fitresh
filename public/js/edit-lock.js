// ---------- Edit lock for previously logged data ----------
// A past day's entry (steps, sleep, water, a fast) is shown as a one-line
// summary with a pencil "Edit" button; the fields only appear once it is
// pressed, so a stray tap can't change history. Days with nothing logged yet
// (and today's live entry) stay open, since that is logging, not editing.
const editUnlocked = new Set();

// blocks: the element(s) holding the editable controls (one bar is placed in
// front of the first). key: identifies this entry (e.g. 'steps:2026-09-18').
// baseLocked: whether this entry should be locked at all. summary: bar text (HTML).
function applyEditLock(blocks, {key, baseLocked, summary}){
  const list = Array.isArray(blocks) ? blocks : [blocks];
  const first = list[0];
  if(!first) return;
  let bar = first.previousElementSibling;
  if(!bar || !bar.classList.contains('edit-lock-bar')){
    bar = document.createElement('div');
    bar.className = 'edit-lock-bar';
    first.parentNode.insertBefore(bar, first);
  }
  const locked = baseLocked && !editUnlocked.has(key);
  bar.innerHTML = `<span class="edit-lock-summary">${summary}</span><button type="button" class="edit-lock-btn" aria-label="Edit this entry">✎ Edit</button>`;
  bar.querySelector('button').onclick = ()=>{
    editUnlocked.add(key);
    applyEditLock(blocks, {key, baseLocked, summary});
  };
  bar.style.display = locked ? 'flex' : 'none';
  list.forEach(el => {
    // Remember each block's own display (e.g. inline flex) so unlocking restores it.
    if(!('lockDisplay' in el.dataset)) el.dataset.lockDisplay = el.style.display;
    el.style.display = locked ? 'none' : el.dataset.lockDisplay;
  });
}
function editLockRelock(key){ editUnlocked.delete(key); }
function editLockResetAll(){ editUnlocked.clear(); }
