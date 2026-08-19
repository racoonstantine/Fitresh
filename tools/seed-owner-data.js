/*
 * ONE-TIME OWNER DATA IMPORT — do not deploy this file, do not run it more than once.
 *
 * This restores the personal workout/nutrition/weigh-in history that used to be
 * hardcoded into the app itself. Keeping it out of public/index.html matters because
 * that file is shared by every account — if this stayed in there, every friend who
 * signs up would get your history auto-inserted into their own account.
 *
 * How to run it:
 *   1. Open your live site and log in as yourself (the account this data belongs to).
 *   2. Open the browser DevTools console (F12 → Console tab).
 *   3. Paste the entire contents of this file and press Enter.
 *   4. Wait for "Owner data import complete" in the console, then reload the page.
 *   5. Delete this file from the repo (or at least never run it again — it's safe to
 *      re-run since every block below checks "if not already present" first, but
 *      there's no reason to keep it around once it's done its job).
 *
 * This only works because it calls the same global functions (addWeighIn,
 * upsertSessionLog, saveNutritionDay, saveChecked, saveWeights, logCustomEntry,
 * loadState/loadHistory/loadWeighIns/loadNutrition) that public/index.html already
 * defines and loads into the page — it rides on the live app's own code, it doesn't
 * reimplement anything.
 */
