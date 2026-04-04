// supabase.js – חיבור שכרון ל-Supabase
// עובד גם בלי התחברות (localStorage fallback)

const SUPABASE_URL  = 'https://ndnucfbchdxyhvpazxwe.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kbnVjZmJjaGR4eWh2cGF6eHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTAzNDAsImV4cCI6MjA5MDQyNjM0MH0.tuEpBl64HUvIU_f8u_N4DX-s8m40piHsTcv0QWITViU';

// ── INIT ─────────────────────────────────────────────────────
let db = null;
let currentUser   = null;
let currentWorker = null;

// אתחול אחרי שה-DOM מוכן
window.addEventListener('DOMContentLoaded', () => {
  try {
    const { createClient } = window.supabase;
    db = createClient(SUPABASE_URL, SUPABASE_ANON);

    // האזנה לשינויי auth
    db.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user ?? null;
      updateAuthUI();
      if (currentUser) {
        await onUserLoggedIn();
      }
    });

    // בדוק אם יש session קיים
    db.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        showLoginScreen(); // הצג banner קטן, לא חוסם
      }
    });

  } catch(e) {
    console.warn('Supabase init failed, using localStorage only:', e);
  }
});

// ── AUTH UI ───────────────────────────────────────────────────
function showLoginScreen() {
  const s = document.getElementById('screen-login');
  if (s) s.style.display = 'block';
}

function closeLoginScreen() {
  const s = document.getElementById('screen-login');
  if (s) s.style.display = 'none';
}

function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  if (!btn) return;
  if (currentUser) {
    const name = currentUser.email?.split('@')[0] || 'מחובר';
    btn.textContent = `✓ ${name}`;
    btn.onclick = () => { if(confirm('להתנתק?')) signOut(); };
    closeLoginScreen();
  } else {
    btn.textContent = '👤 כניסה';
    btn.onclick = () => showLoginScreen();
  }
}

// ── AUTH FUNCTIONS ────────────────────────────────────────────
async function signInWithGoogle() {
  if (!db) { toast('Supabase לא זמין'); return; }
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) toast('שגיאה: ' + error.message);
}

async function doLogin() {
  if (!db) { toast('Supabase לא זמין'); return; }
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const msg      = document.getElementById('login-msg');
  if (!email || !email.includes('@')) { toast('נא להכניס אימייל תקין'); return; }

  if (password) {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      toast('שגיאה: ' + error.message);
    } else {
      closeLoginScreen();
    }
  } else {
    const { error } = await db.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.href }
    });
    if (error) {
      toast('שגיאה: ' + error.message);
    } else {
      if (msg) { msg.textContent = '✓ נשלח קישור למייל ' + email; msg.style.display = 'block'; }
    }
  }
}

async function signInWithEmailOrPassword() { await doLogin(); }

async function signInWithEmail(email) {
  if (!db) { toast('Supabase לא זמין'); return; }
  if (!email || !email.includes('@')) { toast('נא להכניס אימייל תקין'); return; }
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  if (error) toast('שגיאה: ' + error.message);
  else toast('✓ נשלח קישור למייל ' + email);
}

async function signOut() {
  if (!db) return;
  await db.auth.signOut();
  currentUser = null;
  currentWorker = null;
  localStorage.removeItem('shakaron_premium');
  appData.profile = null;
  updateAuthUI();
  showLoginScreen();
  toast('התנתקת בהצלחה');
}

