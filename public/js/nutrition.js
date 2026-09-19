let todayMealsGeneration = 0;
async function renderTodayMeals(){
  const card = document.getElementById('todayMealsCard');
  if(!card) return;
  const generation = ++todayMealsGeneration;
  const date = nutriSelectedDate || dateStrForOffset(0);
  // Guards against rapid day-nav clicks: bail if a newer renderTodayMeals()
  // call has started, or if the day changed again while we were awaiting.
  const stillCurrent = () => generation === todayMealsGeneration && date === (nutriSelectedDate || dateStrForOffset(0));
  const diaryEntry = nutritionLog.find(e => e.date === date);
  const diaryHtml = (diaryEntry && (diaryEntry.meal || diaryEntry.notes)) ? `
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">
      <div style="font-size:10.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">Notes for ${formatDateLabel(date)}</div>
      ${diaryEntry.meal ? `<div style="font-size:12.5px;color:var(--ink);line-height:1.5;">${foodSearchEscape(diaryEntry.meal)}</div>` : ''}
      ${diaryEntry.notes ? `<div style="font-size:12px;color:var(--ink-soft);font-style:italic;margin-top:4px;">${foodSearchEscape(diaryEntry.notes)}</div>` : ''}
    </div>
  ` : '';
  try{
    const res = await fetch(`api/meals.php?action=day&date=${date}`, {credentials: 'same-origin'});
    const data = await res.json();
    if(!stillCurrent()) return;
    const nonEmptyEntries = (data.entries || []).filter(entry => entry.components.length);
    if(!nonEmptyEntries.length){
      card.innerHTML = `<div class="block-title" style="margin:0 0 8px;">Logged via search</div><div class="dash-empty">Nothing logged this way yet for ${formatDateLabel(date)}.</div>${diaryHtml}`;
      return;
    }
    const typeLabels = {breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', custom: 'Misc'};
    const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'custom'];
    const sortedEntries = [...nonEmptyEntries].sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type));
    const rows = sortedEntries.map(entry => `
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px;">${typeLabels[entry.meal_type] || entry.meal_type}</div>
        ${entry.components.map(c => `
          <div class="meal-component-row" data-id="${c.id}" style="padding:6px 0;border-bottom:1px dashed var(--line);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <span style="color:var(--ink-soft);">${renderFoodIconSvg(getFoodIcon({name: c.name}), 18)}</span>
                <div style="font-size:13px;min-width:0;">${foodSearchEscape(c.name)} <span style="color:var(--ink-soft);font-size:11.5px;">(${foodSearchEscape(c.amount)}${foodSearchEscape(c.unit)})</span></div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <span style="font-size:12.5px;color:var(--ink-soft);">${fmtNum(c.nutrients.ENERC_KCAL || 0)} kcal</span>
                <button class="edit-lock-btn meal-edit-toggle" data-id="${c.id}" type="button" title="Edit this food" aria-label="Edit ${foodSearchEscape(c.name)}">✎</button>
              </div>
            </div>
            <div style="font-size:10.5px;color:var(--ink-soft);margin-top:2px;">${Math.round((c.nutrients.PROCNT || 0) * 10) / 10}g protein · ${Math.round((c.nutrients.FAT || 0) * 10) / 10}g fat · ${Math.round((c.nutrients.CHOCDF || 0) * 10) / 10}g carbs</div>
            <div class="meal-component-edit" data-edit-id="${c.id}" style="display:none;margin-top:6px;gap:8px;align-items:center;flex-wrap:wrap;">
              <input type="text" inputmode="decimal" data-num class="meal-edit-amount" data-edit-id="${c.id}" value="${c.amount}" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;">
              <span style="font-size:11.5px;color:var(--ink-soft);">${c.unit}</span>
              <select class="meal-edit-type" data-edit-id="${c.id}" style="padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;">
                ${MEAL_TYPE_ORDER.map(mt => `<option value="${mt}" ${mt === entry.meal_type ? 'selected' : ''}>${typeLabels[mt] || mt}</option>`).join('')}
              </select>
              <button class="timer-btn start meal-save-amount" data-id="${c.id}" data-unit="${c.unit}" type="button" style="flex:1;padding:6px 0;font-size:12px;">Save</button>
              <button class="wi-del meal-delete" data-id="${c.id}" type="button" title="Remove this food">✕ Remove</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
    const t = data.totals || {};
    card.innerHTML = `
      <div class="block-title" style="margin:0 0 10px;">Logged via search</div>
      ${rows}
      <div style="display:flex;justify-content:space-between;font-weight:700;padding-top:8px;font-size:13.5px;">
        <span>Total</span>
        <span>${fmtNum(t.ENERC_KCAL || 0)} kcal · ${fmtNum(t.PROCNT || 0)}g protein</span>
      </div>
      ${diaryHtml}
    `;
    card.querySelectorAll('.meal-delete').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        await fetch('api/meals.php?action=delete_component', {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({id: parseInt(btn.dataset.id, 10)})
        });
        renderTodayMeals();
        renderNutrition();
      });
    });
    // Logged foods are read-only until the pencil is pressed.
    card.querySelectorAll('.meal-edit-toggle').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const id = btn.dataset.id;
        card.querySelectorAll('.meal-component-edit').forEach(el=>{
          el.style.display = (el.dataset.editId === id && el.style.display !== 'flex') ? 'flex' : 'none';
        });
      });
    });
    card.querySelectorAll('.meal-save-amount').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        const id = btn.dataset.id;
        const input = card.querySelector(`.meal-edit-amount[data-edit-id="${id}"]`);
        const typeSelect = card.querySelector(`.meal-edit-type[data-edit-id="${id}"]`);
        const amount = parseNum(input.value);
        if(!amount || amount <= 0) return;
        btn.disabled = true;
        btn.textContent = 'Saving…';
        await fetch('api/meals.php?action=update_component', {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({id: parseInt(id, 10), amount, unit: btn.dataset.unit || 'g', meal_type: typeSelect ? typeSelect.value : undefined})
        });
        renderTodayMeals();
        renderNutrition();
      });
    });
  }catch(e){
    if(!stillCurrent()) return;
    card.innerHTML = `<div class="dash-empty">Could not load today's search-logged foods.</div>`;
  }
}

