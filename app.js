// app.js – לוגיקה ראשית של שכרון

// ─────────────── STATE ───────────────
let appData = {
  worker: {},
  months: {},   // key: "YYYY-MM"
  files: {},    // key: category -> [{name, dataUrl}]
  rates: {}     // employer cost rates
};

let calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-based
  workedShabbats: new Set(),
  workedHolidays: new Set()
};

// ─────────────── INIT ───────────────
document.addEventListener('DOMContentLoaded', () => {
  loadLocal();
  populateWorkerForm();
  renderMonthsList();
  updateWorkerStats();
  updateVacBar();
  applyPlanGates();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// הפעל/כבה את כל חסימות הגרסה החינמית
function applyPlanGates() {
  const premium = isPremium();

  // מסמכים — blur overlay
  const docsGate = document.getElementById('docs-gate');
  if (docsGate) docsGate.style.display = premium ? 'none' : 'block';

  // טאב הוצאות מעסיק — הוסף/הסר מנעול
  const costTab = document.querySelector('.nav-tab[onclick*="screen-costs"]');
  if (costTab) {
    costTab.textContent = premium ? '💼 הוצאות מעסיק' : '💼 הוצאות מעסיק 🔒';
  }

  // הודעת מגבלת חודשים
  renderMonthsList();
}

// ─────────────── LOCAL STORAGE ───────────────
function saveLocal() {
  try {
    const toSave = { worker: appData.worker, months: appData.months, rates: appData.rates };
    localStorage.setItem('shakaron_data', JSON.stringify(toSave));
  } catch(e) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem('shakaron_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      appData.worker = parsed.worker || {};
      appData.months = parsed.months || {};
      appData.rates  = parsed.rates  || {};
    }
  } catch(e) {}
}

// ─────────────── SCREENS ───────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const idx = ['screen-guide','screen-worker','screen-salary','screen-costs','screen-premium'].indexOf(id);
  document.querySelectorAll('.nav-tab')[idx].classList.add('active');
  if (id === 'screen-salary')  renderMonthsList();
  if (id === 'screen-guide')   setTimeout(initAccordion, 50);
  if (id === 'screen-costs')   {
    if (!requirePremium('ניהול הוצאות מעסיק')) return;
    populateRatesForm(); renderCostsScreen(); updateHavraPreview();
  }
  if (id === 'screen-premium') renderPremiumScreen();
}

function showPhase(phase) {
  ['before','during','end'].forEach(p => {
    document.getElementById('phase-' + p).style.display = p === phase ? 'block' : 'none';
    const btn = document.getElementById('btn-' + p);
    if (btn) btn.classList.toggle('active', p === phase);
  });
  // Init accordion for newly shown phase
  initAccordion();
}

function initAccordion() {
  document.querySelectorAll('.tl-title').forEach(title => {
    if (title._accordionInit) return;
    title._accordionInit = true;
    title.addEventListener('click', () => {
      const content = title.closest('.tl-content');
      const wasOpen = content.classList.contains('open');
      // Close all in same timeline
      content.closest('.timeline')?.querySelectorAll('.tl-content').forEach(c => c.classList.remove('open'));
      if (!wasOpen) content.classList.add('open');
    });
  });
}

// ─────────────── WORKER FORM ───────────────
function saveWorker() {
  appData.worker = {
    name: v('w-name'),
    passport: v('w-passport'),
    nationality: v('w-nationality'),
    startDate: v('w-start'),
    visaDate: v('w-visa'),
    phone: v('w-phone'),
    baseSalary: parseFloat(v('w-base')) || 0,
    shabbatBonus: parseFloat(v('w-shabbat-bonus')) || 0,
    holidayBonus: parseFloat(v('w-holiday-bonus')) || 0,
    vacTotal: parseInt(v('w-vac-total')) || 0,
    holTotal: parseInt(v('w-hol-total')) || 0,
    sickTotal: parseInt(v('w-sick-total')) || 0,
  };
  saveLocal();
  updateWorkerStats();
  updateVacBar();
}

function populateWorkerForm() {
  const w = appData.worker;
  if (!w) return;
  setV('w-name', w.name);
  setV('w-passport', w.passport);
  setV('w-nationality', w.nationality || 'india');
  setV('w-start', w.startDate);
  setV('w-visa', w.visaDate);
  setV('w-phone', w.phone);
  setV('w-base', w.baseSalary);
  setV('w-shabbat-bonus', w.shabbatBonus);
  setV('w-holiday-bonus', w.holidayBonus);
  setV('w-vac-total', w.vacTotal);
  setV('w-hol-total', w.holTotal);
  setV('w-sick-total', w.sickTotal);
}

// ימי חג שנוצלו = חגים שעבדה בהם (מחושב אוטומטית)
function calcHolUsed() {
  let total = 0;
  for (const [, m] of Object.entries(appData.months)) {
    total += (m.holidays || []).length;
  }
  return total;
}

// ימי חופשה שנוצלו = ימים ידניים שהוזנו בכל חודש
function calcTotalVacUsed() {
  let total = 0;
  for (const [, m] of Object.entries(appData.months)) {
    total += parseInt(m.vacDays) || 0;
  }
  return total;
}

function updateWorkerStats() {
  const w = appData.worker;
  setText('stat-name', w.name || '—');
  setText('stat-base', w.baseSalary ? '₪' + Number(w.baseSalary).toLocaleString() : '₪0');

  // ימי חג
  const holUsed = calcHolUsed();
  const holTotal = w.holTotal || 0;
  const holLeft = Math.max(0, holTotal - holUsed);
  setText('stat-hol-left', holLeft);
  setText('stat-hol-used', holUsed);
  setText('stat-hol-total', holTotal);
  setText('hol-total-disp', holTotal);
  setText('hol-used-disp', holUsed);
  setText('hol-left-disp', holLeft);

  // ימי חופשה
  const vacUsed = calcTotalVacUsed();
  const vacTotal = w.vacTotal || 0;
  const vacLeft = Math.max(0, vacTotal - vacUsed);
  setText('stat-vac-left', vacLeft);
  setText('stat-vac-used', vacUsed);
  setText('stat-vac-total-top', vacTotal);
  setText('vac-total-disp', vacTotal);
  setText('vac-used-disp', vacUsed);
  setText('vac-left-disp', vacLeft);
}