// ── ON LOGIN ──────────────────────────────────────────────────
async function onUserLoggedIn() {
  if (!db || !currentUser) return;

  toast('✓ מחובר כ-' + (currentUser.email || 'משתמש'));

  // קרא תוכנית מ-app_metadata (מוגדר ע"י אדמין)
  const meta = currentUser.app_metadata || {};
  const plan = meta.plan || 'free';
  const planUntil = meta.plan_until ? new Date(meta.plan_until) : null;
  const isPrem = plan === 'premium' && (!planUntil || planUntil > new Date());
  
  appData.profile = { plan, plan_until: meta.plan_until };
  localStorage.setItem('shakaron_premium', isPrem ? 'true' : 'false');
  
  if (isPrem) {
    toast('⭐ ברוך הבא — גרסת פרימיום פעילה!');
  }

  // טען עובדת פעילה
  const { data: workers } = await db
    .from('workers').select('*')
    .eq('user_id', currentUser.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (workers && workers.length > 0) {
    currentWorker = workers[0];
    await loadWorkerData(currentWorker.id);
  }

  if (typeof applyPlanGates === 'function') applyPlanGates();
  updateWorkerStats();
  updateVacBar();
  renderMonthsList();
  populateWorkerForm();
}

// ── WORKER ────────────────────────────────────────────────────
async function saveWorkerToDb() {
  // שמור מקומית תמיד — מיידי
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

  // שמור ב-DB (עם או בלי auth)
  if (!db) return;

  const workerData = {
    name:          appData.worker.name,
    passport:      appData.worker.passport,
    nationality:   appData.worker.nationality,
    start_date:    appData.worker.startDate,
    visa_date:     appData.worker.visaDate,
    phone:         appData.worker.phone,
    base_salary:   appData.worker.baseSalary,
    shabbat_bonus: appData.worker.shabbatBonus,
    holiday_bonus: appData.worker.holidayBonus,
    vac_total:     appData.worker.vacTotal,
    hol_total:     appData.worker.holTotal,
    sick_total:    appData.worker.sickTotal,
  };

  // הוסף user_id רק אם מחובר
  if (currentUser?.id) workerData.user_id = currentUser.id;

  let result;
  if (currentWorker?.id) {
    // עדכן עובדת קיימת
    result = await db.from('workers')
      .update(workerData).eq('id', currentWorker.id)
      .select().single();
  } else if (workerData.passport) {
    // נסה למצוא לפי דרכון קודם
    const { data: existing } = await db.from('workers')
      .select('id').eq('passport', workerData.passport).maybeSingle();
    if (existing) {
      currentWorker = existing;
      result = await db.from('workers')
        .update(workerData).eq('id', existing.id)
        .select().single();
    } else {
      result = await db.from('workers').insert(workerData).select().single();
    }
  } else {
    result = await db.from('workers').insert(workerData).select().single();
  }

  if (result.error) {
    console.error('Worker save error:', result.error.message, result.error.details);
    toast('⚠️ ' + result.error.message);
    return;
  }
  currentWorker = result.data;
  console.log('✓ Worker saved to DB:', currentWorker.id);
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

// ── RATES ─────────────────────────────────────────────────────
async function saveRatesToDb() {
  const havraDays   = parseFloat(v('r-havra-days')) || 0;
  const havraRate   = parseFloat(v('r-havra-rate')) || 0;
  const havraAnnual = havraDays * havraRate;

  appData.rates = {
    bituach: parseFloat(v('r-bituach')) || 0,
    pension: parseFloat(v('r-pension')) || 0,
    havraDays: calcHavraDays(appData.worker?.startDate),
    havraRate: parseFloat(v('r-havra-rate')) || 0,
    havraMonth: v('r-havra-month') || '7',
    havraMonthly: 0, // לא משתמשים יותר בחלוקה חודשית
    havraAnnual: calcHavraDays(appData.worker?.startDate) * (parseFloat(v('r-havra-rate')) || 0),
  };

  const txtAnnual  = document.getElementById('havra-annual-disp');
  const txtMonthly = document.getElementById('havra-monthly-disp');
  if (txtAnnual)  txtAnnual.textContent  = havraAnnual.toFixed(0);
  if (txtMonthly) txtMonthly.textContent = (havraAnnual/12).toFixed(2);

  saveLocal();
  if (typeof renderCostsScreen === 'function') renderCostsScreen();
  if (typeof renderModalEmployerCosts === 'function') renderModalEmployerCosts();

  // שמור ב-DB
  if (!db || !currentWorker?.id) {
    toast('⚠️ אין חיבור לענן — נשמר מקומית');
    return;
  }

  const { error } = await db.from('rates').upsert({
    worker_id:  currentWorker.id,
    bituach:    appData.rates.bituach,
    pension:    appData.rates.pension,
    havra_days: havraDays,
    havra_rate: havraRate,
  }, { onConflict: 'worker_id' });

  const msg = document.getElementById('rates-save-msg');
  if (error) {
    console.error('Rates save error:', error);
    toast('⚠️ שגיאת שמירה: ' + error.message);
  } else {
    toast('✓ הגדרות נשמרו');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
  }
}

// ── MONTHS ────────────────────────────────────────────────────
async function saveMonthToDb() {
  const key = v('m-month');
  if (!key) { toast('בחר חודש'); return; }

  const monthObj = {
    base:     parseFloat(v('m-base'))     || 0,
    expenses: parseFloat(v('m-expenses')) || 0,
    vacDays:  parseInt(v('m-vac-days'))   || 0,
    notes:    v('m-notes'),
    shabbats: [...calState.workedShabbats],
    holidays: [...calState.workedHolidays],
  };

  // שמור מקומית תמיד
  appData.months[key] = monthObj;
  saveLocal();
  renderMonthsList();
  updateWorkerStats();
  updateVacBar();
  closeModal();
  toast('החודש נשמר ✓');

  // שמור ב-DB ברקע אם יש DB
  if (!db || !currentWorker?.id) return;

  const { error } = await db.from('months').upsert({
    worker_id: currentWorker.id,
    month_key: key,
    base:      monthObj.base,
    expenses:  monthObj.expenses,
    vac_days:  monthObj.vacDays,
    notes:     monthObj.notes,
    shabbats:  monthObj.shabbats,
    holidays:  monthObj.holidays,
  }, { onConflict: 'worker_id,month_key' });

  if (error) {
    console.error('Month save error:', error.message, error.details);
    toast('⚠️ שמור מקומית — שגיאת ענן: ' + error.message);
  } else {
    console.log('✓ Month saved to DB:', key);
  }
}

async function deleteMonthFromDb(key) {
  if (!key) { key = document.getElementById('editing-month-key')?.value; }
  if (!key || !appData.months[key]) return;
  if (!confirm('למחוק את חודש ' + key + '?')) return;

  delete appData.months[key];
  saveLocal();
  renderMonthsList();
  updateWorkerStats();
  updateVacBar();
  closeModal();
  toast('החודש נמחק');

  if (!db || !currentUser || !currentWorker?.id) return;
  await db.from('months')
    .delete()
    .eq('worker_id', currentWorker.id)
    .eq('month_key', key);
}

// ── LOAD ALL DATA ─────────────────────────────────────────────
async function loadWorkerData(workerId) {
  if (!db) return;

  const [{ data: months }, { data: rates }] = await Promise.all([
    db.from('months').select('*').eq('worker_id', workerId),
    db.from('rates').select('*').eq('worker_id', workerId).single(),
  ]);

  appData.months = {};
  (months || []).forEach(m => {
    appData.months[m.month_key] = {
      base: m.base, expenses: m.expenses,
      vacDays: m.vac_days, notes: m.notes,
      shabbats: m.shabbats || [], holidays: m.holidays || [],
    };
  });

  if (rates) {
    appData.rates = {
      bituach: rates.bituach, pension: rates.pension,
      havraDays: rates.havra_days, havraRate: rates.havra_rate,
      havraMonthly: (rates.havra_days * rates.havra_rate) / 12,
      havraAnnual:  rates.havra_days * rates.havra_rate,
    };
  }

  appData.worker = workerFromDb(currentWorker);
  saveLocal(); // sync גם ל-localStorage כ-cache
}

// ── SIGNUPS ───────────────────────────────────────────────────
async function submitSignupToDb() {
  const name  = v('signup-name').trim();
  const email = v('signup-email').trim();
  if (!name || !email) { toast('נא למלא שם ואימייל'); return; }
  if (!email.includes('@')) { toast('אימייל לא תקין'); return; }

  // שמור תמיד מקומית
  const signups = JSON.parse(localStorage.getItem('signups') || '[]');
  signups.push({ name, email, phone: v('signup-phone'),
    plan: v('signup-plan'), feedback: v('signup-feedback'),
    date: new Date().toISOString() });
  localStorage.setItem('signups', JSON.stringify(signups));
  localStorage.setItem('signup_count', signups.length);

  // נסה ל-DB
  if (db) {
    const { error } = await db.from('signups').insert({
      name, email, phone: v('signup-phone'),
      plan: v('signup-plan'), feedback: v('signup-feedback'),
    });
    if (error) console.error('Signup save error:', error);
  }

  document.getElementById('signup-msg').style.display = 'inline';
  setV('signup-name',''); setV('signup-email','');
  setV('signup-phone',''); setV('signup-feedback','');
  if (typeof renderPremiumScreen === 'function') renderPremiumScreen();
  toast('✓ נרשמת בהצלחה!');
}
