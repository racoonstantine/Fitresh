// Swipe a row to the left to reveal Edit / Delete (touch, pen or mouse drag). Used on logged foods,
// logged workouts, the History log and the "This meal" list. Each list passes in what Edit and Delete do,
// so the existing edit/remove logic is reused; the old buttons inside the rows keep working too.
// Delete asks for a second tap ("Tap to confirm") so a swipe plus one stray tap cannot remove anything.
//
//   attachSwipe(container, '.row-selector', row => ({edit: () => {...}, del: () => {...}}))
// Leave edit or del out to hide that button. Safe to call after every re-render.

const SWIPE_BTN_W = 76;
const SWIPE_DRAG_START = 8;      // px of sideways movement before it counts as a swipe
let swipeOpenRow = null;

function swipeSetOpen(wrap, open){
  const content = wrap._swipeContent, actions = wrap._swipeActions;
  wrap.classList.toggle('swipe-open', open);
  clearTimeout(wrap._swipeHide);
  if(open){
    actions.style.visibility = 'visible';
    content.style.transform = 'translateX(' + (-wrap._swipeWidth) + 'px)';
    if(swipeOpenRow && swipeOpenRow !== wrap) swipeSetOpen(swipeOpenRow, false);
    swipeOpenRow = wrap;
  } else {
    content.style.transform = 'translateX(0)';
    wrap._swipeHide = setTimeout(() => { if(!wrap.classList.contains('swipe-open')) actions.style.visibility = 'hidden'; }, 230);
    swipeResetDelete(wrap);
    if(swipeOpenRow === wrap) swipeOpenRow = null;
  }
}

function swipeCloseAll(){
  if(swipeOpenRow) swipeSetOpen(swipeOpenRow, false);
}

function swipeResetDelete(wrap){
  const btn = wrap._swipeDelBtn;
  if(!btn) return;
  clearTimeout(btn._swipeConfirmTimer);
  btn.dataset.confirming = 'false';
  btn.querySelector('.swipe-btn-label').textContent = 'Delete';
}

// The first ancestor with a real background colour, so the sliding row can cover the buttons behind it.
function swipeBackgroundFor(el){
  for(let n = el; n && n.nodeType === 1; n = n.parentElement){
    const bg = getComputedStyle(n).backgroundColor;
    if(bg && bg !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg)) return bg;
  }
  return getComputedStyle(document.body).backgroundColor;
}

function swipeBuild(row, acts){
  const wrap = document.createElement('div');
  wrap.className = 'swipe-row';
  const actions = document.createElement('div');
  actions.className = 'swipe-actions';
  actions.style.visibility = 'hidden';
  const content = document.createElement('div');
  content.className = 'swipe-content';
  let buttons = 0;
  const addBtn = (cls, icon, label, handler, confirmFirst) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swipe-btn ' + cls;
    btn.innerHTML = '<span aria-hidden="true">' + icon + '</span><span class="swipe-btn-label">' + label + '</span>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(confirmFirst && btn.dataset.confirming !== 'true'){
        btn.dataset.confirming = 'true';
        btn.querySelector('.swipe-btn-label').textContent = 'Tap to confirm';
        clearTimeout(btn._swipeConfirmTimer);
        btn._swipeConfirmTimer = setTimeout(() => swipeResetDelete(wrap), 3000);
        return;
      }
      swipeSetOpen(wrap, false);
      handler();
    });
    actions.appendChild(btn);
    buttons++;
    return btn;
  };
  if(acts.edit) addBtn('swipe-btn-edit', '✎', 'Edit', acts.edit, false);
  if(acts.del) wrap._swipeDelBtn = addBtn('swipe-btn-del', '🗑', 'Delete', acts.del, true);
  wrap._swipeWidth = buttons * SWIPE_BTN_W;
  wrap._swipeContent = content;
  wrap._swipeActions = actions;
  row.parentNode.insertBefore(wrap, row);
  wrap.appendChild(actions);
  wrap.appendChild(content);
  content.appendChild(row);
  swipeWire(wrap, content);
  return wrap;
}

function swipeWire(wrap, content){
  let startX = 0, startY = 0, startOffset = 0, dragging = false, tracking = false, id = null;
  const offsetNow = () => wrap.classList.contains('swipe-open') ? -wrap._swipeWidth : 0;
  content.addEventListener('pointerdown', (e) => {
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    if(e.target.closest('input, select, textarea')) return; // let people type and pick inside a row
    tracking = true; dragging = false; id = e.pointerId;
    startX = e.clientX; startY = e.clientY; startOffset = offsetNow();
  });
  content.addEventListener('pointermove', (e) => {
    if(!tracking || e.pointerId !== id) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if(!dragging){
      if(Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_DRAG_START){ tracking = false; return; } // a vertical scroll
      if(Math.abs(dx) < SWIPE_DRAG_START || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      dragging = true;
      try{ content.setPointerCapture(id); }catch(err){}
      content.style.transition = 'none';
      content.classList.add('swipe-dragging');
      content.style.background = swipeBackgroundFor(wrap); // read now, so a dark/light switch is honoured
      wrap._swipeActions.style.visibility = 'visible';
      if(swipeOpenRow && swipeOpenRow !== wrap) swipeSetOpen(swipeOpenRow, false);
    }
    const offset = Math.max(-wrap._swipeWidth, Math.min(0, startOffset + dx));
    content.style.transform = 'translateX(' + offset + 'px)';
  });
  const finish = (e) => {
    if(!tracking || e.pointerId !== id) return;
    tracking = false;
    if(!dragging) return;
    dragging = false;
    content.style.transition = '';
    content.classList.remove('swipe-dragging');
    const match = /translateX\((-?[\d.]+)px\)/.exec(content.style.transform);
    const offset = match ? parseFloat(match[1]) : 0;
    swipeSetOpen(wrap, offset < -wrap._swipeWidth / 2);
    // The release would otherwise count as a tap on the row (expanding it), so swallow that one click.
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    content.addEventListener('click', swallow, {capture: true, once: true});
    setTimeout(() => content.removeEventListener('click', swallow, {capture: true}), 60);
  };
  content.addEventListener('pointerup', finish);
  content.addEventListener('pointercancel', finish);
  // A tap on an open row just closes it.
  content.addEventListener('click', (e) => {
    if(wrap.classList.contains('swipe-open')){ e.stopPropagation(); e.preventDefault(); swipeSetOpen(wrap, false); }
  }, true);
}

function attachSwipe(container, rowSelector, actionsFor){
  if(!container) return;
  container.querySelectorAll(rowSelector).forEach(row => {
    if(row.parentNode.classList && row.parentNode.classList.contains('swipe-content')) return;
    const acts = actionsFor(row) || {};
    if(!acts.edit && !acts.del) return;
    swipeBuild(row, acts);
  });
}

if(typeof document !== 'undefined' && typeof document.addEventListener === 'function'){
  // Tapping anywhere outside an open row closes it.
  document.addEventListener('pointerdown', (e) => {
    if(swipeOpenRow && !swipeOpenRow.contains(e.target)) swipeSetOpen(swipeOpenRow, false);
  }, true);
}