function updateVacBar() {
  const w = appData.worker;

  const holUsed = calcHolUsed();
  const holTotal = w.holTotal || 0;
  const holPct = holTotal > 0 ? Math.min(100, (holUsed / holTotal) * 100) : 0;
  document.getElementById('hol-bar').style.width = holPct + '%';

  const vacUsed = calcTotalVacUsed();
  const vacTotal = w.vacTotal || 0;
  const vacPct = vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0;
  document.getElementById('vac-bar').style.width = vacPct + '%';
}

// ─────────────── MONTHS LIST ───────────────
function renderMonthsList() {
  const container = document.getElementById('months-list');
  const months = Object.entries(appData.months).sort((a,b) => b[0].localeCompare(a[0]));

  // הצג הודעת מגבלה לגרסה חינמית
  const notice = document.getElementById('free-months-notice');
  if (notice) {
    notice.style.display = (!isPremium() && months.length >= 1) ? 'inline' : 'none';
  }

  if (!months.length) {
    container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px;">אין חודשים מוגדרים. לחץ "הוספת חודש" להתחיל.</div>';
    return;
  }
  container.innerHTML = months.map(([key, m]) => {
    const [yr, mo] = key.split('-');
    const label = HEB_MONTHS[parseInt(mo)-1] + ' ' + yr;
    const total = calcTotal(m);
    return `
      <div class="month-entry" onclick="openMonthModal('${key}')">
        <div class="me-date">${label}</div>
        <div class="me-info">
          <span class="me-chip">בסיס: ₪${Number(m.base||0).toLocaleString()}</span>
          <span class="me-chip shab">🕯️ ${m.shabbats?.length||0} שבתות</span>
          <span class="me-chip hol">🎉 ${m.holidays?.length||0} חגים</span>
          ${m.expenses ? `<span class="me-chip">החזר: ₪${Number(m.expenses).toLocaleString()}</span>` : ''}
          ${m.vacDays ? `<span class="me-chip" style="background:rgba(52,211,153,0.15);color:var(--success);">🏖️ ${m.vacDays} ימי חופשה</span>` : ''}
          ${m.notes ? `<span class="me-chip">📝 ${m.notes}</span>` : ''}
        </div>
        <div class="me-total">₪${Number(total).toLocaleString()}</div>
      </div>
    `;
  }).join('');
}

function calcTotal(m) {
  const w = appData.worker;
  const base = parseFloat(m.base) || 0;
  const shabs = (m.shabbats||[]).length * (parseFloat(w.shabbatBonus)||0);
  const hols = (m.holidays||[]).length * (parseFloat(w.holidayBonus)||0);
  const exp = parseFloat(m.expenses) || 0;
  return base + shabs + hols + exp;
}

// ─────────────── MODAL ───────────────
function openMonthModal(key = null, pdfOnly = false) {
  // גרסה חינמית: רק חודש אחד
  if (!isPremium() && !key) {
    const existingMonths = Object.keys(appData.months);
    if (existingMonths.length >= 1) {
      if (!requirePremium('ניהול חודשי ללא הגבלה')) return;
    }
  }
  const modal = document.getElementById('month-modal');
  modal.classList.add('open');

  if (key && appData.months[key]) {
    const m = appData.months[key];
    document.getElementById('editing-month-key').value = key;
    document.getElementById('modal-title-text').textContent = 'עריכת חודש';
    document.getElementById('delete-month-btn').style.display = 'inline-flex';
    setV('m-month', key);
    setV('m-base', m.base);
    setV('m-expenses', m.expenses || 0);
    setV('m-vac-days', m.vacDays || 0);
    setV('m-notes', m.notes || '');
    const [yr, mo] = key.split('-').map(Number);
    calState.year = yr;
    calState.month = mo - 1;
    calState.workedShabbats = new Set(m.shabbats || []);
    calState.workedHolidays = new Set(m.holidays || []);
  } else {
    document.getElementById('editing-month-key').value = '';
    document.getElementById('modal-title-text').textContent = pdfOnly ? 'בחר חודש לדוח PDF' : 'הוספת חודש חדש';
    document.getElementById('delete-month-btn').style.display = 'none';
    const now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth();
    calState.workedShabbats = new Set();
    calState.workedHolidays = new Set();
    const monthStr = calState.year + '-' + String(calState.month + 1).padStart(2,'0');
    setV('m-month', monthStr);
    setV('m-base', appData.worker.baseSalary || '');
    setV('m-expenses', 0);
    setV('m-vac-days', 0);
    setV('m-notes', '');
  }
  renderCalendar();
  updateSummary();
  renderModalEmployerCosts();
  checkHavraAlert();
}

function closeModal() {
  document.getElementById('month-modal').classList.remove('open');
}

function saveMonth() {
  const key = v('m-month');
  if (!key) { toast('בחר חודש'); return; }
  appData.months[key] = {
    base: parseFloat(v('m-base')) || 0,
    expenses: parseFloat(v('m-expenses')) || 0,
    vacDays: parseInt(v('m-vac-days')) || 0,
    notes: v('m-notes'),
    shabbats: [...calState.workedShabbats],
    holidays: [...calState.workedHolidays]
  };
  saveLocal();
  renderMonthsList();
  updateWorkerStats();
  updateVacBar();
  closeModal();
  toast('החודש נשמר ✓');
}

function deleteMonth() {
  const key = document.getElementById('editing-month-key').value;
  if (!key || !appData.months[key]) return;
  if (!confirm('למחוק את חודש ' + key + '?')) return;
  delete appData.months[key];
  saveLocal();
  renderMonthsList();
  closeModal();
  toast('החודש נמחק');
}

// ─────────────── CALENDAR ───────────────
function calNav(dir) {
  calState.month += dir;
  if (calState.month < 0) { calState.month = 11; calState.year--; }
  if (calState.month > 11) { calState.month = 0; calState.year++; }
  renderCalendar();
}

