// supabase.js – חיבור מטפל ל-Supabase

const SUPABASE_URL  = 'https://ndnucfbchdxyhvpazxwe.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kbnVjZmJjaGR4eWh2cGF6eHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTAzNDAsImV4cCI6MjA5MDQyNjM0MH0.tuEpBl64HUvIU_f8u_N4DX-s8m40piHsTcv0QWITViU';

let db = null;
let currentUser   = null;
let currentWorker = null;

function safeToast(msg) {
  if (typeof toast === 'function') toast(msg);
  else setTimeout(() => { if (typeof toast === 'function') toast(msg); }, 600);
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    const { createClient } = window.supabase;
    db = createClient(SUPABASE_URL, SUPABASE_ANON);
    db.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user ?? null;
      updateAuthUI();
      if (currentUser) await onUserLoggedIn();
    });
    db.auth.getSession().then(({ data: { session } }) => {
      if (!session) setTimeout(showLoginScreen, 300);
    });
  } catch(e) { console.warn('Supabase init failed:', e); }
});

function showLoginScreen() {
  const s = document.getElementById('screen-login');
  if (s) s.style.display = 'block';
}

function closeLoginScreen() {
  const s = document.getElementById('screen-login');
  if (s) s.style.display = 'none';
  if (typeof showScreen === 'function') {
    const active = document.querySelector('.screen.active');
    if (!active) showScreen('screen-guide');
  }
}

function updateAuthUI() {
  const btn     = document.getElementById('auth-btn');
  const syncBtn = document.getElementById('sync-cloud-btn');
  if (!btn) return;
  if (currentUser) {
    const name = currentUser.email?.split('@')[0] || 'מחובר';
    btn.textContent = `✓ ${name}`;
    btn.onclick = () => { if (confirm('להתנתק?')) signOut(); };
    closeLoginScreen();
    if (syncBtn) syncBtn.style.display = 'inline-flex';
  } else {
    btn.textContent = '👤 כניסה';
    btn.onclick = () => showLoginScreen();
    if (syncBtn) syncBtn.style.display = 'none';
  }
}

async function signInWithGoogle() {
  if (!db) { safeToast('Supabase לא זמין'); return; }
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) safeToast('שגיאה: ' + error.message);
}

async function doLogin() {
  if (!db) { safeToast('Supabase לא זמין'); return; }
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const msg      = document.getElementById('login-msg');
  if (!email || !email.includes('@')) { safeToast('נא להכניס אימייל תקין'); return; }
  if (password) {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) safeToast('שגיאה: ' + error.message);
    else closeLoginScreen();
  } else {
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    if (error) safeToast('שגיאה: ' + error.message);
    else if (msg) { msg.textContent = '✓ נשלח קישור למייל ' + email; msg.style.display = 'block'; }
  }
}

async function signInWithEmailOrPassword() { await doLogin(); }

async function signInWithEmail(email) {
  if (!db) { safeToast('Supabase לא זמין'); return; }
  if (!email?.includes('@')) { safeToast('נא להכניס אימייל תקין'); return; }
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
  if (error) safeToast('שגיאה: ' + error.message);
  else safeToast('✓ נשלח קישור למייל ' + email);
}

async function signOut() {
  if (!db) return;
  try {
    await Promise.race([
      db.auth.signOut({ scope: 'local' }),
      new Promise(r => setTimeout(r, 2000))
    ]);
  } catch(e) { console.warn('signOut error:', e.message); }

  // נקה מצב מלא
  currentUser   = null;
  currentWorker = null;
  localStorage.removeItem('shakaron_premium');
  localStorage.removeItem('shakaron_worker_id');
  localStorage.removeItem('shakaron_data');
  // נקה סשן Supabase ידנית
  localStorage.removeItem('sb-ndnucfbchdxyhvpazxwe-auth-token');

  // נקה appData לחלוטין
  if (typeof appData !== 'undefined') {
    appData.worker  = {};
    appData.months  = {};
    appData.rates   = {};
    appData.profile = null;
  }

  // רענן ממשק
  if (typeof updateWorkerStats  === 'function') updateWorkerStats();
  if (typeof renderMonthsList   === 'function') renderMonthsList();
  if (typeof populateWorkerForm === 'function') populateWorkerForm();
  if (typeof applyAdminUI       === 'function') applyAdminUI();

  updateAuthUI();
  showLoginScreen();
  safeToast('התנתקת בהצלחה');
}

