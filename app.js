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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

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
  const idx = id === 'screen-worker' ? 0 : id === 'screen-salary' ? 1 : 2;
  document.querySelectorAll('.nav-tab')[idx].classList.add('active');
  if (id === 'screen-salary') renderMonthsList();
  if (id === 'screen-costs') { populateRatesForm(); renderCostsScreen(); }
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
async function generatePDF() {
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
  const exp = parseFloat(v('m-expenses')) || 0;
  const sabBonus = parseFloat(w.shabbatBonus) || 0;
  const holBonus = parseFloat(w.holidayBonus) || 0;
  const total = base + nSab * sabBonus + nHol * holBonus + exp;

  // הוצאות מעסיק
  const ec = calcEmployerCosts(base);
  const r  = appData.rates || {};
  const employerRows = [
    r.bituach      ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#555;">ביטוח לאומי מעסיק (${r.bituach}%)</span><span>₪${ec.bituach.toFixed(2)}</span></div>` : '',
    r.pension      ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#555;">פנסיה/קה״ש מעסיק (${r.pension}%)</span><span>₪${ec.pension.toFixed(2)}</span></div>` : '',
    ec.havraMonthly ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#555;">הבראה (${r.havraDays} ימים × ₪${r.havraRate} ÷ 12)</span><span>₪${ec.havraMonthly.toFixed(2)}</span></div>` : '',
  ].filter(Boolean).join('');
  const employerBlock = ec.total > 0 ? `
    <div style="background:#fffbeb;border-radius:10px;padding:16px;border:1px solid #fde68a;margin-bottom:16px;">
      <div style="font-size:12px;color:#92400e;font-weight:700;margin-bottom:8px;">💼 הוצאות מעסיק</div>
      ${employerRows}
      <div style="border-top:1px solid #fde68a;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700;color:#b45309;">
        <span>סה״כ הוצאות מעסיק:</span><span>₪${ec.total.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:900;color:#dc2626;margin-top:4px;font-size:14px;">
        <span>עלות כוללת למעסיק:</span><span>₪${(total + ec.total).toFixed(2)}</span>
      </div>
    </div>` : '';

  // Build calendar HTML for PDF
  let calHtml = '';
  const dayNames = ['א','ב','ג','ד','ה','ו','ש'];
  calHtml += dayNames.map(d => `<div style="text-align:center;font-weight:700;font-size:11px;color:#666;padding:4px;">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) calHtml += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = yr + '-' + String(mo).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isSat = isShabbat(dateStr);
    const holInfo = getHolidayInfo(dateStr, nationalities);
    const wSab = calState.workedShabbats.has(dateStr);
    const wHol = calState.workedHolidays.has(dateStr);

    let bg = '#fff', color = '#333', border = '1px solid #e5e7eb', fw = '400';
    if (wSab) { bg = '#fff3e0'; color = '#e65100'; border = '2px solid #f97316'; fw = '700'; }
    else if (wHol) { bg = '#ede7f6'; color = '#5e35b1'; border = '2px solid #818cf8'; fw = '700'; }
    else if (isSat) { color = '#f97316'; }
    else if (holInfo) { color = '#818cf8'; }

    calHtml += `<div style="text-align:center;padding:5px;background:${bg};color:${color};border:${border};border-radius:6px;font-weight:${fw};font-size:12px;min-height:30px;display:flex;align-items:center;justify-content:center;">${d}</div>`;
  }

  const preview = document.getElementById('report-preview');
  preview.style.display = 'block';
  preview.innerHTML = `
    <div style="font-family:'Heebo',sans-serif;direction:rtl;max-width:700px;margin:0 auto;padding:32px;color:#111;">
      <div style="text-align:center;margin-bottom:24px;border-bottom:3px solid #5b7fff;padding-bottom:16px;">
        <h1 style="font-size:26px;font-weight:900;color:#1a1f2e;margin-bottom:4px;">תלוש שכר – שכרון</h1>
        <div style="font-size:16px;color:#5b7fff;font-weight:700;">${monthLabel}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#f8faff;border-radius:10px;padding:16px;border:1px solid #e5e7eb;">
          <div style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600;">פרטי עובדת</div>
          <div style="font-size:15px;font-weight:700;">${w.name || '—'}</div>
          <div style="font-size:13px;color:#555;margin-top:4px;">דרכון: ${w.passport || '—'}</div>
          <div style="font-size:13px;color:#555;">תאריך התחלה: ${w.startDate || '—'}</div>
        </div>
        <div style="background:#f8faff;border-radius:10px;padding:16px;border:1px solid #e5e7eb;">
          <div style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600;">פרטי תשלום</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#555;">שכר בסיס:</span><span style="font-weight:600;">₪${Number(base).toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#f97316;">תוספת שבת (${nSab} × ₪${sabBonus}):</span><span style="font-weight:600;color:#f97316;">₪${Number(nSab*sabBonus).toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#818cf8;">תוספת חג (${nHol} × ₪${holBonus}):</span><span style="font-weight:600;color:#818cf8;">₪${Number(nHol*holBonus).toLocaleString()}</span></div>
          ${exp ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#555;">החזר הוצאות:</span><span style="font-weight:600;">₪${Number(exp).toLocaleString()}</span></div>` : ''}
          <div style="border-top:2px solid #5b7fff;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;"><span style="font-weight:700;">סה״כ לתשלום:</span><span style="font-size:18px;font-weight:900;color:#5b7fff;">₪${Number(total).toLocaleString()}</span></div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:#1a1f2e;">לוח שנה – ${monthLabel}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">
          ${calHtml}
        </div>
        <div style="display:flex;gap:20px;margin-top:10px;flex-wrap:wrap;">
          <span style="font-size:11px;display:flex;align-items:center;gap:5px;"><span style="background:#fff3e0;border:2px solid #f97316;border-radius:3px;width:14px;height:14px;display:inline-block;"></span> שבת עבדה</span>
          <span style="font-size:11px;display:flex;align-items:center;gap:5px;"><span style="background:#ede7f6;border:2px solid #818cf8;border-radius:3px;width:14px;height:14px;display:inline-block;"></span> חג עבד/ה</span>
          <span style="font-size:11px;display:flex;align-items:center;gap:5px;"><span style="color:#f97316;font-weight:700;">ש</span> שבת (לא עבדה)</span>
        </div>
      </div>

      <div style="background:#f8faff;border-radius:10px;padding:14px;border:1px solid #e5e7eb;margin-bottom:16px;">
        <div style="font-size:12px;color:#888;font-weight:600;margin-bottom:6px;">ניצול ימי חג ✦ חופשה</div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;">
          <span>חג – זכאות: <strong>${w.holTotal||0}</strong> | נוצל: <strong>${calcHolUsed()}</strong> | נותר: <strong>${Math.max(0,(w.holTotal||0)-calcHolUsed())}</strong></span>
          <span>חופשה – זכאות: <strong>${w.vacTotal||0}</strong> | נוצל: <strong>${calcTotalVacUsed()}</strong> | נותר: <strong>${Math.max(0,(w.vacTotal||0)-calcTotalVacUsed())}</strong></span>
        </div>
      </div>

      ${employerBlock}

      <div style="text-align:center;font-size:11px;color:#aaa;border-top:1px solid #e5e7eb;padding-top:12px;">
        הופק ע"י שכרון • ${new Date().toLocaleDateString('he-IL')}
      </div>
    </div>
  `;

  // Use html2canvas + jsPDF
  try {
    const canvas = await html2canvas(preview, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const imgW = 210;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH);
    pdf.save(`שכרון_${w.name||'עובדת'}_${key}.pdf`);
    toast('הדוח הורד ✓');
  } catch(e) {
    toast('שגיאה ביצירת PDF');
    console.error(e);
  } finally {
    preview.style.display = 'none';
    preview.innerHTML = '';
  }
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
  setV('r-bituach',    r.bituach);
  setV('r-pension',    r.pension);
  setV('r-havra-days', r.havraDays);
  setV('r-havra-rate', r.havraRate);

  const annual  = (r.havraDays||0) * (r.havraRate||0);
  const monthly = annual / 12;
  setText('havra-annual-disp',  annual.toFixed(0));
  setText('havra-monthly-disp', monthly.toFixed(2));
}

// חשב הוצאות מעסיק לחודש בודד לפי שכר ברוטו
function calcEmployerCosts(grossSalary) {
  const r = appData.rates || {};
  const bituach     = (grossSalary * (r.bituach || 0)) / 100;
  const pension     = (grossSalary * (r.pension  || 0)) / 100;
  const havraMonthly = r.havraMonthly || 0;
  const total       = bituach + pension + havraMonthly;
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

  let totalSalary = 0, totalEmployer = 0;
  const r = appData.rates || {};

  const rows = months.map(([key, m]) => {
    const [yr, mo] = key.split('-');
    const label = HEB_MONTHS[parseInt(mo)-1] + ' ' + yr;
    const gross = parseFloat(m.base) || 0;
    const c = calcEmployerCosts(gross);
    totalSalary   += gross;
    totalEmployer += c.total;
    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:10px 8px;font-weight:600;">${label}</td>
        <td style="padding:10px 8px;text-align:left;">₪${gross.toLocaleString()}</td>
        <td style="padding:10px 8px;text-align:left;color:var(--text2);">${r.bituach ? '₪'+c.bituach.toFixed(0) : '—'}</td>
        <td style="padding:10px 8px;text-align:left;color:var(--text2);">${r.pension  ? '₪'+c.pension.toFixed(0)  : '—'}</td>
        <td style="padding:10px 8px;text-align:left;color:var(--text2);">${r.havraDays ? '₪'+c.havraMonthly.toFixed(0) : '—'}</td>
        <td style="padding:10px 8px;text-align:left;color:var(--warn);font-weight:600;">₪${c.total.toFixed(0)}</td>
        <td style="padding:10px 8px;text-align:left;color:var(--danger);font-weight:700;">₪${(gross+c.total).toFixed(0)}</td>
      </tr>`;
  }).join('');

  const totalAll = totalSalary + totalEmployer;

  document.getElementById('costs-table-container').innerHTML = `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);color:var(--text2);">
          <th style="padding:8px;text-align:right;font-weight:600;">חודש</th>
          <th style="padding:8px;text-align:left;font-weight:600;">שכר ברוטו</th>
          <th style="padding:8px;text-align:left;font-weight:600;">${r.bituach ? `ב״ל (${r.bituach}%)` : 'ב״ל'}</th>
          <th style="padding:8px;text-align:left;font-weight:600;">${r.pension  ? `פנסיה (${r.pension}%)` : 'פנסיה'}</th>
          <th style="padding:8px;text-align:left;font-weight:600;">${r.havraDays ? `הבראה (${r.havraDays}י×₪${r.havraRate}÷12)` : 'הבראה'}</th>
          <th style="padding:8px;text-align:left;font-weight:600;color:var(--warn);">הוצ׳ מעסיק</th>
          <th style="padding:8px;text-align:left;font-weight:600;color:var(--danger);">עלות כוללת</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="border-top:2px solid var(--border);font-weight:700;background:var(--surface2);">
          <td style="padding:10px 8px;">סה״כ</td>
          <td style="padding:10px 8px;text-align:left;">₪${totalSalary.toLocaleString()}</td>
          <td colspan="3"></td>
          <td style="padding:10px 8px;text-align:left;color:var(--warn);">₪${totalEmployer.toLocaleString()}</td>
          <td style="padding:10px 8px;text-align:left;color:var(--danger);">₪${totalAll.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
    </div>`;

  setText('cs-total-salary',   '₪' + totalSalary.toLocaleString());
  setText('cs-total-employer', '₪' + totalEmployer.toLocaleString());
  setText('cs-total-all',      '₪' + totalAll.toLocaleString());
  setText('cs-months-count',   months.length);
}