function renderCalendar() {
  const { year, month } = calState;
  const label = HEB_MONTHS[month] + ' ' + year;
  setText('cal-label', label);

  const nat = appData.worker.nationality || 'india';
  const nationalities = ['israel', nat];

  const grid = document.getElementById('cal-grid');
  const days = ['א','ב','ג','ד','ה','ו','ש'];
  let html = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0,10);

  // empty cells
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isSat = isShabbat(dateStr);
    const holInfo = getHolidayInfo(dateStr, nationalities);
    const isHol = !!holInfo;
    const workedSab = calState.workedShabbats.has(dateStr);
    const workedHol = calState.workedHolidays.has(dateStr);
    const isToday = dateStr === today;

    let cls = 'cal-day';
    if (workedSab) cls += ' shabbat-worked';
    else if (workedHol) cls += ' holiday-worked';
    else if (isSat) cls += ' is-shabbat';
    else if (isHol) cls += ' is-holiday';
    if (isToday) cls += ' today';

    const dot = isHol && !workedSab ? '<div class="hol-dot"></div>' : '';
    const title = isHol ? holInfo.name : (isSat ? 'שבת' : '');

    html += `<div class="${cls}" onclick="toggleDay('${dateStr}', ${isSat}, ${isHol})" title="${title}">
      ${d}${dot}
    </div>`;
  }

  grid.innerHTML = html;
  updateSummary();
}

function toggleDay(dateStr, isSat, isHol) {
  if (isSat) {
    if (calState.workedShabbats.has(dateStr)) calState.workedShabbats.delete(dateStr);
    else calState.workedShabbats.add(dateStr);
  } else if (isHol) {
    if (calState.workedHolidays.has(dateStr)) calState.workedHolidays.delete(dateStr);
    else calState.workedHolidays.add(dateStr);
  }
  renderCalendar();
}

function updateSummary() {
  const nSab = calState.workedShabbats.size;
  const nHol = calState.workedHolidays.size;
  const w = appData.worker;
  const base = parseFloat(v('m-base')) || parseFloat(w.baseSalary) || 0;
  const sabBonus = parseFloat(w.shabbatBonus) || 0;
  const holBonus = parseFloat(w.holidayBonus) || 0;
  const exp = parseFloat(v('m-expenses')) || 0;
  const total = base + nSab * sabBonus + nHol * holBonus + exp;

  setText('sum-shabbat', nSab);
  setText('sum-holidays', nHol);
  setText('sum-total', Number(total.toFixed(2)).toLocaleString());
}

// ─────────────── PDF GENERATION ───────────────
function generatePDF() {
  const key = v('m-month') || document.getElementById('editing-month-key').value;
  if (!key) { toast('בחר חודש תחילה'); return; }

  const [yr, mo] = key.split('-');
  const monthLabel = HEB_MONTHS[parseInt(mo)-1] + ' ' + yr;
  const w = appData.worker;
  const nat = w.nationality || 'india';
  const nationalities = ['israel', nat];
  const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
  const firstDay = new Date(parseInt(yr), parseInt(mo)-1, 1).getDay();

  const nSab = calState.workedShabbats.size;
  const nHol = calState.workedHolidays.size;
  const base = parseFloat(v('m-base')) || 0;
  const exp  = parseFloat(v('m-expenses')) || 0;
  const sabBonus = parseFloat(w.shabbatBonus) || 0;
  const holBonus = parseFloat(w.holidayBonus) || 0;
  const total = base + nSab * sabBonus + nHol * holBonus + exp;

  // לוח שנה
  const dayNames = ['א','ב','ג','ד','ה','ו','ש'];
  let calCells = dayNames.map(d =>
    `<div class="cal-head">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) calCells += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = yr + '-' + String(mo).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isSat  = isShabbat(ds);
    const holInfo = getHolidayInfo(ds, nationalities);
    const wSab   = calState.workedShabbats.has(ds);
    const wHol   = calState.workedHolidays.has(ds);
    let cls = 'day';
    if      (wSab)   cls += ' wsab';
    else if (wHol)   cls += ' whol';
    else if (isSat)  cls += ' sat';
    else if (holInfo) cls += ' hol';
    const tip = holInfo ? holInfo.name : (isSat ? 'שבת' : '');
    calCells += `<div class="${cls}" title="${tip}">${d}</div>`;
  }

  // שורות שכר
  const payRows = [
    `<tr><td>שכר בסיס</td><td>₪${base.toLocaleString()}</td></tr>`,
    nSab ? `<tr class="shab"><td>תוספת שבת (${nSab} × ₪${sabBonus})</td><td>₪${(nSab*sabBonus).toLocaleString()}</td></tr>` : '',
    nHol ? `<tr class="holr"><td>תוספת חג (${nHol} × ₪${holBonus})</td><td>₪${(nHol*holBonus).toLocaleString()}</td></tr>` : '',
    exp  ? `<tr><td>החזר הוצאות</td><td>₪${exp.toLocaleString()}</td></tr>` : '',
    `<tr class="total-row"><td><strong>סה״כ לתשלום</strong></td><td><strong>₪${total.toLocaleString()}</strong></td></tr>`,
  ].filter(Boolean).join('');

  const holUsed = calcHolUsed();
  const vacUsed = calcTotalVacUsed();

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>תלוש שכר – ${w.name||'עובדת'} – ${monthLabel}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;900&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Heebo',sans-serif;direction:rtl;background:#fff;color:#111;
       padding:20px;font-size:13px;max-width:680px;margin:0 auto}
  h1{font-size:22px;font-weight:900;color:#1a1f2e;margin-bottom:2px}
  .sub{color:#5b7fff;font-size:15px;font-weight:700;margin-bottom:16px}
  .top-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .box{background:#f7f9ff;border:1px solid #dde3f5;border-radius:8px;padding:12px}
  .box-title{font-size:11px;color:#888;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
  .box p{font-size:13px;color:#444;line-height:1.6}
  .box .name{font-size:15px;font-weight:700;color:#111;margin-bottom:4px}
  table.pay{width:100%;border-collapse:collapse;margin-bottom:16px}
  table.pay td{padding:6px 8px;border-bottom:1px solid #eee}
  table.pay td:last-child{text-align:left;font-weight:600}
  tr.shab td{color:#e65100}
  tr.holr td{color:#5e35b1}
  tr.total-row td{border-top:2px solid #5b7fff;padding-top:8px;font-size:15px;color:#5b7fff}
  .cal-wrap{margin-bottom:14px}
  .cal-title{font-size:13px;font-weight:700;margin-bottom:8px;color:#1a1f2e}
  .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
  .cal-head{text-align:center;font-size:10px;font-weight:700;color:#888;padding:3px}
  .day{text-align:center;padding:4px 2px;border-radius:4px;font-size:12px;
       border:1px solid #eee;min-height:26px;line-height:18px}
  .wsab{background:#fff3e0;color:#e65100;border-color:#f97316;font-weight:700}
  .whol{background:#ede7f6;color:#5e35b1;border-color:#818cf8;font-weight:700}
  .sat{color:#f97316;border-color:#ffe0cc}
  .hol{color:#818cf8;border-color:#e0e0ff}
  .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:#555;margin-top:6px}
  .legend span{display:flex;align-items:center;gap:4px}
  .swatch{width:12px;height:12px;border-radius:2px;display:inline-block}
  .vac-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
  .vac-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px}
  .vac-box.hol-box{background:#f5f3ff;border-color:#ddd6fe}
  .vac-box .vb-title{font-size:10px;color:#888;font-weight:700;margin-bottom:5px}
  .vac-box .vb-nums{font-size:12px;color:#333}
  .vac-box .vb-nums strong{color:#059669}
  .vac-box.hol-box .vb-nums strong{color:#7c3aed}
  .footer{text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px;margin-top:4px}
  @media print{
    body{padding:10px}
    @page{size:A4 portrait;margin:10mm}
  }
  .print-btn{display:block;margin:0 auto 16px;padding:10px 28px;background:#5b7fff;
             color:#fff;border:none;border-radius:8px;font-size:15px;font-family:'Heebo',sans-serif;
             font-weight:700;cursor:pointer}
  @media print{.print-btn{display:none}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור PDF</button>
<h1>תלוש שכר – שכרון ✦</h1>
<div class="sub">${monthLabel}</div>

<div class="top-grid">
  <div class="box">
    <div class="box-title">פרטי עובדת</div>
    <div class="name">${w.name||'—'}</div>
    <p>דרכון: ${w.passport||'—'}<br>
    התחלה: ${w.startDate||'—'}<br>
    ויזה עד: ${w.visaDate||'—'}</p>
  </div>
  <div class="box">
    <div class="box-title">פרטי תשלום</div>
    <table class="pay" style="margin-bottom:0">${payRows}</table>
  </div>
</div>

<div class="cal-wrap">
  <div class="cal-title">📅 לוח שנה – ${monthLabel}</div>
  <div class="cal">${calCells}</div>
  <div class="legend">
    <span><span class="swatch wsab"></span>שבת שעבדה</span>
    <span><span class="swatch whol"></span>חג שעבדה</span>
    <span style="color:#f97316">◆ שבת רגילה</span>
    <span style="color:#818cf8">◆ חג (לא עבדה)</span>
  </div>
</div>

<div class="vac-row">
  <div class="vac-box hol-box">
    <div class="vb-title">🎉 ימי חג</div>
    <div class="vb-nums">
      זכאות: <strong>${w.holTotal||0}</strong> &nbsp;|&nbsp;
      נוצל: <strong>${holUsed}</strong> &nbsp;|&nbsp;
      נותר: <strong>${Math.max(0,(w.holTotal||0)-holUsed)}</strong>
    </div>
  </div>
  <div class="vac-box">
    <div class="vb-title">🏖️ ימי חופשה</div>
    <div class="vb-nums">
      זכאות: <strong>${w.vacTotal||0}</strong> &nbsp;|&nbsp;
      נוצל: <strong>${vacUsed}</strong> &nbsp;|&nbsp;
      נותר: <strong>${Math.max(0,(w.vacTotal||0)-vacUsed)}</strong>
    </div>
  </div>
</div>

<div class="footer">הופק ע"י שכרון ✦ &nbsp;•&nbsp; ${new Date().toLocaleDateString('he-IL')}</div>
<script>window.onload=()=>{/* ready */}<\/script>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    // fallback: download as HTML file
    const a = document.createElement('a');
    a.href = url; a.download = `שכרון_${w.name||'עובדת'}_${key}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('הדוח נפתח – לחץ "הדפס / שמור PDF"');
}


// ─────────────── FILE HANDLING ───────────────
function handleFile(category, input) {
  if (!appData.files[category]) appData.files[category] = [];
  const files = Array.from(input.files);
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = e => {
      appData.files[category].push({ name: f.name, dataUrl: e.target.result });
      renderFileList(category);
    };
    reader.readAsDataURL(f);
  });
  input.value = '';
}