async function onUserLoggedIn() {
  if (!db || !currentUser) return;
  safeToast('✓ מחובר כ-' + (currentUser.email || 'משתמש'));

  const meta   = currentUser.app_metadata || {};
  const plan   = meta.plan || 'free';
  const until  = meta.plan_until ? new Date(meta.plan_until) : null;
  const isPrem = plan === 'premium' && (!until || until > new Date());

  localStorage.setItem('shakaron_premium', isPrem ? 'true' : 'false');
  if (typeof appData !== 'undefined') appData.profile = { plan, plan_until: meta.plan_until };

  if (isPrem) {
    safeToast('⭐ פרימיום פעיל!');
    setTimeout(() => { if (typeof applyPlanGates === 'function') applyPlanGates(); }, 300);
  } else {
    try {
      const { data: profile } = await db.from('profiles').select('plan, plan_until').eq('email', currentUser.email).maybeSingle();
      if (profile?.plan === 'premium') {
        const pUntil = profile.plan_until ? new Date(profile.plan_until) : null;
        if (!pUntil || pUntil > new Date()) {
          localStorage.setItem('shakaron_premium', 'true');
          if (typeof appData !== 'undefined') appData.profile = profile;
          safeToast('⭐ פרימיום פעיל!');
          setTimeout(() => { if (typeof applyPlanGates === 'function') applyPlanGates(); }, 300);
        }
      }
    } catch(e) { console.log('profiles check skipped:', e.message); }
  }

  try {
    const { data: workers, error: wErr } = await db.from('workers').select('*')
      .eq('user_id', currentUser.id).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(1);
    if (wErr) console.error('Worker load error:', wErr.message);
    if (workers?.length > 0) {
      currentWorker = workers[0];
      localStorage.setItem('shakaron_worker_id', currentWorker.id);
      await loadWorkerData(currentWorker.id);
      console.log('✓ Worker loaded:', currentWorker.name);
    }
  } catch(e) { console.error('Worker load exception:', e.message); }

  setTimeout(() => {
    if (typeof updateWorkerStats === 'function') updateWorkerStats();
    if (typeof updateVacBar === 'function') updateVacBar();
    if (typeof renderMonthsList === 'function') renderMonthsList();
    if (typeof populateWorkerForm === 'function') populateWorkerForm();
    if (typeof applyAdminUI === 'function') applyAdminUI();
  }, 200);
}

async function saveWorkerToDb() {
  appData.worker = {
    name:         v('w-name'),
    passport:     v('w-passport'),
    nationality:  v('w-nationality') || 'india',
    startDate:    v('w-start') || null,
    visaDate:     v('w-visa')  || null,
    phone:        v('w-phone'),
    baseSalary:   parseFloat(v('w-base'))           || 0,
    shabbatBonus: parseFloat(v('w-shabbat-bonus'))  || 0,
    holidayBonus: parseFloat(v('w-holiday-bonus'))  || 0,
    vacTotal:     parseInt(v('w-vac-total'))         || 0,
    holTotal:     parseInt(v('w-hol-total'))         || 0,
    sickTotal:    parseInt(v('w-sick-total'))        || 0,
  };
  saveLocal();
  updateWorkerStats();
  updateVacBar();
  if (!db) return;

  const workerData = {
    name: appData.worker.name, passport: appData.worker.passport,
    nationality: appData.worker.nationality, start_date: appData.worker.startDate,
    visa_date: appData.worker.visaDate, phone: appData.worker.phone,
    base_salary: appData.worker.baseSalary, shabbat_bonus: appData.worker.shabbatBonus,
    holiday_bonus: appData.worker.holidayBonus, vac_total: appData.worker.vacTotal,
    hol_total: appData.worker.holTotal, sick_total: appData.worker.sickTotal,
  };
  if (currentUser?.id) workerData.user_id = currentUser.id;

  let result;
  if (currentWorker?.id) {
    result = await db.from('workers').update(workerData).eq('id', currentWorker.id).select().single();
  } else if (workerData.passport) {
    const { data: existing } = await db.from('workers').select('id').eq('passport', workerData.passport).maybeSingle();
    if (existing) {
      currentWorker = existing;
      result = await db.from('workers').update(workerData).eq('id', existing.id).select().single();
    } else {
      result = await db.from('workers').insert(workerData).select().single();
    }
  } else {
    result = await db.from('workers').insert(workerData).select().single();
  }

  if (result?.error) { console.error('Worker save error:', result.error.message); return; }
  if (result?.data) {
    currentWorker = result.data;
    localStorage.setItem('shakaron_worker_id', currentWorker.id);
  }
}

