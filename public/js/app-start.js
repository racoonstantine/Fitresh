function setDay(day){
  currentDay = day;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.day===day));
  if(day==='A' || day==='B'){
    document.getElementById('strengthBlock').style.display = 'block';
    document.getElementById('cardioBlock').style.display = 'none';
    renderStrength(day);
  } else {
    document.getElementById('strengthBlock').style.display = 'none';
    document.getElementById('cardioBlock').style.display = 'block';
    renderCardio(day);
  }
}

document.getElementById('tabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab');
  if(!btn) return;
  setDay(btn.dataset.day);
});

document.querySelector('[data-history-toggle="1"]').addEventListener('click', function(){
  const detail = document.querySelector('[data-history-detail="1"]');
  const open = detail.classList.toggle('open');
  this.classList.toggle('expanded', open);
});

// Today at a Glance cards navigate to their tab on click -- delegated on the grid
// containers (whose innerHTML gets rebuilt on every render) rather than per-card,
// and skipped when the click actually landed on an interactive control inside the
// card (Water's +/- buttons).
function wireGlanceCardNav(gridEl){
  if(!gridEl) return;
  gridEl.addEventListener('click', (e)=>{
    if(e.target.closest('button, input, select, a, textarea')) return;
    const card = e.target.closest('[data-nav-view]');
    if(!card) return;
    window.showView(card.dataset.navView);
  });
}
wireGlanceCardNav(document.getElementById('glanceGridTop'));
wireGlanceCardNav(document.getElementById('glanceGridMid'));