function renderFileList(category) {
  const list = document.getElementById('list-' + category);
  const items = appData.files[category] || [];
  list.innerHTML = items.map((f, i) => `
    <div class="file-item">
      <div class="file-item-name">📎 ${f.name}</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="previewFile('${category}',${i})">👁️</button>
        <button class="btn btn-danger btn-sm" onclick="removeFile('${category}',${i})">✕</button>
      </div>
    </div>
  `).join('');
}

function removeFile(cat, idx) {
  appData.files[cat].splice(idx, 1);
  renderFileList(cat);
}

function previewFile(cat, idx) {
  const f = appData.files[cat][idx];
  if (!f) return;
  const win = window.open();
  win.document.write(`<img src="${f.dataUrl}" style="max-width:100%" />`);
}

// ─────────────── EXPORT / IMPORT ───────────────
function exportJSON() {
  const data = { worker: appData.worker, months: appData.months, exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shakaron_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  toast('נתונים יוצאו ✓');
}

function importJSON() { document.getElementById('import-file').click(); }

function doImport(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      appData.worker = data.worker || {};
      appData.months = data.months || {};
      saveLocal();
      populateWorkerForm();
      updateWorkerStats();
      updateVacBar();
      renderMonthsList();
      toast('נתונים יובאו ✓');
    } catch { toast('קובץ לא תקין'); }
  };
  reader.readAsText(f);
  input.value = '';
}