function workerFromDb(row) {
  return {
    name: row.name, passport: row.passport, nationality: row.nationality,
    startDate: row.start_date, visaDate: row.visa_date, phone: row.phone,
    baseSalary: row.base_salary, shabbatBonus: row.shabbat_bonus,
    holidayBonus: row.holiday_bonus, vacTotal: row.vac_total,
    holTotal: row.hol_total, sickTotal: row.sick_total,
  };
}

async function saveRatesToDb() {
  const havraRate = parseFloat(v('r-havra-rate')) || 0;
  const havraDays = (typeof calcHavraDays === 'function') ? calcHavraDays(appData.worker?.startDate) : 6;

  appData.rates = {
    bituach:   parseFloat(v('r-bituach'))   || 0,
    pension:   parseFloat(v('r-pension'))   || 0,
    severance: parseFloat(v('r-severance')) || 8.33,
    havraDays, havraRate,
    havraMonth:   v('r-havra-month') || '7',
    havraMonthly: (havraDays * havraRate) / 12,
    havraAnnual:   havraDays * havraRate,
  };

  saveLocal();
  if (typeof renderCostsScreen === 'function') renderCostsScreen();
  if (typeof renderModalEmployerCosts === 'function') renderModalEmployerCosts();

  if (!db || !currentWorker?.id) { safeToast('⚠️ נשמר מקומית — אין חיבור לענן'); return; }

  const { error } = await db.from('rates').upsert({
    worker_id: currentWorker.id, bituach: appData.rates.bituach,
    pension: appData.rates.pension, severance: appData.rates.severance || 8.33, havra_days: havraDays, havra_rate: havraRate,
  }, { onConflict: 'worker_id' });

  const msg = document.getElementById('rates-save-msg');
  if (error) { safeToast('⚠️ שגיאת שמירה: ' + error.message); }
  else {
    safeToast('✓ הגדרות נשמרו');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
  }
}

// ── שמירת חודש — select + insert/update (ללא upsert) ──────────
async function saveMonthToDb() {
  const key = v('m-month');
  if (!key) { safeToast('בחר חודש'); return; }

  const monthObj = {
    base:          parseFloat(v('m-base'))     || 0,
    expenses:      parseFloat(v('m-expenses')) || 0,
    havra:         parseFloat(v('m-havra'))    || 0,
    vacDays:       parseInt(v('m-vac-days'))   || 0,
    notes:         v('m-notes'),
    shabbats:      [...calState.workedShabbats],
    holidays:      [...calState.workedHolidays],
    customVacDays: [...calState.customVacDays],
  };

  appData.months[key] = monthObj;
  saveLocal();
  renderMonthsList();
  updateWorkerStats();
  updateVacBar();
  closeModal();
  safeToast('החודש נשמר ✓');

  if (!db) return;
  if (!currentWorker?.id) {
    const cachedId = localStorage.getItem('shakaron_worker_id');
    if (cachedId) currentWorker = { id: cachedId };
  }
  if (!currentWorker?.id) return;

  const monthData = {
    worker_id:       currentWorker.id,
    month_key:       key,
    base:            monthObj.base,
    expenses:        monthObj.expenses,
    havra:           monthObj.havra,
    vac_days:        monthObj.vacDays,
    notes:           monthObj.notes,
    shabbats:        monthObj.shabbats    || [],
    holidays:        monthObj.holidays    || [],
    custom_vac_days: monthObj.customVacDays || [],
  };

  try {
    const { data: existing } = await db.from('months')
      .select('id').eq('worker_id', currentWorker.id).eq('month_key', key).maybeSingle();

    let error;
    if (existing?.id) {
      const r = await db.from('months').update({
        base: monthData.base, expenses: monthData.expenses, havra: monthData.havra,
        vac_days: monthData.vac_days, notes: monthData.notes,
        shabbats: monthData.shabbats, holidays: monthData.holidays,
        custom_vac_days: monthData.custom_vac_days,
      }).eq('id', existing.id);
      error = r.error;
    } else {
      const r = await db.from('months').insert(monthData);
      error = r.error;
    }

    if (error) {
      console.error('Month save error:', error.message);
      safeToast('⚠️ שגיאת שמירה לענן — נשמר מקומית');
    } else {
      console.log('✓ Month saved:', key);
    }
  } catch(e) {
    console.error('Month save exception:', e.message);
  }
}

