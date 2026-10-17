// Resh: a friendly sprout companion on the Insights tab that reviews your recent progress with AI.
// It only runs when you press the button. To keep AI use low it also declines to run
//  - when your numbers have not meaningfully changed since the last review (see reshFingerprint), and
//  - more than once per calendar day.
// The saved review lives in the 'resh' storage resource, so it follows you between devices.

const RESH_DAYS = 14;
let reshState = null;      // {at, day, fp, review} saved review, or null
let reshLoaded = false;
let reshBusy = false;
let reshError = '';

// ---- Avatar: a round sprout with a leaf on its head; mood changes the face ----
function reshAvatarSvg(mood){
  const mouth = mood === 'thinking'
    ? '<ellipse cx="40" cy="52" rx="3" ry="3.4" fill="#0D3B2E"/>'
    : (mood === 'cheer'
      ? '<path d="M32 49 Q40 61 48 49 Z" fill="#0D3B2E"/><path d="M35 54 Q40 58 45 54" fill="#F5A0A8" stroke="none"/>'
      : '<path d="M33 50 Q40 57 47 50" fill="none" stroke="#0D3B2E" stroke-width="2.6" stroke-linecap="round"/>');
  return '<svg class="resh-avatar resh-' + mood + '" viewBox="0 0 80 80" width="72" height="72" role="img" aria-label="Resh, your Fitresh buddy">'
    + '<defs><linearGradient id="reshBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8F7DD"/><stop offset="1" stop-color="#6EE7A8"/></linearGradient>'
    + '<linearGradient id="reshLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34B871"/><stop offset="1" stop-color="#15803D"/></linearGradient></defs>'
    + '<ellipse cx="40" cy="72" rx="20" ry="3.5" fill="#0D3B2E" opacity=".12"/>'
    + '<ellipse cx="29" cy="68" rx="7" ry="4" fill="#34B871"/><ellipse cx="51" cy="68" rx="7" ry="4" fill="#34B871"/>'
    + '<path d="M40 8 C40 14 40 17 40 21" stroke="#15803D" stroke-width="3" stroke-linecap="round" fill="none"/>'
    + '<path d="M40 14 C30 4 18 8 20 18 C28 22 37 20 40 14 Z" fill="url(#reshLeaf)"/>'
    + '<path d="M40 12 C48 2 62 5 60 16 C52 21 43 19 40 12 Z" fill="url(#reshLeaf)" opacity=".92"/>'
    + '<path d="M40 20 C16 20 9 40 11 52 C13 66 26 70 40 70 C54 70 67 66 69 52 C71 40 64 20 40 20 Z" fill="url(#reshBody)" stroke="#34B871" stroke-width="1.5"/>'
    + '<ellipse cx="30" cy="42" rx="4.2" ry="5" fill="#0D3B2E"/><ellipse cx="50" cy="42" rx="4.2" ry="5" fill="#0D3B2E"/>'
    + '<circle cx="31.4" cy="40.2" r="1.5" fill="#fff"/><circle cx="51.4" cy="40.2" r="1.5" fill="#fff"/>'
    + '<ellipse cx="22" cy="50" rx="4.4" ry="2.8" fill="#F5A0A8" opacity=".7"/><ellipse cx="58" cy="50" rx="4.4" ry="2.8" fill="#F5A0A8" opacity=".7"/>'
    + mouth + '</svg>';
}

// ---- What Resh gets to see: a compact summary of the last two weeks ----
async function reshBuildSnapshot(){
  const dates = [];
  for(let i = RESH_DAYS - 1; i >= 0; i--) dates.push(dateStrForOffset(-i));
  try{ await fetchMealTotals(dates); }catch(e){}
  const rows = dates.map(d => {
    const entry = nutritionLog.find(e => e.date === d);
    const t = combinedDayTotals(d, entry);
    const sleep = sleepLog[d];
    return {
      date: d,
      food: t.hasAny && t.calories > 0,
      kcal: Math.round(t.calories), protein: Math.round(t.protein),
      water: waterLog[d] ? Math.round(waterLog[d]) : 0,
      steps: stepsLog[d] ? Math.round(stepsLog[d]) : 0,
      sleep: sleep && sleep.hours ? Math.round(sleep.hours * 10) / 10 : 0
    };
  });
  const workouts = historyLog.filter(e => dates.includes(e.date) && isRealSessionEntry(e)).map(e => {
    const st = e.stats || {};
    const bits = [st.duration && ('duration ' + st.duration), st.distance && (st.distance + ' km'), st.calories && (st.calories + ' kcal'), st.hr && ('avg HR ' + st.hr)].filter(Boolean);
    return {date: e.date, label: e.label || e.day, detail: bits.join(', ')};
  }).sort((a, b) => a.date < b.date ? -1 : 1);
  const since = dateStrForOffset(-30);
  const weights = weighIns.filter(w => w.date >= since).sort((a, b) => a.date < b.date ? -1 : 1);
  return {dates, rows, workouts, weights};
}