// ─────────────── GITHUB GIST SYNC ───────────────
async function syncGist() {
  const token = localStorage.getItem('gh_token');
  const gistId = localStorage.getItem('gh_gist_id');

  if (!token) {
    const t = prompt('הכנס GitHub Personal Access Token (עם הרשאת gist):');
    if (!t) return;
    localStorage.setItem('gh_token', t.trim());
  }

  const ghToken = localStorage.getItem('gh_token');
  const payload = { worker: appData.worker, months: appData.months, synced: new Date().toISOString() };
  const body = {
    description: 'Shakaron – שכרון ניהול שכר עובדת',
    public: false,
    files: { 'shakaron_data.json': { content: JSON.stringify(payload, null, 2) } }
  };

  try {
    let res, url = 'https://api.github.com/gists', method = 'POST';
    if (gistId) { url += '/' + gistId; method = 'PATCH'; }
    res = await fetch(url, {
      method,
      headers: { Authorization: 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.id) {
      localStorage.setItem('gh_gist_id', data.id);
      toast('סונכרן ל-GitHub Gist ✓');
    } else {
      toast('שגיאת סנכרון: ' + (data.message || 'לא ידוע'));
      localStorage.removeItem('gh_token');
    }
  } catch (e) {
    toast('שגיאת רשת');
    console.error(e);
  }
}

// ─────────────── HAVRA'A (הבראה) ───────────────

// חישוב ימי הבראה לפי ותק
function calcHavraDays(startDate) {
  if (!startDate) return 6;
  const start = new Date(startDate);
  const now   = new Date();
  const years = (now - start) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 2) return 6;
  if (years < 4) return 7;
  return 8;
}

// חישוב שנות ותק כטקסט
function calcSeniorityText(startDate) {
  if (!startDate) return '—';
  const start = new Date(startDate);
  const now   = new Date();
  const months = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 30.44));
  const years  = Math.floor(months / 12);
  const rem    = months % 12;
  if (years === 0) return `${rem} חודשים`;
  if (rem === 0)   return `${years} שנים`;
  return `${years} שנים ו-${rem} חודשים`;
}

// עדכן תצוגת הבראה בכרטיס הגדרות
function updateHavraPreview() {
  const rate      = parseFloat(v('r-havra-rate')) || 0;
  const startDate = appData.worker?.startDate;

  // סכומים לפי ותק
  setText('havra-y1', `₪${(6 * rate).toLocaleString()}`);
  setText('havra-y2', `₪${(7 * rate).toLocaleString()}`);
  setText('havra-y3', `₪${(8 * rate).toLocaleString()}`);

  // ותק נוכחי
  const days = calcHavraDays(startDate);
  const amt  = days * rate;
  setText('havra-seniority-days', `${days} ימים`);
  setText('havra-current', `₪${amt.toLocaleString()}`);
  setText('havra-start-disp', startDate || '—');
  setText('havra-years-disp', calcSeniorityText(startDate));
}

// בדוק אם החודש הנוכחי הוא חודש הבראה והצג התראה
function checkHavraAlert() {
  const monthKey = v('m-month');
  if (!monthKey) return;
  const [, mo] = monthKey.split('-').map(Number);
  const havraMonth = parseInt(appData.rates?.havraMonth || '7');
  const alert = document.getElementById('havra-alert');
  if (!alert) return;

  if (mo === havraMonth) {
    const rate  = appData.rates?.havraRate || 378;
    const days  = calcHavraDays(appData.worker?.startDate);
    const total = days * rate;
    setText('havra-alert-text',
      `לפי ותק של ${calcSeniorityText(appData.worker?.startDate)} — ${days} ימי הבראה × ₪${rate} = ₪${total.toLocaleString()}`
    );
    alert.style.display = 'block';
  } else {
    alert.style.display = 'none';
  }
}

// הוסף הבראה לשדה ה-notes ולסכום החודשי
function addHavraToMonth() {
  const rate  = appData.rates?.havraRate || 378;
  const days  = calcHavraDays(appData.worker?.startDate);
  const total = days * rate;
  const notes = v('m-notes');
  setV('m-notes', (notes ? notes + ' | ' : '') + `הבראה ${days} ימים ₪${total.toLocaleString()}`);
  const expenses = parseFloat(v('m-expenses')) || 0;
  setV('m-expenses', expenses + total);
  updateSummary();
  renderModalEmployerCosts();
  toast(`✓ הבראה ₪${total.toLocaleString()} נוספה להחזר הוצאות`);
  document.getElementById('havra-alert').style.display = 'none';
}
// ─────────────── TERMINATION REPORT (דוח סיום) ───────────────