async function deleteMonthFromDb(key) {
  if (!key) key = document.getElementById('editing-month-key')?.value;
  if (!key) return;
  if (!confirm('למחוק את חודש ' + key + '?')) return;

  if (appData.months[key]) {
    delete appData.months[key];
    saveLocal();
    renderMonthsList();
    updateWorkerStats();
    updateVacBar();
  }
  closeModal();
  safeToast('החודש נמחק');

  if (!db) return;
  if (!currentWorker?.id) {
    const cachedId = localStorage.getItem('shakaron_worker_id');
    if (cachedId) currentWorker = { id: cachedId };
  }
  if (!currentWorker?.id && appData.worker?.passport) {
    const { data: w } = await db.from('workers').select('id').eq('passport', appData.worker.passport).maybeSingle();
    if (w) { currentWorker = w; localStorage.setItem('shakaron_worker_id', w.id); }
  }
  if (!currentWorker?.id) return;

  const { error } = await db.from('months').delete()
    .eq('worker_id', currentWorker.id).eq('month_key', key);
  if (error) console.error('Delete month error:', error.message);
  else console.log('✓ Month deleted from DB:', key);
}

async function loadWorkerData(workerId) {
  if (!db) return;
  try {
    const [{ data: months, error: mErr }, { data: rates, error: rErr }] = await Promise.all([
      db.from('months').select('*').eq('worker_id', workerId),
      db.from('rates').select('*').eq('worker_id', workerId).maybeSingle(),
    ]);
    if (mErr) console.error('Months load error:', mErr.message);
    if (rErr) console.error('Rates load error:', rErr.message);

    appData.months = {};
    (months || []).forEach(m => {
      appData.months[m.month_key] = {
        base: m.base, expenses: m.expenses, havra: m.havra || 0,
        vacDays: m.vac_days, notes: m.notes,
        shabbats: m.shabbats || [], holidays: m.holidays || [],
        customVacDays: Array.isArray(m.custom_vac_days) ? m.custom_vac_days : (m.custom_vac_days ? Object.values(m.custom_vac_days) : []),
      };
    });

    if (rates) {
      appData.rates = {
        bituach: rates.bituach, pension: rates.pension, severance: rates.severance || 8.33,
        havraDays: rates.havra_days, havraRate: rates.havra_rate,
        havraMonth: rates.havra_month || '7',
        havraMonthly: (rates.havra_days * rates.havra_rate) / 12,
        havraAnnual:   rates.havra_days * rates.havra_rate,
      };
    }
    if (currentWorker) appData.worker = workerFromDb(currentWorker);
    saveLocal();
    console.log('✓ Data loaded — months:', Object.keys(appData.months).length);
  } catch(e) { console.error('loadWorkerData error:', e.message); }
}