(async function seedOwnerData(){
  await loadState();
  await loadHistory();
  await loadWeighIns();
  await loadNutrition();

  // One-time backfill: weigh-in history Jul 31 - Aug 8, 2026
  if(!weighIns.find(w => w.date === '2026-07-31')){
    const seedWeights = [
      {date:'2026-07-31', kg:101.0},
      {date:'2026-08-01', kg:99.6},
      {date:'2026-08-02', kg:98.4},
      {date:'2026-08-03', kg:97.6},
      {date:'2026-08-04', kg:96.9},
      {date:'2026-08-05', kg:96.7},
      {date:'2026-08-06', kg:96.3},
      {date:'2026-08-07', kg:95.85},
      {date:'2026-08-08', kg:94.95}
    ];
    seedWeights.forEach(w => addWeighIn(w.date, w.kg));
  }

  // One-time backfill: Aug 7, 2026 treadmill session from Huawei Fit (Indoor run)
  const backfillDate = '2026-08-07';
  const backfillDay = 'interval'; // Fri = Cardio Intervals per weekly plan
  if(!historyLog.find(e => e.date === backfillDate && e.day === backfillDay)){
    checkedState[backfillDate + '_' + backfillDay + '_done'] = true;
    saveChecked();
    upsertSessionLog(backfillDate, backfillDay, [], '', {
      distance: '2.58',
      duration: '39:22',
      calories: '304',
      hr: '127',
      pace: '15\'16"',
      steps: '3537'
    });
  }

  // One-time backfill: Aug 8, 2026 Strength A session from Huawei Fit (Strength preset) + on-screen checklist
  const backfillDate2 = '2026-08-08';
  const backfillDay2 = 'A';
  if(!historyLog.find(e => e.date === backfillDate2 && e.day === backfillDay2)){
    const strengthAExercises = [
      {id:'a1', name:'Goblet Squat', weight:'5'},
      {id:'a2', name:'Dumbbell Row (bent over)', weight:'10'},
      {id:'a3', name:'Push-up (knees if needed)', weight:''},
      {id:'a4', name:'Dumbbell Shoulder Press', weight:'10'},
      {id:'a5', name:'Romanian Deadlift', weight:'14.5'},
      {id:'a6', name:'Plank', weight:''},
      {id:'a8', name:'Lying Leg Raise', weight:''}
    ];
    strengthAExercises.forEach(ex=>{
      checkedState[ex.id] = true;
      if(ex.weight){
        window.savedWeights = window.savedWeights || {};
        window.savedWeights[ex.id] = ex.weight;
      }
    });
    saveChecked();
    saveWeights();
    checkedState[backfillDate2 + '_' + backfillDay2 + '_done'] = true;
    saveChecked();
    upsertSessionLog(
      backfillDate2, backfillDay2,
      strengthAExercises.map(ex=>({name: ex.name, weight: ex.weight})),
      '696 active kcal of 816 total · aerobic training stress 3.0 · recovery time 10h',
      {duration: '01:20:07', calories: '816', hr: '130'}
    );
  }

  // One-time backfill: Aug 10, 2026 Strength A session from Huawei Fit (Strength preset) + on-screen checklist
  const backfillDate3 = '2026-08-10';
  const backfillDay3 = 'A';
  if(!historyLog.find(e => e.date === backfillDate3 && e.day === backfillDay3)){
    const strengthAExercisesAug10 = [
      {id:'a1', name:'Goblet Squat', weight:'5'},
      {id:'a2', name:'Dumbbell Row (bent over)', weight:'10'},
      {id:'a3', name:'Push-up (knees if needed)', weight:''},
      {id:'a4', name:'Dumbbell Shoulder Press', weight:'10'},
      {id:'a5', name:'Romanian Deadlift', weight:'14.5'},
      {id:'a7', name:'Bicycle Crunch', weight:''}
    ];
    strengthAExercisesAug10.forEach(ex=>{
      checkedState[ex.id] = true;
      if(ex.weight){
        window.savedWeights = window.savedWeights || {};
        window.savedWeights[ex.id] = ex.weight;
      }
    });
    saveChecked();
    saveWeights();
    checkedState[backfillDate3 + '_' + backfillDay3 + '_done'] = true;
    saveChecked();
    upsertSessionLog(
      backfillDate3, backfillDay3,
      strengthAExercisesAug10.map(ex=>({name: ex.name, weight: ex.weight})),
      '417 active kcal of 488 total · aerobic training stress 2.4 · recovery time 7h',
      {duration: '00:47:23', calories: '488', hr: '131'}
    );
  }

  // One-time backfill: nutrition & fasting log Aug 3-8, 2026
  if(!nutritionLog.find(e => e.date === '2026-08-03')){
    const seedNutrition = [
      {date:'2026-08-03', fastHours:19.72, meal:'Scrambled egg, ampalaya with egg/tofu, chicken cuts (2x portion) — home', calories:860, protein:85, fat:51, carbs:10, notes:''},
      {date:'2026-08-04', fastHours:20.00, meal:'Home-packed — 6 pcs okra, kimchi, 2 boiled eggs — office day', calories:210, protein:16, fat:10, carbs:10, notes:'Lowest calorie/protein day logged — consider packing more for office days'},
      {date:'2026-08-05', fastHours:23.52, meal:'Okra, 2 pcs tortang talong, Tropical Hut chicken leg — office day', calories:700, protein:39, fat:44, carbs:31, notes:''},
      {date:'2026-08-06', fastHours:22.67, meal:'Tonkatsu Currydon (pork katsu, kimchi, shredded egg, curry), shirataki rice, 4 salmon sashimi — EB10 Eastwood', calories:740, protein:49, fat:42, carbs:37, notes:'Highest carb day (breading + curry sauce), occasional'},
      {date:'2026-08-07', fastHours:22.50, meal:'Grilled chicken/pork, 3 shrimp, beef slice, cheese, lettuce, kimchi', calories:1065, protein:101, fat:67, carbs:6, notes:'Best protein day so far — reference portion size'},
      {date:'2026-08-08', fastHours:26.22, meal:'Grilled pork (increased portion), cheese, broccoli, 4 okra, kimchi', calories:1184, protein:83, fat:83, carbs:18, notes:''}
    ];
    seedNutrition.forEach(e => saveNutritionDay(e));
  }

  // One-time backfill: Aug 9, 2026 nutrition + weigh-in (weighed portions, most accurate log yet)
  if(!nutritionLog.find(e => e.date === '2026-08-09')){
    saveNutritionDay({
      date:'2026-08-09',
      fastHours:17.58,
      meal:'Salmon (240g), mixed boiled veggies — okra/sitaw/pechay/cauliflower (340g), 3 boiled eggs, chicken tinola meat+broth (275g) — weighed portions',
      calories:985, protein:105, fat:50, carbs:23,
      notes:'Weighed with food scale — most accurate log yet. Strong protein, good variety, this meal structure is a great template going forward.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-09')){
    addWeighIn('2026-08-09', 95.05);
  }

  // One-time backfill: Aug 10, 2026 nutrition + weigh-in
  if(!nutritionLog.find(e => e.date === '2026-08-10')){
    saveNutritionDay({
      date:'2026-08-10',
      fastHours:21.47,
      meal:'Steak (pepper/salt, butter-garlic seared, 220g), beef nilaga meat (177g) + soup (120g), cabbage (180g), lettuce (150g) — weighed portions',
      calories:925, protein:96, fat:51, carbs:15,
      notes:'Third straight day of weighed portions — accuracy is solid, the gap now is genuinely volume, not measurement error. 96g protein is 44g short of even the lower sedentary floor (140g); calories 925 also well under. Two good beef sources here (steak + nilaga) but combined portion still landed light — next time, push the steak or nilaga meat portion up by ~100-150g, or add a third protein source, to close the gap in one sitting rather than needing a second meal.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-10')){
    addWeighIn('2026-08-10', 95.10);
  }

  // One-time backfill: Aug 11, 2026 nutrition + weigh-in (office day)
  if(!nutritionLog.find(e => e.date === '2026-08-11')){
    saveNutritionDay({
      date:'2026-08-11',
      fastHours:18.70,
      meal:'Seared fish/pork cubes (~250g), sitsaro + upo (~200g), ginataang langka with shrimp (230g), 2 boiled eggs — office day',
      calories:935, protein:73, fat:56, carbs:27,
      notes:'Ginataan (coconut milk) sauce adds fat/calories vs. plain sauté — still a reasonable protein showing for an office day, though below the sedentary floor (140g). Moderate carbs from the langka, still under the 30g ceiling.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-11')){
    addWeighIn('2026-08-11', 95.40);
  }

  // One-time backfill: Aug 12, 2026 nutrition + weigh-in
  if(!nutritionLog.find(e => e.date === '2026-08-12')){
    saveNutritionDay({
      date:'2026-08-12',
      fastHours:23.42,
      meal:'Blue marlin butter/garlic sauté (234g), boiled kangkong (112g), boiled okra (110g), 2 boiled eggs, plain yogurt made from fresh cow\'s milk (~120g, not strained/Greek-style) + 3 strawberries',
      calories:755, protein:75, fat:37, carbs:20,
      notes:'Longest fast yet (23h25m) after two training sessions the day before. Protein corrected down from an initial 83g — the yogurt was fresh-milk based, not strained Greek yogurt, so its protein density is closer to regular yogurt (~4g/100g) than Greek (~10g/100g). Both calories and protein are under the sedentary floor — a long fast on top of a two-session prior day makes hitting the target today more important than usual, not less.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-12')){
    addWeighIn('2026-08-12', 95.10);
  }

  // One-time backfill: Aug 13, 2026 weigh-in
  if(!weighIns.find(w => w.date === '2026-08-13')){
    addWeighIn('2026-08-13', 94.65);
  }
  // Patch: correct Aug 13 weigh-in to the precise AM reading (94.65) if an earlier rounded value was logged
  if(weighIns.find(w => w.date === '2026-08-13' && w.kg !== 94.65)){
    addWeighIn('2026-08-13', 94.65);
  }

  // One-time backfill: Aug 14, 2026 nutrition + weigh-in
  if(!nutritionLog.find(e => e.date === '2026-08-14')){
    saveNutritionDay({
      date:'2026-08-14',
      fastHours:24.17,
      meal:'Steak butter/garlic/pepper (200g), chicken breast butter/garlic/pepper (134g), okra (90g), upo (97g), petsay (140g), pepino (100g), 2 boiled eggs, Che-Vital cheese (25g), Greek yogurt (190g), 2 grapes',
      calories:1227, protein:127, fat:66, carbs:29.7,
      notes:'Best day yet by a clear margin — 127g protein and 1,227 kcal is the closest you\'ve come to the sedentary floor (140-150g / 1600-1800), and would clear the floor entirely on a rest day with just a bit more. Two protein sources (steak + chicken) plus real vegetable variety — worth using as the new baseline template rather than the exception.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-14')){
    addWeighIn('2026-08-14', 94.15);
  }

  // One-time backfill: Aug 16, 2026 weigh-in (Huawei body fat scale)
  if(!weighIns.find(w => w.date === '2026-08-16')){
    addWeighIn('2026-08-16', 93.55);
  }

  // One-time backfill: Aug 17, 2026 weigh-in
  if(!weighIns.find(w => w.date === '2026-08-17')){
    addWeighIn('2026-08-17', 93.75);
  }

  // One-time backfill: Aug 18, 2026 nutrition + weigh-in
  if(!nutritionLog.find(e => e.date === '2026-08-18')){
    saveNutritionDay({
      date:'2026-08-18',
      fastHours:21.33,
      meal:'Boiled cabbage + sitaw (200g), blue marlin butter/garlic/pepper (173g), chicken fillet butter/garlic/pepper (177g), 1 boiled egg, homemade thick/sour Greek-style yogurt (200g), chia seeds (14g), watermelon (97g)',
      calories:1070, protein:112.6, fat:53, carbs:31.5,
      notes:'Solid, well-rounded day — two lean protein sources (fish + chicken) plus egg and yogurt, genuine homemade Greek-style yogurt this time (confirmed thick/strained, unlike the earlier mix-ups). Carbs land just over the 30g ceiling (31.5g gross, ~28.5g net with chia fiber) — close enough to call negligible, watermelon the main contributor. Protein and calories both still under the sedentary floor, though the gap is smaller than the lower end of the range seen earlier in the log.'
    });
  }
  // Patch: revise Aug 18 to the final numbers including almonds and Pringles, if not already reflected
  const aug18Entry = nutritionLog.find(e => e.date === '2026-08-18');
  if(aug18Entry && parseFloat(aug18Entry.calories) !== 1605){
    saveNutritionDay({
      date:'2026-08-18',
      fastHours:21.33,
      meal:'Boiled cabbage + sitaw (200g), blue marlin butter/garlic/pepper (173g), chicken fillet butter/garlic/pepper (177g), 1 boiled egg, homemade thick/sour Greek-style yogurt (200g), chia seeds (14g), watermelon (97g), almonds (20g), Pringles Original (half can, ~79g)',
      calories:1605, protein:120, fat:91, carbs:77.5,
      notes:'Updated with almonds and half a can of Pringles added later — carbs jumped to 77.5g (over 2.5x the 30g ceiling) and fat to 91g, both driven by the Pringles specifically. Calories now actually land inside the sedentary floor range (1600-1800) for the first time purely from a meal-plus-snack combo, though the composition (fat and refined carbs from a processed snack) isn’t the same quality as a protein-driven day hitting the same number. Protein still 20g under floor. Second high-carb/high-fat snack incident in a few days — worth noticing if Pringles specifically becomes a recurring choice, given the fatty liver history.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-18')){
    addWeighIn('2026-08-18', 93.70);
  }

  // One-time backfill: Aug 19, 2026 nutrition + weigh-in
  if(!nutritionLog.find(e => e.date === '2026-08-19')){
    saveNutritionDay({
      date:'2026-08-19',
      fastHours:17.00,
      meal:'Meal 1 (lunch, business): Gyu King Ramen Nagi (¾ eaten, soup mostly finished), extra tamago egg, 3 pork gyoza, small plain popcorn. Meal 2 (dinner): Sinigang na bangus (230g fish + 100g sabaw), boiled talong (130g), boiled okra (112g), fried pork jowl (122g). Meal 3: Homemade thick Greek yogurt (180g), chia seeds (12g), watermelon (100g).',
      calories:2306, protein:158.1, fat:118, carbs:151,
      notes:'First day to clear the workout-tier protein floor (158g vs. 150-160g) regardless of whether a workout was logged — genuinely the best protein number in the whole log. Came from a rare 3-meal day (business lunch broke the usual single-meal pattern) rather than the usual multi-protein-single-sitting approach. Trade-off: carbs (151g) are 5x the usual ceiling — ramen, gyoza wrappers, and popcorn all contributed — and sodium is estimated at ~3,900mg+, well above typical daily recommendations (~2,300mg), driven by the ramen broth and sinigang combined. Calories also the second-highest in the log after the Aug 16 cheat day. Not a bad day nutritionally on protein, but the carb/sodium load is real and worth noting rather than only celebrating the protein win.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-19')){
    addWeighIn('2026-08-19', 93.65);
  }

  // One-time backfill: Aug 18, 2026 indoor walk (Cardio Steady day, rain kept it indoors)
  if(!historyLog.find(e => e.date === '2026-08-18' && e.day === 'steady')){
    checkedState['2026-08-18_steady_done'] = true;
    saveChecked();
    upsertSessionLog('2026-08-18', 'steady', [], 'Rain kept this indoors — back-and-forth walking inside the house instead of the usual route. 421 active kcal of 539 total, 118 bpm avg HR (max 142), aerobic training stress 2.2, 3h recovery. HR zones: 56 min fat-burning, 5 min aerobic, 14 min warm-up. HR recovery dropped 115→04 (-11) — a real, more believable reading this time, closer to what a proper cooldown window should show.', {
      distance: '5.04',
      duration: '01:18:51',
      calories: '539',
      hr: '118',
      pace: '15\'39"',
      steps: '8011'
    });
  }

  // One-time log: Aug 16, 2026 — rest day as scheduled, completed as planned
  if(!historyLog.find(e => e.date === '2026-08-16' && e.day === 'custom' && e.notes && e.notes.includes('Rest day'))){
    logCustomEntry('2026-08-16', 'Rest day as scheduled — completed as planned. Sunday rest per the weekly plan.');
  }

  // One-time backfill: Aug 17, 2026 Strength A session from Huawei Fit + on-screen checklist
  if(!historyLog.find(e => e.date === '2026-08-17' && e.day === 'A')){
    const strengthAExercisesAug17 = [
      {id:'a1', name:'Goblet Squat', weight:'5'},
      {id:'a2', name:'Dumbbell Row (bent over)', weight:'14.5'},
      {id:'a3', name:'Push-up (knees if needed)', weight:''},
      {id:'a4', name:'Dumbbell Shoulder Press', weight:'10'},
      {id:'a5', name:'Romanian Deadlift', weight:'14.5'},
      {id:'a6', name:'Plank', weight:''},
      {id:'a7', name:'Bicycle Crunch', weight:''},
      {id:'a8', name:'Lying Leg Raise', weight:''}
    ];
    strengthAExercisesAug17.forEach(ex=>{
      checkedState[ex.id] = true;
      if(ex.weight){
        window.savedWeights = window.savedWeights || {};
        window.savedWeights[ex.id] = ex.weight;
      }
    });
    saveChecked();
    saveWeights();
    checkedState['2026-08-17_A_done'] = true;
    saveChecked();
    upsertSessionLog(
      '2026-08-17', 'A',
      strengthAExercisesAug17.map(ex=>({name: ex.name, weight: ex.weight})),
      '679 active kcal of 806 total, 124 bpm avg HR (max 154), aerobic training stress 2.7, 7h recovery. HR zones: 42 min fat-burning, 34 min aerobic, 3 min anaerobic, 4 min warm-up. HR recovery showed 0 bpm drop (113→113) — likely from stopping the watch too late rather than a real fitness signal, similar to the Aug 15 timing issue; worth applying the same fix (stay still 1-2 min before stopping tracking) to get a reading that actually means something.',
      {duration: '01:25:36', calories: '806', hr: '124'}
    );
    logCustomEntry('2026-08-17', 'Added 200 small short skips, jumprope style, alongside Strength A.');
  }

  // One-time backfill: Aug 17, 2026 nutrition
  if(!nutritionLog.find(e => e.date === '2026-08-17')){
    saveNutritionDay({
      date:'2026-08-17',
      fastHours:21.75,
      meal:'Boiled kangkong (189g), 2 boiled eggs, Chooks-to-Go roasted chicken with skin and sauce (420g), yellowfin fish from ginataang isda (100g), almond nuts (16 pcs)',
      calories:1310, protein:145, fat:71, carbs:14.5,
      notes:'Right back to the normal pattern after yesterday’s cheat day, exactly as planned — no overcorrection, no skipped meal, just a straightforward return to form. 145g protein clears the sedentary floor (140g) again, third time this has happened in the log. Carbs at 14.5g are among the lowest logged, consistent with the low-carb approach. Good template day: one big multi-protein meal (chicken + fish + eggs) doing the work.'
    });
  }

  // One-time backfill: Aug 16, 2026 nutrition (corrected final)
  if(!nutritionLog.find(e => e.date === '2026-08-16')){
    saveNutritionDay({
      date:'2026-08-16',
      fastHours:20.17,
      meal:'Steak seared dairy cream butter/garlic/pepper (275g), salmon seared dairy cream butter/garlic/pepper (125g eaten, 68g leftover), boiled okra (186g), boiled cabbage (149g eaten, 67g leftover), chia seeds (14g), watermelon (106g), Pascual Plain Sweetened Yogurt with Cream (100g)',
      calories:1177, protein:102, fat:64, carbs:48,
      notes:'Carbs (48g gross, ~45g net) are the highest in the whole log, clearly over the 30g ceiling — watermelon plus a sweetened (not plain) yogurt this time accounts for most of it. Worth noting as a one-off rather than a new normal. Protein came in lighter than the Aug 14-15 template (102g vs. 140+g) — still under the sedentary floor by a wider margin than recent days.'
    });
  }
  // Patch: revise Aug 16 nutrition to the corrected final numbers if an earlier draft was already saved
  const aug16Entry = nutritionLog.find(e => e.date === '2026-08-16');
  if(aug16Entry && parseFloat(aug16Entry.calories) !== 1177 && parseFloat(aug16Entry.calories) !== 2167){
    saveNutritionDay({
      date:'2026-08-16',
      fastHours:20.17,
      meal:'Steak seared dairy cream butter/garlic/pepper (275g), salmon seared dairy cream butter/garlic/pepper (125g eaten, 68g leftover), boiled okra (186g), boiled cabbage (149g eaten, 67g leftover), chia seeds (14g), watermelon (106g), Pascual Plain Sweetened Yogurt with Cream (100g)',
      calories:1177, protein:102, fat:64, carbs:48,
      notes:'Revised final — watermelon and sweetened yogurt (not plain Greek) replace the earlier draft. Carbs (48g gross, ~45g net) are the highest in the whole log, clearly over the 30g ceiling. Protein came in lighter than the Aug 14-15 template (102g vs. 140+g) — still under the sedentary floor by a wider margin than recent days.'
    });
  }
  // Patch: revise Aug 16 to the full day including the cheat meal, if not already reflected
  const aug16EntryV2 = nutritionLog.find(e => e.date === '2026-08-16');
  if(aug16EntryV2 && parseFloat(aug16EntryV2.calories) !== 2167){
    saveNutritionDay({
      date:'2026-08-16',
      fastHours:20.17,
      meal:'Meal 1: Steak seared dairy cream butter/garlic/pepper (275g), salmon seared dairy cream butter/garlic/pepper (125g eaten), boiled okra (186g), boiled cabbage (149g eaten), chia seeds (14g), watermelon (106g), Pascual Plain Sweetened Yogurt with Cream (100g). Meal 2 (cheat): Lucky Me Pancit Canton Sweet & Spicy x2 packs (120g), 1 fried egg, ~30 Pringles Original (~60g), 10 sunflower seeds (shelled)',
      calories:2167, protein:124.5, fat:116.5, carbs:158,
      notes:'Full day including a cheat meal — carbs (158g gross, ~155g net) are more than 5x the usual 30g ceiling, and calories/fat both land well above even the workout-day upper range. One day like this isn\'t going to undo two and a half weeks of consistent deficit, so no need to panic-compensate tomorrow — just note it plainly and get back to the normal pattern. Worth being a little more aware of going forward given the fatty liver history specifically: it\'s the frequency of days like this that matters more than any single one.'
    });
  }

  // One-time backfill: Aug 14, 2026 outdoor run (Cardio Intervals day, rain-limited pace)
  if(!historyLog.find(e => e.date === '2026-08-14' && e.day === 'interval')){
    checkedState['2026-08-14_interval_done'] = true;
    saveChecked();
    upsertSessionLog('2026-08-14', 'interval', [], 'Outdoor run/walk, kept continuous rather than true intervals due to rain — wet, slippery pavement made faster pushes unsafe, so pace stayed steady and cautious instead. Still a long, genuinely demanding session at 1h26m and 5.09km. Aerobic training stress 2.4 ("fitness maintained").', {
      distance: '5.09',
      duration: '01:25:54',
      calories: '538',
      hr: '120',
      pace: '16\'53"',
      steps: '9363'
    });
  }

  // One-time backfill: Aug 15, 2026 nutrition + weigh-in (revised final)
  if(!nutritionLog.find(e => e.date === '2026-08-15')){
    saveNutritionDay({
      date:'2026-08-15',
      fastHours:26.17,
      meal:'Broccoli boiled (183g), Japanese string beans boiled (118g), steak butter/garlic/pepper (255g), blue marlin butter/garlic/pepper (204g), pork steak butter/garlic/pepper (157g, fattier cut), 1 boiled egg, 4 small strawberries',
      calories:1430, protein:142, fat:84, carbs:29.5,
      notes:'First day to actually clear the protein floor (142g vs. the 140g sedentary minimum) — three protein sources in one sitting (steak, fish, pork) is what did it, same principle as the Aug 14 breakthrough, just pushed further. Fat is notably higher than usual (84g, from the fattier pork cut) — worth a glance given the fatty liver history, though one day isn\'t a pattern. Calories still under floor, but this is the clearest proof yet that hitting target is achievable with the right meal structure, not a matter of needing to eat impractically large single-source portions.'
    });
  }
  // Patch: revise Aug 15 nutrition to the corrected final numbers if an earlier draft was already saved
  const aug15Entry = nutritionLog.find(e => e.date === '2026-08-15');
  if(aug15Entry && parseFloat(aug15Entry.calories) !== 1430){
    saveNutritionDay({
      date:'2026-08-15',
      fastHours:26.17,
      meal:'Broccoli boiled (183g), Japanese string beans boiled (118g), steak butter/garlic/pepper (255g), blue marlin butter/garlic/pepper (204g), pork steak butter/garlic/pepper (157g, fattier cut), 1 boiled egg, 4 small strawberries',
      calories:1430, protein:142, fat:84, carbs:29.5,
      notes:'Revised final numbers — pork portion corrected to 157g (fattier cut) and strawberries added. First day to actually clear the protein floor (142g vs. the 140g sedentary minimum) — three protein sources in one sitting (steak, fish, pork) is what did it. Fat is notably higher than usual (84g) from the fattier pork cut — worth a glance given the fatty liver history, though one day isn\'t a pattern. Calories still under floor.'
    });
  }
  if(!weighIns.find(w => w.date === '2026-08-15')){
    addWeighIn('2026-08-15', 94.05);
  }

  // One-time backfill: Aug 15, 2026 Strength A session from Huawei Fit + on-screen checklist
  if(!historyLog.find(e => e.date === '2026-08-15' && e.day === 'A')){
    const strengthAExercisesAug15 = [
      {id:'a1', name:'Goblet Squat', weight:'5'},
      {id:'a2', name:'Dumbbell Row (bent over)', weight:'14.5'},
      {id:'a3', name:'Push-up (knees if needed)', weight:''},
      {id:'a4', name:'Dumbbell Shoulder Press', weight:'10'},
      {id:'a5', name:'Romanian Deadlift', weight:'14.5'},
      {id:'a6', name:'Plank', weight:''},
      {id:'a7', name:'Bicycle Crunch', weight:''},
      {id:'a8', name:'Lying Leg Raise', weight:''}
    ];
    strengthAExercisesAug15.forEach(ex=>{
      checkedState[ex.id] = true;
      if(ex.weight){
        window.savedWeights = window.savedWeights || {};
        window.savedWeights[ex.id] = ex.weight;
      }
    });
    saveChecked();
    saveWeights();
    checkedState['2026-08-15_A_done'] = true;
    saveChecked();
    const exercisesWithAddOn = strengthAExercisesAug15.map(ex=>({name: ex.name, weight: ex.weight}));
    exercisesWithAddOn.push({name:'Bicep Curl (barbell, added)', weight:'14.5 × 3 sets'});
    upsertSessionLog(
      '2026-08-15', 'A',
      exercisesWithAddOn,
      'Warm-up completed. 657 active kcal of 780 total, 125 bpm avg HR (max 153), aerobic training stress 2.7, 7h recovery. HR zones: 40 min aerobic, 33 min fat-burning, 2 min anaerobic, 5 min warm-up — solid time-in-zone spread for a strength session. HR recovery dropped 124→118 (only -3) in the first minute post-session, which is a fairly slow drop — worth watching over time as a fitness/recovery indicator, not urgent on its own.',
      {duration: '01:21:46', calories: '780', hr: '125'}
    );
    logCustomEntry('2026-08-15', 'Added 100 small/short skip jumps alongside Strength A.');
  }

  // One-time backfill: Aug 13, 2026 nutrition
  if(!nutritionLog.find(e => e.date === '2026-08-13')){
    saveNutritionDay({
      date:'2026-08-13',
      fastHours:22.08,
      meal:'Salmon butter/garlic/pepper seared (250g), lettuce (68g), chicharo boiled (138g), 2 boiled eggs, 4 small strawberries, Greek yogurt (~80g)',
      calories:778, protein:77, fat:42, carbs:19,
      notes:'Consistent with the recent run of meals — good protein-to-calorie efficiency, still under the sedentary floor on both counts. Genuine Greek yogurt this time per the log.'
    });
  }

  // One-time backfill: Aug 13, 2026 Strength B session from Huawei Fit + on-screen checklist
  if(!historyLog.find(e => e.date === '2026-08-13' && e.day === 'B')){
    const strengthBExercisesAug13 = [
      {id:'b1', name:'Reverse Lunge (dumbbells)', weight:'10'},
      {id:'b2', name:'Dumbbell Deadlift', weight:'14.5'},
      {id:'b3', name:'Incline Press (DB or Barbell)', weight:'14.5'},
      {id:'b4', name:'Lateral Raise', weight:'10'},
      {id:'b5', name:'Bicep Curl', weight:'10'},
      {id:'b6', name:'Bird-dog', weight:''},
      {id:'b7', name:'Weighted Russian Twist', weight:''},
      {id:'b8', name:'Mountain Climbers', weight:''}
    ];
    strengthBExercisesAug13.forEach(ex=>{
      checkedState[ex.id] = true;
      if(ex.weight){
        window.savedWeights = window.savedWeights || {};
        window.savedWeights[ex.id] = ex.weight;
      }
    });
    saveChecked();
    saveWeights();
    checkedState['2026-08-13_B_done'] = true;
    saveChecked();
    upsertSessionLog(
      '2026-08-13', 'B',
      strengthBExercisesAug13.map(ex=>({name: ex.name, weight: ex.weight})),
      'Warm-up completed. 644 active kcal of 769 total, 123 bpm avg HR, aerobic training stress 2.6, 6h recovery flagged. Mountain Climbers cut to 1 rep due to tummy cramps — worth watching if this recurs; could be dehydration, breaking a 22h fast into training too soon, or just needing a longer warm-up on core work specifically.',
      {duration: '01:22:46', calories: '769', hr: '123'}
    );
    logCustomEntry('2026-08-13', 'Added 150 reps of small skip jumping jacks alongside Strength B.');
  }

  // Patch: correct Aug 12 protein if entry already existed with the old (Greek yogurt) estimate
  const aug12Entry = nutritionLog.find(e => e.date === '2026-08-12');
  if(aug12Entry && parseFloat(aug12Entry.protein) === 83){
    saveNutritionDay({
      date: '2026-08-12',
      fastHours: aug12Entry.fastHours,
      meal: aug12Entry.meal.replace('Greek yogurt', 'plain yogurt made from fresh cow\'s milk (not strained/Greek-style)'),
      calories: aug12Entry.calories,
      protein: 75,
      fat: aug12Entry.fat,
      carbs: aug12Entry.carbs,
      notes: aug12Entry.notes + ' Corrected: protein revised from 83g to 75g after confirming the yogurt was fresh-milk based, not true strained Greek yogurt.'
    });
  }

  // One-time log: Aug 12, 2026 — rest day as scheduled, no workout
  if(!historyLog.find(e => e.date === '2026-08-12' && e.day === 'custom' && e.notes && e.notes.includes('Rest day'))){
    logCustomEntry('2026-08-12', 'Rest day as scheduled — no workout. Wednesday rest per the weekly plan.');
  }

  // One-time backfill: Aug 11, 2026 stair climbing (treadmill replacement — Cardio Steady day)
  if(!historyLog.find(e => e.date === '2026-08-11' && e.day === 'steady')){
    checkedState['2026-08-11_steady_done'] = true;
    saveChecked();
    upsertSessionLog('2026-08-11', 'steady', [], '3rd floor stair climbing, treadmill was broken. 72.0m total ascent, 1,814 steps — solid substitute for the usual steady walk.', {
      duration: '00:21:01',
      calories: '230',
      hr: '139',
      steps: '1814'
    });
  }

  // One-time backfill: Aug 11, 2026 toning add-on (lateral raise, curls, jumping jacks, bicycle kicks, plank)
  if(!historyLog.find(e => e.date === '2026-08-11' && e.day === 'custom' && e.notes && e.notes.includes('Lateral Raise'))){
    upsertSessionLog('2026-08-11', 'custom',
      [
        {name:'Lateral Raise', weight:'5kg × 3×10'},
        {name:'Bicep Curl', weight:'5kg × 3×12'},
        {name:'Jumping Jacks (light, imitating jump rope)', weight:'100 reps'},
        {name:'Bicycle Kicks', weight:'3×12'},
        {name:'Plank', weight:'2×25 sec'}
      ],
      'Light toning add-on after stair cardio, same day. 253 kcal, 135 bpm avg HR, 12h recovery flagged by watch — a real second session on top of the stairs, worth factoring into tomorrow&#39;s recovery.',
      {duration: '00:23:41', calories: '253', hr: '135'}
    );
  }

  // Patch: add Meiji Black Chocolate snack (1 block, ~10g) to Aug 10 entry if not already added
  const aug10Entry = nutritionLog.find(e => e.date === '2026-08-10');
  if(aug10Entry && !aug10Entry.meal.includes('Meiji')){
    saveNutritionDay({
      date: '2026-08-10',
      fastHours: aug10Entry.fastHours,
      meal: aug10Entry.meal + ' + Meiji Black Chocolate (1 block, ~10g)',
      calories: Math.round((parseFloat(aug10Entry.calories) || 0) + 57.6),
      protein: Math.round(((parseFloat(aug10Entry.protein) || 0) + 0.66) * 10) / 10,
      fat: Math.round(((parseFloat(aug10Entry.fat) || 0) + 3.94) * 10) / 10,
      carbs: Math.round(((parseFloat(aug10Entry.carbs) || 0) + 5.22) * 10) / 10,
      notes: aug10Entry.notes + ' Added a small chocolate block later — ~58 kcal, negligible protein (0.7g), mostly fat and sugar (~4.6g sugar). Carbs ticked up to ~20g, still under the 30g ceiling, but worth noting given the fatty liver history — occasional treats are fine, just keep them occasional rather than a daily habit.'
    });
  }

  // Patch: add 30 almonds (~35g) to Aug 10 entry if not already added
  const aug10EntryV2 = nutritionLog.find(e => e.date === '2026-08-10');
  if(aug10EntryV2 && !/almond/i.test(aug10EntryV2.meal)){
    saveNutritionDay({
      date: '2026-08-10',
      fastHours: aug10EntryV2.fastHours,
      meal: aug10EntryV2.meal + ' + 30 pcs roasted almonds (~35g)',
      calories: Math.round((parseFloat(aug10EntryV2.calories) || 0) + 200),
      protein: Math.round(((parseFloat(aug10EntryV2.protein) || 0) + 7.5) * 10) / 10,
      fat: Math.round(((parseFloat(aug10EntryV2.fat) || 0) + 17) * 10) / 10,
      carbs: Math.round(((parseFloat(aug10EntryV2.carbs) || 0) + 7.5) * 10) / 10,
      notes: aug10EntryV2.notes + ' Added 30 almonds — ~200 kcal, 7.5g protein, helps the gap more than the chocolate did but still not enough alone against the workout-day target.'
    });
  }

  // One-time backfill: Aug 10, 2026 indoor walk (Huawei Fit) — separate cardio session alongside today's Strength A
  if(!historyLog.find(e => e.date === '2026-08-10' && e.day === 'steady')){
    checkedState['2026-08-10_steady_done'] = true;
    saveChecked();
    upsertSessionLog('2026-08-10', 'steady', [], '', {
      distance: '1.46',
      duration: '26:51',
      calories: '215',
      hr: '129',
      pace: '18\'23"',
      steps: '1975'
    });
  }

  console.log('Owner data import complete. Reload the page to see it.');
})();