let nutritionRenderGeneration = 0;
async function renderNutrition(){
  if(nutriSelectedDate === null) nutriSelectedDate = dateStrForOffset(0);
  renderTodayMeals();
  renderRecentFavorites('food');
  // Capture the selected date now, before the await below -- rapid day-nav
  // clicks fire overlapping calls, and reading the live nutriSelectedDate
  // again AFTER the await (like the rest of this function used to) could
  // show a different day than the one whose totals were actually fetched.
  const selectedDate = nutriSelectedDate;
  const generation = ++nutritionRenderGeneration;
  const rangeSel = document.getElementById('nutriRange');
  const range = rangeSel ? rangeSel.value : 'day';
  const sorted = [...nutritionLog].sort((a,b)=> a.date < b.date ? -1 : 1);
  const windowDays = range === 'month' ? 30 : 7;
  const dateList = range === 'day' ? [selectedDate] : (()=>{ const arr=[]; for(let i=0;i<windowDays;i++) arr.push(dateStrForOffset(-i)); return arr; })();
  await fetchMealTotals(dateList);
  if(generation !== nutritionRenderGeneration) return;
  // Per-date totals from nutritionLog (quick-log) merged with search-logged meals,
  // for whichever dates are in view -- this feeds the cards/banner/macro bar below.
  const combinedList = dateList
    .map(d => ({date: d, ...combinedDayTotals(d, sorted.find(e => e.date === d))}))
    .filter(e => e.hasAny);
  const recent = sorted.filter(e => dateList.includes(e.date));

  const navEl = document.getElementById('nutriDayNav');
  const bannerEl = document.getElementById('nutriTodayBanner');
  navEl.classList.remove('day-nav-loading');

  if(range === 'day'){
    const todayStr = dateStrForOffset(0);
    const isToday = selectedDate === todayStr;
    navEl.innerHTML = `
      <button class="day-nav-btn" id="nutriPrevDay"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="day-nav-label">
        <div class="day-nav-date">${isToday ? 'Today' : formatDateLabel(selectedDate)}</div>
        ${!isToday ? `<div class="day-nav-today-link" id="nutriJumpToday">Jump to today</div>` : `<div style="font-size:11px;color:var(--ink-soft);">${formatDateLabel(selectedDate)}</div>`}
      </div>
      <button class="day-nav-btn" id="nutriNextDay" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    `;
    document.getElementById('nutriPrevDay').addEventListener('click', async ()=>{
      nutriSelectedDate = addDaysToDate(nutriSelectedDate, -1);
      navEl.classList.add('day-nav-loading');
      await renderNutrition();
    });
    const nextBtn = document.getElementById('nutriNextDay');
    if(!isToday){
      nextBtn.addEventListener('click', async ()=>{
        nutriSelectedDate = addDaysToDate(nutriSelectedDate, 1);
        navEl.classList.add('day-nav-loading');
        await renderNutrition();
      });
    }
    if(!isToday){
      document.getElementById('nutriJumpToday').addEventListener('click', async ()=>{
        nutriSelectedDate = todayStr;
        navEl.classList.add('day-nav-loading');
        await renderNutrition();
      });
    }
  } else {
    navEl.innerHTML = '';
  }

  if(range === 'day'){
    const today = selectedDate;
    const todayEntry = sorted.find(e => e.date === today);
    const combinedToday = combinedDayTotals(today, todayEntry);
    const t = getTargets(today);
    const workoutToday = isWorkoutDay(today);
    const eatenCal = combinedToday.calories;
    const eatenProtein = combinedToday.protein;
    const eatenFat = combinedToday.fat;
    const eatenCarbs = combinedToday.carbs;
    const eatenSodium = combinedToday.sodium;
    const eatenFiber = combinedToday.fiber;
    const eatenSugar = combinedToday.sugar;
    const remCal = t.calMin - eatenCal;
    const remProtein = t.proteinMin - eatenProtein;
    const calMet = remCal <= 0, proteinMet = remProtein <= 0;

    const isTodaySel = today === dateStrForOffset(0);
    const dayWord = isTodaySel ? 'today' : 'that day';
    const dayTypeNote = `<div style="font-size:10.5px;color:var(--ink-soft);margin-top:8px;">Targets shown for a ${workoutToday ? 'workout' : 'sedentary/rest'} day.</div>`;

    if(!combinedToday.hasAny){
      bannerEl.innerHTML = `
        <div style="background:var(--paper-raised);border:1px solid var(--line);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:12.5px;color:var(--ink-soft);">No entry logged for ${dayWord}.</div>
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">${isTodaySel ? 'You have' : 'That day had'} the full ${fmtNum(t.calMin)}-${fmtNum(t.calMax)} kcal / ${t.proteinMin}-${t.proteinMax}g protein target ${isTodaySel ? 'still to hit' : 'to hit'}.</div>
          ${dayTypeNote}
        </div>
      `;
    } else {
      bannerEl.innerHTML = `
        <div style="background:${(calMet && proteinMet) ? 'rgba(47,111,78,0.12)' : 'rgba(180,71,42,0.1)'};border:1px solid ${(calMet && proteinMet) ? 'var(--forest)' : '#B4472A'};border-radius:8px;padding:12px;">
          <div style="font-size:12px;font-weight:600;color:${(calMet && proteinMet) ? 'var(--forest-dark)' : '#B4472A'};margin-bottom:8px;">
            ${(calMet && proteinMet) ? (isTodaySel ? '✓ Today&#39;s target met — nice work' : '✓ Target was met that day') : (isTodaySel ? 'Still room to eat today' : 'Target was not fully met that day')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;">
            <span style="color:var(--ink-soft);">Calories</span>
            <span style="color:var(--ink);font-weight:600;">${fmtNum(eatenCal)} / ${fmtNum(t.calMin)}-${fmtNum(t.calMax)} kcal ${calMet ? '' : `(${fmtNum(remCal)} more needed)`}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;">
            <span style="color:var(--ink-soft);">Protein</span>
            <span style="color:var(--ink);font-weight:600;">${(Math.round(eatenProtein * 10) / 10)}g / ${t.proteinMin}-${t.proteinMax}g ${proteinMet ? '' : `(${remProtein.toFixed(0)}g more needed)`}</span>
          </div>
          ${dayTypeNote}

          ${todayEntry && todayEntry.meal ? `
          <div style="margin-top:12px;background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:10px;">
            <div style="font-size:10.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">What was eaten</div>
            <div style="font-size:12.5px;color:var(--ink);line-height:1.5;">${foodSearchEscape(todayEntry.meal)}</div>
            ${todayEntry.notes ? `<div style="font-size:11.5px;color:var(--ink-soft);font-style:italic;margin-top:6px;">${foodSearchEscape(todayEntry.notes)}</div>` : ''}
          </div>
          ` : ''}

          <div style="margin-top:12px;">
            <div class="log-head" data-macro-toggle="1" style="padding:6px 0;cursor:pointer;">
              <div style="flex:1;font-size:11.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;">Macro breakdown</div>
              <svg class="log-caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div class="log-detail open" data-macro-detail="1">
              <div style="padding-top:6px;">
                ${macroBarRow('Calories', eatenCal, t.calMin, t.calMax, ' kcal', 'range')}
                ${macroBarRow('Protein', eatenProtein, t.proteinMin, t.proteinMax, 'g', 'range')}
                ${macroBarRow('Fat', eatenFat, t.fatMin, t.fatMax, 'g', 'range')}
                ${macroBarRow('Carbs', eatenCarbs, 0, t.carbsMax, 'g', 'ceiling')}
                ${(eatenSodium || eatenFiber || eatenSugar) ? `
                  <div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px;">From itemized food logging</div>
                  <div style="display:flex;gap:6px;">
                    ${macroChip('Sodium', eatenSodium, t.sodiumMax, 'mg', 'ceiling')}
                    ${macroChip('Fiber', eatenFiber, t.fiberTarget, 'g', 'floor')}
                    ${macroChip('Sugar', eatenSugar, t.sugarMax, 'g', 'ceiling')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          ${(() => {
            const notes = buildNutritionNotes(
              {cal: eatenCal, protein: eatenProtein, fat: eatenFat, carbs: eatenCarbs, sodium: eatenSodium, fiber: eatenFiber, sugar: eatenSugar},
              t, !!(eatenSodium || eatenFiber || eatenSugar)
            );
            return `
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
                <div style="font-size:10.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Guidance for ${dayWord}</div>
                ${notes.map(n => `<div style="display:flex;gap:6px;font-size:12px;color:var(--ink);line-height:1.4;margin-bottom:5px;"><span>${n.icon}</span><span>${n.text}</span></div>`).join('')}
              </div>
            `;
          })()}
        </div>
      `;
      const macroHead = bannerEl.querySelector('[data-macro-toggle="1"]');
      macroHead.addEventListener('click', ()=>{
        const detail = bannerEl.querySelector('[data-macro-detail="1"]');
        const open = detail.classList.toggle('open');
        macroHead.classList.toggle('expanded', open);
      });
    }
  } else {
    bannerEl.innerHTML = '';
  }

  const avg = (key) => {
    const vals = combinedList.map(e => e[key]).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null;
  };
  const avgCal = avg('calories'), avgProtein = avg('protein'), avgFat = avg('fat'), avgCarbs = avg('carbs');
  const fastVals = recent.map(e => parseNum(e.fastHours)).filter(v => !isNaN(v));
  const avgFast = fastVals.length ? fastVals.reduce((a,b)=>a+b,0) / fastVals.length : null;
  const daysMetProtein = combinedList.filter(e => e.protein >= getTargets(e.date).proteinMin).length;
  const daysMetCal = combinedList.filter(e => e.calories >= getTargets(e.date).calMin).length;

  const calColor = avgCal !== null ? (avgCal >= CAL_TARGET_MIN ? 'var(--forest-dark)' : '#B4472A') : 'var(--forest-dark)';
  const proteinColor = avgProtein !== null ? (avgProtein >= PROTEIN_TARGET_MIN ? 'var(--forest-dark)' : '#B4472A') : 'var(--forest-dark)';
  const cardLabel = range === 'day' ? '' : (range === 'month' ? ' (30d)' : ' (7d)');

  clearInterval(nutriFastTickInterval);
  const isTodaySelected = range === 'day' && selectedDate === dateStrForOffset(0);
  document.getElementById('nutriCards').innerHTML = `
    <div class="dash-card"><div class="dash-num" style="color:${calColor};">${avgCal !== null ? fmtNum(avgCal) : '—'}</div><div class="dash-label">${range==='day' ? 'Kcal today' : 'Avg kcal'+cardLabel}</div></div>
    <div class="dash-card"><div class="dash-num" style="color:${proteinColor};">${avgProtein !== null ? avgProtein.toFixed(1) : '—'}</div><div class="dash-label">${range==='day' ? 'Protein today' : 'Avg protein'+cardLabel}</div></div>
    <div class="dash-card ${isTodaySelected ? 'open-fasting-screen-link' : ''}" ${isTodaySelected ? 'style="cursor:pointer;"' : ''}>
      <div class="dash-num" id="nutriFastValue">${avgFast !== null ? formatFastHours(avgFast) : '—'}</div>
      <div class="dash-label">${range==='day' ? "Today's fast" : 'Avg fast'+cardLabel}</div>
      ${isTodaySelected ? `<div style="font-size:9.5px;color:var(--ink-soft);margin-top:2px;" id="nutriFastSub"></div>` : ''}
    </div>
    <div class="dash-card"><div class="dash-num">${daysMetProtein}/${combinedList.length}</div><div class="dash-label">Days hit protein</div></div>
    <div class="dash-card"><div class="dash-num">${daysMetCal}/${combinedList.length}</div><div class="dash-label">Days hit kcal floor</div></div>
    <div class="dash-card"><div class="dash-num">${combinedList.length}</div><div class="dash-label">Days logged${cardLabel}</div></div>
  `;
  if(isTodaySelected){
    const todayEntryForFast = sorted.find(e => e.date === selectedDate);
    const lastFast = todayEntryForFast && todayEntryForFast.fastHours ? parseNum(todayEntryForFast.fastHours) : null;
    const updateNutriFast = ()=>{
      const valEl = document.getElementById('nutriFastValue');
      const subEl = document.getElementById('nutriFastSub');
      if(!valEl) return;
      const info = fastingSummaryText(lastFast);
      valEl.textContent = info.value;
      if(subEl) subEl.textContent = info.sub;
    };
    updateNutriFast();
    if(fastingState.startIso){
      nutriFastTickInterval = setInterval(updateNutriFast, 1000);
    }
  }

  // Macro split bar (avg calorie contribution: protein 4kcal/g, fat 9kcal/g, carbs 4kcal/g)
  const macroEl = document.getElementById('macroBar');
  if(avgProtein !== null && avgFat !== null && avgCarbs !== null){
    const pCal = avgProtein * 4, fCal = avgFat * 9, cCal = avgCarbs * 4;
    const totalCal = pCal + fCal + cCal || 1;
    const pPct = (pCal/totalCal*100), fPct = (fCal/totalCal*100), cPct = (cCal/totalCal*100);
    macroEl.innerHTML = `
      <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:6px;">${range==='day' ? "Today's" : 'Avg'} macro split (by calories)</div>
      <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;border:1px solid var(--line);">
        <div style="width:${pPct}%;background:var(--forest);" title="Protein"></div>
        <div style="width:${fPct}%;background:var(--ochre);" title="Fat"></div>
        <div style="width:${cPct}%;background:#B4472A;" title="Carbs"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink-soft);margin-top:4px;">
        <span>🟢 Protein ${pPct.toFixed(0)}%</span>
        <span>🟠 Fat ${fPct.toFixed(0)}%</span>
        <span>🔴 Carbs ${cPct.toFixed(0)}%</span>
      </div>
    `;
  } else {
    macroEl.innerHTML = '';
  }

  // Weekly/monthly multi-macro trend (day view already has its own
  // single-day macro bars/banner above, so this only applies to the 7d/30d
  // windows).
  renderNutritionTrendChart(document.getElementById('calorieChart'), range, dateList, sorted);

  renderTodayGlance();
}