async function submitSignupToDb() {
  const name  = v('signup-name').trim();
  const email = v('signup-email').trim();
  if (!name || !email) { safeToast('נא למלא שם ואימייל'); return; }
  if (!email.includes('@')) { safeToast('אימייל לא תקין'); return; }

  const signups = JSON.parse(localStorage.getItem('signups') || '[]');
  signups.push({ name, email, phone: v('signup-phone'), plan: v('signup-plan'), feedback: v('signup-feedback'), date: new Date().toISOString() });
  localStorage.setItem('signups', JSON.stringify(signups));

  if (db) {
    const { error } = await db.from('signups').insert({ name, email, phone: v('signup-phone'), plan: v('signup-plan'), feedback: v('signup-feedback') });
    if (error) console.error('Signup error:', error);
  }

  document.getElementById('signup-msg').style.display = 'inline';
  setV('signup-name',''); setV('signup-email',''); setV('signup-phone',''); setV('signup-feedback','');
  if (typeof renderPremiumScreen === 'function') renderPremiumScreen();
  safeToast('✓ נרשמת בהצלחה!');
}

// ── SYNC ALL — select+insert/update (ללא upsert) ──────────────
async function syncAllToCloud() {
  if (!db || !currentUser) { safeToast('התחבר קודם'); showLoginScreen(); return; }

  const btn = document.getElementById('sync-cloud-btn');
  if (btn) btn.textContent = '⏳ מסנכרן...';

  try {
    const w = appData.worker;
    if (w?.name) {
      const workerData = {
        user_id: currentUser.id, name: w.name, passport: w.passport,
        nationality: w.nationality || 'india', start_date: w.startDate || null,
        visa_date: w.visaDate || null, phone: w.phone,
        base_salary: w.baseSalary || 0, shabbat_bonus: w.shabbatBonus || 0,
        holiday_bonus: w.holidayBonus || 0, vac_total: w.vacTotal || 0,
        hol_total: w.holTotal || 0, sick_total: w.sickTotal || 0,
      };
      if (currentWorker?.id) {
        await db.from('workers').update(workerData).eq('id', currentWorker.id);
      } else {
        const { data: newW } = await db.from('workers').insert(workerData).select().single();
        if (newW) { currentWorker = newW; localStorage.setItem('shakaron_worker_id', newW.id); }
      }
    }

    if (!currentWorker?.id) {
      safeToast('⚠️ שמור פרטי עובדת קודם');
      if (btn) btn.textContent = '☁️ סנכרן';
      return;
    }

    const r = appData.rates;
    if (r) {
      await db.from('rates').upsert({
        worker_id: currentWorker.id, bituach: r.bituach || 0,
        pension: r.pension || 0, severance: r.severance || 8.33, havra_days: r.havraDays || 0, havra_rate: r.havraRate || 0,
      }, { onConflict: 'worker_id' });
    }

    // חודשים — select + insert/update
    const months = Object.entries(appData.months || {});
    let saved = 0;
    for (const [key, m] of months) {
      try {
        const { data: existing } = await db.from('months')
          .select('id').eq('worker_id', currentWorker.id).eq('month_key', key).maybeSingle();

        let error;
        if (existing?.id) {
          const r = await db.from('months').update({
            base: m.base || 0, expenses: m.expenses || 0, havra: m.havra || 0,
            vac_days: m.vacDays || 0, notes: m.notes || '',
            shabbats: m.shabbats || [], holidays: m.holidays || [],
            custom_vac_days: m.customVacDays || [],
          }).eq('id', existing.id);
          error = r.error;
        } else {
          const r = await db.from('months').insert({
            worker_id: currentWorker.id, month_key: key,
            base: m.base || 0, expenses: m.expenses || 0, havra: m.havra || 0,
            vac_days: m.vacDays || 0, notes: m.notes || '',
            shabbats: m.shabbats || [], holidays: m.holidays || [],
            custom_vac_days: m.customVacDays || [],
          });
          error = r.error;
        }
        if (!error) saved++;
        else console.error('Sync month error:', key, error.message);
      } catch(e) { console.error('Sync month exception:', key, e.message); }
    }

    safeToast(`✓ סונכרן — ${saved} חודשים`);
    if (btn) btn.textContent = '✓ מסונכרן';
    setTimeout(() => { if (btn) btn.textContent = '☁️ סנכרן'; }, 3000);

  } catch(e) {
    console.error('Sync error:', e);
    safeToast('⚠️ שגיאת סנכרון');
    if (btn) btn.textContent = '☁️ סנכרן';
  }
}