async function startApp(){
  // Theme: load saved preference (defaults to dark if none saved yet)
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'theme', false);
    if(res && res.value === 'light'){
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }catch(e){
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  document.getElementById('themeToggle').addEventListener('click', async ()=>{
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if(isDark){
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    try{ await window.storage.set(STORAGE_PREFIX + 'theme', isDark ? 'light' : 'dark', false); }catch(e){}
  });

  // Navigation: 5 peer tabs (Today/Body/Food/Train/Insights), shown as a top bar
  // on wide screens and a fixed bottom bar on narrow ones (see @media 760px).
  // Both bars are wired identically via the shared .tab-nav-btn/.bottom-nav-btn classes.
  const viewPanels = {
    today: 'panelToday', body: 'panelBody', food: 'panelNutrition',
    train: 'panelTrain', insights: 'panelInsights', account: 'panelAccount'
  };
  function showView(view){
    Object.entries(viewPanels).forEach(([key, id])=>{
      const el = document.getElementById(id);
      if(el) el.style.display = (key === view) ? 'block' : 'none';
    });
    document.querySelectorAll('.tab-nav-btn, .bottom-nav-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.getElementById('scrollArea').scrollTop = 0;
    if(view !== 'body'){
      // Weigh-in History defaults to collapsed and stays that way -- leaving
      // the Body tab always closes it back up rather than remembering it
      // was left open.
      const wiDetail = document.querySelector('[data-weighin-history-detail="1"]');
      const wiHead = document.querySelector('[data-weighin-history-toggle="1"]');
      if(wiDetail) wiDetail.classList.remove('open');
      if(wiHead) wiHead.classList.remove('expanded');
      weighInHistPage = 0;
    }
    if(view !== 'train'){
      collapseLogSessionPanel();
    }
    // Leaving the Food tab drops any half-finished search so it isn't still
    // open (with stale results) when the user comes back.
    if(view !== 'food') clearFoodSearch(true);
    if(view === 'body'){ renderBodyPlaceholders(); renderBodySleepCard(); renderWeightSection(); }
    if(view === 'train'){ renderDashboard(); renderTodaysSession(); }
    if(view === 'insights'){ renderInsights(); renderSummary(); }
    if(view === 'account') showAccountView(currentAccountView);
  }
  window.showView = showView;

  function onTabNavClick(e){
    const btn = e.target.closest('.tab-nav-btn, .bottom-nav-btn');
    if(!btn) return;
    showView(btn.dataset.view);
  }
  document.getElementById('tabNavTop').addEventListener('click', onTabNavClick);
  document.getElementById('tabNavBottom').addEventListener('click', onTabNavClick);
  document.querySelector('.topbar-brand').addEventListener('click', ()=> showView('today'));

  // Account sub-nav: Snapshot / My data / Goals / Account / Feedback
  const accountViewPanels = {
    snapshot: 'accountSnapshot', mydata: 'accountMyData',
    goals: 'accountGoals', settings: 'accountSettings', feedback: 'accountFeedback',
    admin: 'accountAdmin'
  };
  let currentAccountView = 'snapshot';
  function showAccountView(view){
    currentAccountView = view;
    Object.entries(accountViewPanels).forEach(([key, id])=>{
      const el = document.getElementById(id);
      if(el) el.style.display = (key === view) ? 'block' : 'none';
    });
    document.querySelectorAll('.subnav-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.accountView === view);
    });
    if(view === 'snapshot') renderAccountSnapshot();
    if(view === 'goals') renderAccountGoals();
    if(view === 'settings') renderAccountSettings();
    if(view === 'admin') renderAdminPanel();
  }
  window.showAccountView = showAccountView;
  document.getElementById('accountSubnav').addEventListener('click', (e)=>{
    const btn = e.target.closest('.subnav-btn');
    if(!btn) return;
    showAccountView(btn.dataset.accountView);
  });

  await loadState();
  await loadHistory();
  await loadWeighIns();
  await loadNutrition();
  await loadProfile();
  await loadFasting();
  await loadWater();
  await loadSleep();
  await loadSteps();
  await loadRecentFoods();
  await loadFavoriteFoods();
  await loadCustomWorkoutPlans();
  await loadTrainingPlan();
  if(window.loadWorkoutCatalog) await window.loadWorkoutCatalog();


  renderDashboard();
  renderHistory();
  renderWeekPlan();
  renderWeightSection();
  renderNutrition();
  renderFasting();
  renderTodaysSession();
  renderTally();
  renderBodyPlaceholders();
  renderBodySleepCard();
  document.getElementById('exportBtn').addEventListener('click', exportLogCSV);

  const customForm = document.getElementById('customForm');
  const customDate = document.getElementById('customDate');
  const customNotes = document.getElementById('customNotes');
  document.getElementById('addCustomBtn').addEventListener('click', ()=>{
    customDate.value = dateStrForOffset(0);
    customNotes.value = '';
    customForm.style.display = customForm.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('cancelCustomBtn').addEventListener('click', ()=>{
    customForm.style.display = 'none';
  });
  document.getElementById('saveCustomBtn').addEventListener('click', ()=>{
    if(!customNotes.value.trim()) return;
    logCustomEntry(customDate.value || dateStrForOffset(0), customNotes.value.trim());
    customForm.style.display = 'none';
    renderHistory();
    renderDashboard();
  });

  document.getElementById('weighInDate').value = dateStrForOffset(0);
  document.getElementById('addWeighInBtn').addEventListener('click', ()=>{
    const dateInput = document.getElementById('weighInDate');
    const kgInput = document.getElementById('weighInKg');
    const kg = displayWeightToKg(kgInput.value);
    if(!kg || kg <= 0) return;
    addWeighIn(dateInput.value || dateStrForOffset(0), kg);
    kgInput.value = '';
    dateInput.value = dateStrForOffset(0);
    weighInHistPage = 0;
    renderWeightSection();
    renderTodayGlance();
  });

  document.querySelector('[data-weighin-history-toggle="1"]').addEventListener('click', function(){
    const detail = document.querySelector('[data-weighin-history-detail="1"]');
    const open = detail.classList.toggle('open');
    this.classList.toggle('expanded', open);
  });
  document.getElementById('weighInHistPrev').addEventListener('click', ()=>{
    weighInHistPage++;
    renderWeightSection();
  });
  document.getElementById('weighInHistNext').addEventListener('click', ()=>{
    weighInHistPage--;
    renderWeightSection();
  });

  document.getElementById('summaryRange').addEventListener('change', renderSummary);
  document.getElementById('nutriRange').addEventListener('change', renderNutrition);
  document.getElementById('dashRange').addEventListener('change', renderDashboard);

  const BACKUP_RESOURCES = ['nutrition', 'weighins', 'history', 'checked', 'weights', 'theme', 'profile', 'fasting', 'water', 'sleep', 'steps', 'recentFoods', 'favoriteFoods', 'workoutPlan', 'trainingPlan', 'customWorkoutPlans'];

  document.getElementById('exportBackupBtn').addEventListener('click', async ()=>{
    const backup = {};
    for(const resource of BACKUP_RESOURCES){
      const res = await window.storage.get(STORAGE_PREFIX + resource);
      backup[resource] = res ? res.value : null;
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full-circle-backup-${dateStrForOffset(0)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('importBackupBtn').addEventListener('click', ()=>{
    document.getElementById('importBackupFile').click();
  });
  document.getElementById('importBackupFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const status = document.getElementById('backupStatus');
    const reader = new FileReader();
    reader.onload = async ()=>{
      try{
        const data = JSON.parse(reader.result);
        for(const resource of BACKUP_RESOURCES){
          if(data[resource] !== null && data[resource] !== undefined){
            await window.storage.set(STORAGE_PREFIX + resource, data[resource]);
          }
        }
        status.style.color = 'var(--forest-dark)';
        status.textContent = 'Restored ✓ — reloading...';
        status.style.display = 'block';
        setTimeout(()=> location.reload(), 800);
      }catch(err){
        status.style.color = '#B4472A';
        status.textContent = 'Could not read that file — is it a backup exported from this app?';
        status.style.display = 'block';
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('importStructuredBtn').addEventListener('click', ()=>{
    document.getElementById('importStructuredFile').click();
  });
  document.getElementById('importStructuredFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const status = document.getElementById('importStructuredStatus');
    const reader = new FileReader();
    reader.onload = async ()=>{
      try{
        const data = JSON.parse(reader.result);
        status.style.color = 'var(--forest-dark)';
        status.style.display = 'block';
        await importStructuredData(data, status);
      }catch(err){
        status.style.color = '#B4472A';
        status.textContent = 'Could not read that file — check it matches the import schema (data-import-schema.md).';
        status.style.display = 'block';
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