// Rounded on purpose: small day-to-day wobble should not count as "changed".
function reshFingerprint(snap){
  const logged = snap.rows.filter(r => r.food);
  const avg = (list, key) => list.length ? list.reduce((s, r) => s + r[key], 0) / list.length : 0;
  const stepsDays = snap.rows.filter(r => r.steps);
  const t = userHealthTargets || {};
  const lastW = snap.weights.length ? snap.weights[snap.weights.length - 1].kg : 0;
  return JSON.stringify({
    foodDays: logged.length,
    kcal: Math.round(avg(logged, 'kcal') / 100) * 100,
    protein: Math.round(avg(logged, 'protein') / 10) * 10,
    steps: Math.round(avg(stepsDays, 'steps') / 1000),
    sleep: Math.round(avg(snap.rows.filter(r => r.sleep), 'sleep')),
    workouts: snap.workouts.length,
    weight: Math.round(lastW * 2) / 2,
    goal: t.goalDirection || '', kcalTarget: Math.round((t.calorieTarget || 0) / 100) * 100
  });
}

function reshBuildPrompt(snap){
  const t = userHealthTargets || {};
  const goal = t.goalDirection === 'lose' ? 'lose weight' : (t.goalDirection === 'gain' ? 'gain weight' : 'maintain weight');
  const lines = [
    "You are Resh, the friendly sprout companion inside the Fitresh health tracker. Review this person's recent data and talk to them directly (\"you\").",
    'Be warm, specific and honest: celebrate real wins, name what needs work without shaming, and give concrete next steps. Use only the data below. If data is thin or missing, say so and say what logging would help. Never diagnose or give medical advice. Keep it short.',
    '',
    'Goal: ' + goal + (typeof GOAL_WEIGHT === 'number' ? ' (goal weight ' + GOAL_WEIGHT + ' kg)' : '') + '.',
    t.calorieTarget ? 'Daily targets: ' + Math.round(t.calorieTarget) + ' kcal, ' + t.proteinTarget + ' g protein' + (t.waterGoalMl ? ', ' + (t.waterGoalMl / 1000).toFixed(1) + ' L water.' : '.') : 'No calorie targets set.',
    '',
    'Last ' + RESH_DAYS + ' days, oldest first (today may be incomplete; a dash means nothing was logged):'
  ];
  snap.rows.forEach(r => {
    lines.push(r.date + ' | food ' + (r.food ? r.kcal + ' kcal, ' + r.protein + ' g protein' : '-') + ' | water ' + (r.water ? r.water + ' ml' : '-') + ' | steps ' + (r.steps || '-') + ' | sleep ' + (r.sleep ? r.sleep + ' h' : '-'));
  });
  lines.push('');
  lines.push('Workouts: ' + (snap.workouts.length ? snap.workouts.map(w => w.date + ' ' + w.label + (w.detail ? ' (' + w.detail + ')' : '')).join('; ') : 'none logged'));
  if(snap.weights.length){
    const first = snap.weights[0], last = snap.weights[snap.weights.length - 1];
    lines.push('Weight (last 30 days): ' + first.kg + ' kg on ' + first.date + (snap.weights.length > 1 ? ' -> ' + last.kg + ' kg on ' + last.date : ''));
  } else lines.push('Weight: no weigh-ins in the last 30 days');
  lines.push('');
  lines.push('Reply in exactly this format and nothing else:');
  lines.push('Headline: <one short, upbeat sentence>');
  lines.push('Going well:');
  lines.push('- <2 to 3 short bullets>');
  lines.push('Needs work:');
  lines.push('- <1 to 3 short bullets>');
  lines.push('Next steps:');
  lines.push('- <2 to 3 short bullets, each something doable this week>');
  lines.push('Cheer: <one short motivating sentence>');
  return lines.join(String.fromCharCode(10));
}

// Reply -> {headline, good[], work[], next[], cheer}; null when it does not look like the format.
function reshParseReply(text){
  const out = {headline: '', good: [], work: [], next: [], cheer: ''};
  let section = null;
  String(text || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if(!line) return;
    const m = line.match(/^(Headline|Going well|Needs work|Next steps|Cheer)\s*:\s*(.*)$/i);
    if(m){
      const key = m[1].toLowerCase();
      section = key === 'headline' ? 'headline' : (key === 'going well' ? 'good' : (key === 'needs work' ? 'work' : (key === 'next steps' ? 'next' : 'cheer')));
      if(m[2]){
        if(section === 'headline' || section === 'cheer') out[section] = m[2];
        else out[section].push(m[2].replace(/^[-•*]\s*/, ''));
      }
      return;
    }
    if(Array.isArray(out[section])) out[section].push(line.replace(/^[-•*]\s*/, ''));
  });
  return out.headline || out.good.length || out.work.length || out.next.length ? out : null;
}

// What the button may do right now, given the saved review and the current numbers.
// 'ask' = first review | 'again' = numbers changed and it is a new day | 'same' = nothing much changed | 'tomorrow' = already ran today
function reshStatus(saved, fp){
  if(!saved) return 'ask';
  if(saved.fp === fp) return 'same';
  if(saved.day === dateStrForOffset(0)) return 'tomorrow';
  return 'again';
}

