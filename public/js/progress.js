// ---------- Progress visuals: intake status, bars and rings that show "over target" ----------
// Going past a goal means different things: for a limit (calories, carbs, fat)
// it is bad news; for a target to reach (water, fasting, steps, protein,
// calories burned) it is good news. overKind says which ('bad' | 'good'); it
// picks the colour of the part of the bar / lap of the ring that goes beyond 100%.
const OVER_COLORS = {bad: '#E5484D', good: '#F5C542'};

// How today's calorie intake compares to the target, with a headline and a
// line of commentary. Within 10% either side counts as meeting the target;
// 10-25% over is a warning; more than 25% over is an alarm.
function intakeInsight(eaten, target){
  eaten = Number(eaten) || 0;
  target = Number(target) || 0;
  if(!target) return null;
  if(eaten <= 0){
    return {level: 'none', icon: '🍽️', headline: 'Nothing logged yet', comment: `${fmtNum(target)} kcal to work with today.`, color: 'var(--ink-soft)'};
  }
  const ratio = eaten / target;
  const diff = Math.round(Math.abs(target - eaten));
  if(ratio < 0.9){
    const plenty = ratio < 0.5;
    return {level: 'under', icon: plenty ? '🥗' : '👍', headline: `${fmtNum(diff)} kcal left`,
      comment: plenty ? 'Plenty of room — fuel up with a proper meal.' : 'On track — a little room left for today.', color: 'var(--forest-dark)'};
  }
  if(ratio <= 1.1){
    return {level: 'met', icon: '✅', headline: 'Target met',
      comment: eaten <= target ? `Right in the zone${diff ? ` (${fmtNum(diff)} kcal under)` : ''}.` : `Right in the zone (${fmtNum(diff)} kcal over, within 10%).`, color: 'var(--forest-dark)'};
  }
  if(ratio <= 1.25){
    return {level: 'warn', icon: '⚠️', headline: `${fmtNum(diff)} kcal over`,
      comment: 'A bit above target — keep the next meal light.', color: 'var(--ochre)'};
  }
  return {level: 'alarm', icon: '🚨', headline: `${fmtNum(diff)} kcal over`,
    comment: 'Well above target — go easy for the rest of the day.', color: OVER_COLORS.bad};
}

// How last night's sleep compares to the goal, with a headline and a line
// of commentary — mirrors intakeInsight() above but for sleep debt/surplus,
// where "over" is good news rather than bad.
function sleepInsight(hours, goalHours){
  hours = Number(hours) || 0;
  goalHours = Number(goalHours) || 8;
  if(hours <= 0) return null;
  const diff = hours - goalHours;
  if(Math.abs(diff) < 0.25){
    return {icon: '✅', headline: 'Right on target', comment: `Hit your ${formatSleepHours(goalHours)} goal — that's the sweet spot for recovery.`, color: 'var(--forest-dark)'};
  }
  if(diff < 0){
    const short = Math.abs(diff);
    if(short < 1){
      return {icon: '🥱', headline: `${formatSleepHours(short)} short`, comment: 'A little under goal — try to wind down a bit earlier tonight.', color: 'var(--ochre)'};
    }
    return {icon: '😴', headline: `${formatSleepHours(short)} short`, comment: short >= 2.5 ? 'Well under goal — watch for its effect on energy and appetite today.' : 'Under goal — aim to catch up over the next night or two.', color: OVER_COLORS.bad};
  }
  if(diff <= 1){
    return {icon: '👍', headline: `${formatSleepHours(diff)} over`, comment: 'A bit extra — fine once in a while.', color: 'var(--forest-dark)'};
  }
  return {icon: '💤', headline: `${formatSleepHours(diff)} over`, comment: 'Well over goal — could be catch-up sleep, or worth a look if it keeps happening.', color: 'var(--ochre)'};
}

// Fill for a bar: capped at full width, and once over target the last part
// (sized by how far over) switches to the "over" colour.
function barFillParts(pct, color, overKind){
  const raw = Math.max(0, Number(pct) || 0);
  if(raw <= 100 || !overKind) return {width: Math.min(100, raw) + '%', background: color};
  const withinShare = Math.max(6, Math.min(94, 100 / raw * 100)); // keep the tip visible
  return {width: '100%', background: `linear-gradient(90deg, ${color} ${withinShare}%, ${OVER_COLORS[overKind]} ${withinShare}%)`};
}
function glanceBarHtml(pct, color, overKind, fillId){
  const raw = Math.max(0, Number(pct) || 0);
  const parts = barFillParts(pct, color, overKind);
  const label = raw > 100 && overKind ? ` title="${Math.round(raw - 100)}% over"` : '';
  return `<div class="glance-bar-track"${label}><div class="glance-bar-fill" ${fillId ? `id="${fillId}" ` : ''}style="width:${parts.width};background:${parts.background};"></div></div>`;
}
// Updates an existing bar element (the live fasting timer, the water screen).
function applyBarFill(el, pct, color, overKind){
  if(!el) return;
  const parts = barFillParts(pct, color, overKind);
  el.style.width = parts.width;
  el.style.background = parts.background;
}
