// ---------- Number helpers: thousands separators in, thousands separators out ----------
// Numeric form fields are plain text inputs (input[data-num]) rather than
// type="number": a number input hands back "" for "1,200", so a comma could
// never be accepted. These helpers let people type or paste "1,200.5", store
// it as 1200.5, and show big numbers with "," separators on tiles and lists.

// Formats a number for display with "," thousands separators (always en-US so
// the separator is a comma regardless of the device locale). Non-numbers
// render as an em dash.
function fmtNum(value, digits){
  const n = typeof value === 'number' ? value : parseNum(value);
  if(!Number.isFinite(n)) return '—';
  const d = digits || 0;
  return n.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
}

// Like fmtNum but only shows decimals when needed, up to maxDigits (1200.5 -> "1,200.5", 1200 -> "1,200").
function fmtNumMax(value, maxDigits){
  const n = typeof value === 'number' ? value : parseNum(value);
  if(!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: maxDigits === undefined ? 1 : maxDigits});
}

// Comma-tolerant parseFloat: "1,200.5" -> 1200.5. Returns NaN for anything
// that isn't a number, exactly like parseFloat.
function parseNum(value){
  if(typeof value === 'number') return value;
  return parseFloat(String(value === null || value === undefined ? '' : value).replace(/[,\s]/g, ''));
}

// Strips a typed/pasted string down to a plain number: no commas or spaces,
// digits and one decimal point only, a minus sign only at the start.
function sanitizeNumText(text){
  let out = String(text).replace(/[,\s]/g, '').replace(/[^0-9.\-]/g, '').replace(/(?!^)-/g, '');
  const dot = out.indexOf('.');
  if(dot !== -1) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '');
  return out;
}

// Sets (or clears) the field's validity message from its min/max attributes,
// so form.reportValidity() keeps working the way it did for type="number".
// Returns true when the field is acceptable.
function validateNumField(el){
  const raw = el.value.trim();
  let message = '';
  if(raw === ''){
    if(el.required) message = 'Enter a number.';
  } else {
    const n = Number(raw);
    const min = el.getAttribute('min');
    const max = el.getAttribute('max');
    if(!Number.isFinite(n)) message = 'Enter a number.';
    else if(min !== null && min !== '' && n < Number(min)) message = `Enter ${min} or more.`;
    else if(max !== null && max !== '' && n > Number(max)) message = `Enter ${max} or less.`;
  }
  el.setCustomValidity(message);
  return message === '';
}
// Validates every numeric field inside a container; true when all are fine.
function validateNumFields(container){
  let ok = true;
  container.querySelectorAll('input[data-num]').forEach(el => { if(!validateNumField(el)) ok = false; });
  return ok;
}

document.addEventListener('input', e => {
  const el = e.target;
  if(!el || !el.matches || !el.matches('input[data-num]')) return;
  const raw = el.value;
  const cleaned = sanitizeNumText(raw);
  if(cleaned !== raw){
    // Keep the caret where the user was typing, discounting removed characters.
    const caret = el.selectionStart === null ? null : sanitizeNumText(raw.slice(0, el.selectionStart)).length;
    el.value = cleaned;
    if(caret !== null) el.setSelectionRange(caret, caret);
  }
  el.setCustomValidity('');
});