function reshList(items){
  return items.length ? '<ul>' + items.map(i => '<li>' + foodSearchEscape(i) + '</li>').join('') + '</ul>' : '';
}
function reshReviewHtml(saved){
  const r = saved.review;
  const when = new Date(saved.at).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
  const parsed = reshParseReply(r);
  const body = parsed
    ? (parsed.headline ? '<div class="resh-headline">' + foodSearchEscape(parsed.headline) + '</div>' : '')
      + (parsed.good.length ? '<div class="resh-sec resh-good"><div class="resh-sec-title">Going well</div>' + reshList(parsed.good) + '</div>' : '')
      + (parsed.work.length ? '<div class="resh-sec resh-work"><div class="resh-sec-title">Needs work</div>' + reshList(parsed.work) + '</div>' : '')
      + (parsed.next.length ? '<div class="resh-sec resh-next"><div class="resh-sec-title">Next steps</div>' + reshList(parsed.next) + '</div>' : '')
      + (parsed.cheer ? '<div class="resh-cheer">' + foodSearchEscape(parsed.cheer) + '</div>' : '')
    : '<div class="resh-headline" style="white-space:pre-wrap;">' + foodSearchEscape(r) + '</div>';
  return '<div class="resh-bubble">' + body + '</div><div class="resh-when">Reviewed ' + foodSearchEscape(when) + '</div>';
}

async function renderResh(){
  const el = document.getElementById('reshCard');
  if(!el) return;
  if(!reshLoaded){
    try{
      const res = await window.storage.get(STORAGE_PREFIX + 'resh', false);
      reshState = res && res.value ? JSON.parse(res.value) : null;
    }catch(e){ reshState = null; }
    reshLoaded = true;
  }
  const snap = await reshBuildSnapshot();
  const fp = reshFingerprint(snap);
  const daysWithData = snap.rows.filter(r => r.food || r.steps || r.sleep || r.water).length + snap.workouts.length;
  const status = reshStatus(reshState, fp);
  const enough = daysWithData >= 3;

  let intro, btn = '', mood = 'happy';
  if(reshBusy){ intro = 'Hmm, let me look through your numbers…'; mood = 'thinking'; }
  else if(!enough){ intro = "Hi, I'm Resh! Log a few days of food, steps, sleep or workouts and I'll be able to tell you how you're doing."; }
  else if(!reshState){ intro = "Hi, I'm Resh! I can read through your last two weeks and tell you what's going well and what to work on. Ask me whenever you like."; btn = 'Ask Resh for a review'; }
  else { intro = ''; }
  if(reshState && !reshBusy && enough){
    btn = status === 'again' ? 'Ask Resh again' : '';
  }
  if(reshState && !reshBusy) mood = 'cheer';
  const note = !reshBusy && reshState && enough
    ? (status === 'same' ? "Your numbers haven't changed much since this review, so Resh is saving a trip. Log more and ask again." : (status === 'tomorrow' ? 'Resh has already looked today. Ask again tomorrow for a fresh read.' : ''))
    : '';
  el.innerHTML = '<div class="hub-card resh-card">'
    + '<div class="resh-head">' + reshAvatarSvg(mood) + '<div><div class="block-title" style="margin:0;">Resh</div><div class="resh-sub">Your Fitresh buddy. Reviews your progress when you ask.</div></div></div>'
    + (intro ? '<div class="resh-bubble">' + foodSearchEscape(intro) + '</div>' : '')
    + (reshState && !reshBusy ? reshReviewHtml(reshState) : '')
    + (reshError ? '<div class="note" style="color:#B4472A;margin-top:8px;">' + foodSearchEscape(reshError) + '</div>' : '')
    + (note ? '<div class="note" style="margin-top:8px;">' + foodSearchEscape(note) + '</div>' : '')
    + '<div class="resh-privacy">When you ask, a summary of your last two weeks goes to OpenAI for this one review. Fitresh does not keep anything else.</div>'
    + (btn ? '<button type="button" class="timer-btn start" id="reshAskBtn" style="width:100%;margin-top:12px;">' + btn + '</button>' : '')
    + '</div>';
  const askBtn = document.getElementById('reshAskBtn');
  if(askBtn) askBtn.addEventListener('click', () => reshAsk(snap, fp));
}

async function reshAsk(snap, fp){
  if(reshBusy) return;
  reshBusy = true; reshError = '';
  renderResh();
  try{
    const reply = await aiNativeAsk(reshBuildPrompt(snap), null, undefined, 'review');
    reshState = {at: new Date().toISOString(), day: dateStrForOffset(0), fp, review: reply};
    try{ await window.storage.set(STORAGE_PREFIX + 'resh', JSON.stringify(reshState), false); }catch(e){}
  }catch(err){
    reshError = err.message || 'Resh could not answer. Try again.';
  }finally{
    reshBusy = false;
    renderResh();
  }
}