function calcTermination() {
  const endDate   = v('term-end-date');
  const salary    = parseFloat(v('term-salary')) || 0;
  const unusedVac = parseInt(v('term-unused-vac')) || 0;
  const reason    = v('term-reason');
  const startDate = appData.worker?.startDate;

  if (!endDate || !salary || !startDate) return;

  const start  = new Date(startDate);
  const end    = new Date(endDate);
  const msYear = 1000 * 60 * 60 * 24 * 365.25;
  const years  = (end - start) / msYear;

  if (years < 0) { toast('תאריך סיום לפני תאריך התחלה'); return; }

  const dailySalary = salary / 25;
  const rows = [];
  let total  = 0;

  // 1. פיצויי פיטורים (רק בפיטורים / הסכמה)
  if (reason !== 'resigned') {
    const severance = salary * years;
    rows.push({ label: `פיצויי פיטורים (${years.toFixed(2)} שנים × ₪${salary.toLocaleString()})`, amount: severance, color: 'var(--danger)' });
    total += severance;
  }

  // 2. הודעה מוקדמת
  const noticeMonths = Math.min(Math.floor(years), 6);
  if (noticeMonths > 0) {
    const noticePay = salary * noticeMonths / 12 * 12;
    rows.push({ label: `הודעה מוקדמת (${noticeMonths} חודשים)`, amount: salary * noticeMonths, color: 'var(--warn)' });
    total += salary * noticeMonths;
  }

  // 3. פדיון חופשה
  if (unusedVac > 0) {
    const vacPay = dailySalary * unusedVac;
    rows.push({ label: `פדיון חופשה (${unusedVac} ימים × ₪${dailySalary.toFixed(0)})`, amount: vacPay, color: 'var(--success)' });
    total += vacPay;
  }

  // 4. הבראה יחסית לשנה האחרונה
  const lastYearFraction = years - Math.floor(years);
  if (lastYearFraction > 0) {
    const havraRate = appData.rates?.havraRate || 378;
    const havraDays = calcHavraDays(startDate);
    const havraPro  = havraRate * havraDays * lastYearFraction;
    rows.push({ label: `הבראה יחסית (${(lastYearFraction * 12).toFixed(1)} חודשים)`, amount: havraPro, color: 'var(--holiday)' });
    total += havraPro;
  }

  // 5. שכר חלקי לחודש האחרון
  const lastMonthDays = end.getDate();
  const daysInMonth   = new Date(end.getFullYear(), end.getMonth()+1, 0).getDate();
  if (lastMonthDays < daysInMonth) {
    const partialSalary = (salary / daysInMonth) * lastMonthDays;
    rows.push({ label: `שכר חלקי (${lastMonthDays}/${daysInMonth} ימים)`, amount: partialSalary, color: 'var(--accent)' });
    total += partialSalary;
  }

  const rowsHtml = rows.map(r => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;color:var(--text2);">${r.label}</span>
      <span style="font-weight:700;color:${r.color};">₪${r.amount.toLocaleString('he-IL',{maximumFractionDigits:0})}</span>
    </div>`).join('');

  document.getElementById('term-rows').innerHTML = rowsHtml;
  setText('term-total', '₪' + total.toLocaleString('he-IL', {maximumFractionDigits:0}));
  document.getElementById('termination-result').style.display = 'block';
  document.getElementById('termination-placeholder').style.display = 'none';
  window._termData = { rows, total, years, startDate, endDate, reason, salary };
}

function generateTerminationPDF() {
  const d = window._termData;
  if (!d) { toast('חשב קודם את הסיום'); return; }
  const w = appData.worker;
  const reasonText = { fired:'פיטורים', resigned:'התפטרות', mutual:'הסכמה הדדית' }[d.reason] || '';

  const rowsHtml = d.rows.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${r.label}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:left;font-weight:600;">
        ₪${r.amount.toLocaleString('he-IL',{maximumFractionDigits:0})}
      </td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"/>
<title>דוח סיום – ${w?.name||'עובדת'}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>
  body{font-family:'Heebo',sans-serif;direction:rtl;padding:40px;max-width:680px;margin:0 auto;color:#111;}
  h1{font-size:24px;font-weight:900;color:#1a1f2e;margin-bottom:4px;}
  .sub{color:#e11d48;font-size:15px;font-weight:700;margin-bottom:24px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;}
  .box{background:#f8faff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;}
  .box-title{font-size:11px;color:#888;font-weight:700;margin-bottom:6px;}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;}
  th{background:#f1f5f9;padding:10px 8px;text-align:right;font-size:12px;color:#555;}
  .total-row td{border-top:3px solid #e11d48;font-size:16px;font-weight:900;color:#e11d48;padding-top:12px;}
  .sig{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;}
  .sig-box{border-top:2px solid #333;padding-top:10px;font-size:12px;color:#555;text-align:center;}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:24px;border-top:1px solid #eee;padding-top:12px;}
  .print-btn{display:block;margin:0 auto 24px;padding:10px 28px;background:#e11d48;color:#fff;border:none;border-radius:8px;font-size:15px;font-family:'Heebo',sans-serif;font-weight:700;cursor:pointer;}
  @media print{.print-btn{display:none}@page{size:A4;margin:15mm}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור PDF</button>
<h1>דוח סיום התקשרות</h1>
<div class="sub">שכרון ✦ — ${new Date().toLocaleDateString('he-IL')}</div>
<div class="grid">
  <div class="box">
    <div class="box-title">פרטי עובדת</div>
    <div style="font-size:15px;font-weight:700;">${w?.name||'—'}</div>
    <div style="font-size:13px;color:#555;margin-top:4px;">דרכון: ${w?.passport||'—'}</div>
    <div style="font-size:13px;color:#555;">תחילת עבודה: ${d.startDate||'—'}</div>
    <div style="font-size:13px;color:#555;">סיום עבודה: ${d.endDate}</div>
  </div>
  <div class="box">
    <div class="box-title">פרטי סיום</div>
    <div style="font-size:15px;font-weight:700;color:#e11d48;">${reasonText}</div>
    <div style="font-size:13px;color:#555;margin-top:4px;">ותק: ${d.years.toFixed(2)} שנים</div>
    <div style="font-size:13px;color:#555;">שכר אחרון: ₪${Number(d.salary).toLocaleString()}</div>
  </div>
</div>
<table>
  <thead><tr><th>פירוט</th><th style="text-align:left;">סכום</th></tr></thead>
  <tbody>
    ${rowsHtml}
    <tr class="total-row">
      <td style="padding:12px 8px;">סה"כ לתשלום</td>
      <td style="padding:12px 8px;text-align:left;">₪${d.total.toLocaleString('he-IL',{maximumFractionDigits:0})}</td>
    </tr>
  </tbody>
</table>
<div class="sig">
  <div class="sig-box"><div>חתימת המעסיק</div><br/><br/><div>תאריך: ___________</div></div>
  <div class="sig-box"><div>חתימת העובדת</div><br/><br/><div>קיבלתי את מלוא הסכום המגיע לי</div></div>
</div>
<div class="footer">הופק ע"י שכרון ✦ • ${new Date().toLocaleDateString('he-IL')} • אינו מהווה ייעוץ משפטי</div>
</body></html>`;

  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `סיום_${w?.name||'עובדת'}_${d.endDate}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('דוח סיום נפתח – לחץ הדפס לשמירת PDF');
}

// ─────────────── HELPERS ───────────────
function v(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setV(id, val) { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// Update summary on base/expense change
document.addEventListener('input', e => {
  if (['m-base','m-expenses'].includes(e.target.id)) {
    updateSummary();
    renderModalEmployerCosts();
  }
});

// ─────────────── PLAN GATING ───────────────
// החלף ל-true כשמשתמש משלם (Supabase: profiles.plan === 'premium')
function isPremium() {
  return appData.profile?.plan === 'premium' ||
         localStorage.getItem('shakaron_premium') === 'true';
}

// חסום גישה לפיצ'ר פרימיום — מציג blur + lock ופותח מסך פרימיום
function requirePremium(featureName) {
  if (isPremium()) return true;
  toast(`🔒 ${featureName} זמין בגרסת הפרימיום`);
  setTimeout(() => showScreen('screen-premium'), 800);
  return false;
}

// ─────────────── PREMIUM SCREEN ───────────────
const FEATURES = [
  { label: 'פרטי עובדת (שם, דרכון, ויזה)',   free: true,  pro: true  },
  { label: 'תנאי שכר בסיסיים',                free: true,  pro: true  },
  { label: 'חודש חישוב אחד',                  free: true,  pro: true  },
  { label: 'לוח שנה + חגים אוטומטיים',        free: true,  pro: true  },
  { label: 'PDF בסיסי לחודש אחד',             free: true,  pro: true  },
  { label: 'מדריך העסקה המלא',                free: true,  pro: true  },
  { label: 'היסטוריה ללא הגבלה',              free: false, pro: true  },
  { label: 'ניהול חודשי ללא הגבלה',           free: false, pro: true  },
  { label: 'תלושי שכר PDF מקצועיים',          free: false, pro: true  },
  { label: 'ניהול הוצאות מעסיק',              free: false, pro: true  },
  { label: 'מעקב ימי חג וחופשה',              free: false, pro: true  },
  { label: 'סנכרון ענן אוטומטי',              free: false, pro: true  },
  { label: 'תזכורות ויזה + תשלומי ב"ל',       free: false, pro: true  },
  { label: 'ייצוא Excel לרואה חשבון',         free: false, pro: true  },
  { label: 'צירוף מסמכים (דרכון, חוזה)',       free: false, pro: true  },
];

function renderPremiumScreen() {
  // Feature table
  const tbody = document.getElementById('feature-table-body');
  if (tbody) {
    tbody.innerHTML = FEATURES.map(f => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:9px 8px;font-size:13px;">${f.label}</td>
        <td style="padding:9px 16px;text-align:center;font-size:16px;">${f.free ? '<span style="color:var(--success);">✓</span>' : '<span style="color:var(--text3);">—</span>'}</td>
        <td style="padding:9px 16px;text-align:center;font-size:16px;background:rgba(91,127,255,0.05);">${f.pro ? '<span style="color:var(--success);">✓</span>' : '—'}</td>
      </tr>`).join('');
  }
  // Signup count
  const count = parseInt(localStorage.getItem('signup_count') || '0');
  const el = document.getElementById('signup-count-display');
  if (el) el.innerHTML = `הצטרפו כבר <strong style="color:var(--accent);">${count}</strong> משפחות לרשימת המתנה`;

  // Dev toggle (הסר בפרודקשן)
  const devArea = document.getElementById('dev-toggle-area');
  if (devArea) {
    const on = isPremium();
    devArea.innerHTML = `<button class="btn btn-outline btn-sm" onclick="toggleDevPremium()" style="font-size:11px;color:var(--text3);">
      🔧 מצב פיתוח: ${on ? 'פרימיום ✓' : 'חינמי'}
    </button>`;
  }
}

function openSignup(plan) {
  const card = document.getElementById('signup-card');
  if (!card) return;
  card.style.display = 'block';
  setV('signup-plan', plan);
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function submitSignup() {
  const name  = v('signup-name').trim();
  const email = v('signup-email').trim();
  if (!name || !email) { toast('נא למלא שם ואימייל'); return; }
  if (!email.includes('@')) { toast('כתובת אימייל לא תקינה'); return; }

  // Save locally
  const signups = JSON.parse(localStorage.getItem('signups') || '[]');
  signups.push({
    name, email,
    phone:    v('signup-phone'),
    plan:     v('signup-plan'),
    feedback: v('signup-feedback'),
    date:     new Date().toISOString()
  });
  localStorage.setItem('signups', JSON.stringify(signups));
  localStorage.setItem('signup_count', signups.length);

  // Try sync to Gist
  syncSignupsToGist(signups);

  // UI feedback
  document.getElementById('signup-msg').style.display = 'inline';
  setV('signup-name', ''); setV('signup-email', '');
  setV('signup-phone', ''); setV('signup-feedback', '');
  renderPremiumScreen();
  toast('✓ נרשמת בהצלחה!');
}

function toggleDevPremium() {
  const current = localStorage.getItem('shakaron_premium') === 'true';
  localStorage.setItem('shakaron_premium', (!current).toString());
  applyPlanGates();
  renderPremiumScreen();
  toast(current ? '🔓 מצב חינמי' : '⭐ מצב פרימיום');
}

async function syncSignupsToGist(signups) {
  const token = localStorage.getItem('gh_token');
  if (!token) return;
  const gistId = localStorage.getItem('gh_signups_gist_id');
  const body = {
    description: 'שכרון – רשימת הרשמות פרימיום',
    public: false,
    files: { 'shakaron_signups.json': { content: JSON.stringify(signups, null, 2) } }
  };
  try {
    let url = 'https://api.github.com/gists', method = 'POST';
    if (gistId) { url += '/' + gistId; method = 'PATCH'; }
    const res = await fetch(url, {
      method,
      headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.id) localStorage.setItem('gh_signups_gist_id', data.id);
  } catch(e) { console.log('Gist sync failed silently'); }
}

// ─────────────── EMPLOYER COSTS ───────────────

function saveRates() {
  const havraDays = parseFloat(v('r-havra-days')) || 0;
  const havraRate = parseFloat(v('r-havra-rate')) || 0;
  const havraAnnual = havraDays * havraRate;
  const havraMonthly = havraAnnual / 12;

  appData.rates = {
    bituach:     parseFloat(v('r-bituach')) || 0,
    pension:     parseFloat(v('r-pension')) || 0,
    havraDays,
    havraRate,
    havraMonthly,
    havraAnnual,
  };
  saveLocal();

  // עדכן תצוגת הבראה
  setText('havra-annual-disp',  havraAnnual.toFixed(0));
  setText('havra-monthly-disp', havraMonthly.toFixed(2));

  renderCostsScreen();
  renderModalEmployerCosts();
}

function populateRatesForm() {
  const r = appData.rates || {};
  setV('r-bituach',     r.bituach);
  setV('r-pension',     r.pension);
  setV('r-havra-rate',  r.havraRate);
  setV('r-havra-month', r.havraMonth || '7');
  updateHavraPreview();
}

function calcEmployerCosts(grossSalary) {
  const r = appData.rates || {};
  const bituach      = (grossSalary * (r.bituach || 0)) / 100;
  const pension      = (grossSalary * (r.pension  || 0)) / 100;
  const havraMonthly = ((r.havraRate || 0) * calcHavraDays(appData.worker?.startDate)) / 12;
  const total        = bituach + pension + havraMonthly;
  return { bituach, pension, havraMonthly, total };
}

// הצג הוצאות מעסיק בתוך מודל החודש
function renderModalEmployerCosts() {
  const el = document.getElementById('modal-employer-costs');
  if (!el) return;
  const base = parseFloat(v('m-base')) || 0;
  if (!base) { el.innerHTML = '<span style="color:var(--text3)">הזן שכר בסיס כדי לחשב</span>'; return; }
  const c = calcEmployerCosts(base);
  const r = appData.rates || {};
  const rows = [
    r.bituach      ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>ביטוח לאומי מעסיק (${r.bituach}%)</span><span>₪${c.bituach.toFixed(2)}</span></div>` : '',
    r.pension      ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>פנסיה/קה״ש מעסיק (${r.pension}%)</span><span>₪${c.pension.toFixed(2)}</span></div>` : '',
    c.havraMonthly ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>הבראה (${r.havraDays} ימים × ₪${r.havraRate} ÷ 12)</span><span>₪${c.havraMonthly.toFixed(2)}</span></div>` : '',
  ].filter(Boolean).join('');
  el.innerHTML = rows
    + `<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700;color:var(--warn);">
         <span>סה״כ הוצאות מעסיק</span><span>₪${c.total.toFixed(2)}</span>
       </div>
       <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--danger);margin-top:4px;">
         <span>עלות כוללת (שכר + מעסיק)</span><span>₪${(base + c.total).toFixed(2)}</span>
       </div>`;
}

// מסך הוצאות מעסיק – סיכומים וטבלה
function renderCostsScreen() {
  const months = Object.entries(appData.months).sort((a,b) => a[0].localeCompare(b[0]));
  if (!months.length) {
    document.getElementById('costs-table-container').innerHTML =
      '<div style="color:var(--text3);text-align:center;padding:32px;">אין חודשים מוגדרים עדיין</div>';
    setText('cs-total-salary',   '₪0');
    setText('cs-total-employer', '₪0');
    setText('cs-total-all',      '₪0');
    setText('cs-months-count',   '0');
    return;
  }

  const w = appData.worker;
  const r = appData.rates || {};
  let cumGross = 0, cumBituach = 0, cumPension = 0, cumHavra = 0, cumEmployer = 0;

  const rows = months.map(([key, m]) => {
    const [yr, mo] = key.split('-');
    const label = HEB_MONTHS[parseInt(mo)-1] + ' ' + yr;

    // ברוטו מלא = בסיס + שבתות + חגים + החזר הוצאות
    const base    = parseFloat(m.base) || 0;
    const sabBonus = parseFloat(w.shabbatBonus) || 0;
    const holBonus = parseFloat(w.holidayBonus) || 0;
    const nSab    = (m.shabbats || []).length;
    const nHol    = (m.holidays || []).length;
    const exp     = parseFloat(m.expenses) || 0;
    const gross   = base + nSab * sabBonus + nHol * holBonus + exp;

    const c = calcEmployerCosts(base); // ב"ל ופנסיה על שכר בסיס בלבד (נהוג)
    cumGross    += gross;
    cumBituach  += c.bituach;
    cumPension  += c.pension;
    cumHavra    += c.havraMonthly;
    cumEmployer += c.total;

    const monthTotal = gross + c.total;

    const detailParts = [];
    if (nSab) detailParts.push(`${nSab} שב׳`);
    if (nHol) detailParts.push(`${nHol} חג`);
    if (exp)  detailParts.push(`החזר ₪${exp.toLocaleString()}`);
    const detail = detailParts.length ? `<div style="font-size:11px;color:var(--text3);">${detailParts.join(' · ')}</div>` : '';

    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:10px 8px;font-weight:600;white-space:nowrap;">${label}</td>
        <td style="padding:10px 8px;text-align:left;">
          <div style="font-weight:600;">₪${gross.toLocaleString()}</div>
          ${detail}
        </td>
        <td style="padding:10px 8px;text-align:left;">
          <div style="font-weight:600;">₪${c.bituach.toFixed(0)}</div>
          ${r.bituach ? `<div style="font-size:11px;color:var(--text3);">${r.bituach}%</div>` : ''}
        </td>
        <td style="padding:10px 8px;text-align:left;">
          <div style="font-weight:600;">₪${c.pension.toFixed(0)}</div>
          ${r.pension ? `<div style="font-size:11px;color:var(--text3);">${r.pension}%</div>` : ''}
        </td>
        <td style="padding:10px 8px;text-align:left;">
          <div style="font-weight:600;">₪${c.havraMonthly.toFixed(0)}</div>
          ${r.havraDays ? `<div style="font-size:11px;color:var(--text3);">${r.havraDays}י×₪${r.havraRate}÷12</div>` : ''}
        </td>
        <td style="padding:10px 8px;text-align:left;">
          <div style="font-weight:700;color:var(--warn);">₪${c.total.toFixed(0)}</div>
        </td>
        <td style="padding:10px 8px;text-align:left;">
          <div style="font-weight:700;color:var(--danger);">₪${monthTotal.toFixed(0)}</div>
        </td>
      </tr>`;
  }).join('');

  const totalAll = cumGross + cumEmployer;

  document.getElementById('costs-table-container').innerHTML = `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);color:var(--text2);">
          <th style="padding:8px;text-align:right;font-weight:600;">חודש</th>
          <th style="padding:8px;text-align:left;font-weight:600;">ברוטו כולל</th>
          <th style="padding:8px;text-align:left;font-weight:600;">ביטוח לאומי</th>
          <th style="padding:8px;text-align:left;font-weight:600;">פנסיה + פיצויים</th>
          <th style="padding:8px;text-align:left;font-weight:600;">הבראה</th>
          <th style="padding:8px;text-align:left;font-weight:600;color:var(--warn);">הוצ׳ מעסיק</th>
          <th style="padding:8px;text-align:left;font-weight:600;color:var(--danger);">עלות כוללת</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td style="padding:12px 8px;font-weight:700;">סה״כ מצטבר</td>
          <td style="padding:12px 8px;text-align:left;font-weight:700;">₪${cumGross.toLocaleString()}</td>
          <td style="padding:12px 8px;text-align:left;font-weight:700;">₪${cumBituach.toFixed(0)}</td>
          <td style="padding:12px 8px;text-align:left;font-weight:700;">₪${cumPension.toFixed(0)}</td>
          <td style="padding:12px 8px;text-align:left;font-weight:700;">₪${cumHavra.toFixed(0)}</td>
          <td style="padding:12px 8px;text-align:left;font-weight:700;color:var(--warn);">₪${cumEmployer.toFixed(0)}</td>
          <td style="padding:12px 8px;text-align:left;font-weight:700;color:var(--danger);">₪${totalAll.toFixed(0)}</td>
        </tr>
      </tfoot>
    </table>
    </div>`;

  setText('cs-total-salary',   '₪' + cumGross.toLocaleString());
  setText('cs-total-employer', '₪' + cumEmployer.toLocaleString());
  setText('cs-total-all',      '₪' + totalAll.toLocaleString());
  setText('cs-months-count',   months.length);
}
