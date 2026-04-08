// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
let state = {
  template: 'classic',
  accent: '#c0392b',
  catalog: [],
  taxRows: [],
  rowId: 0,
  sigData: null,
  logoData: null,
};

// ════════════════════════════════════════════
// INVOICE NUMBER FORMAT BUILDER
// ════════════════════════════════════════════
function refreshInvNum() {
  const fmt    = document.getElementById('invFmt').value || '{YEAR}-INV-{NUM}';
  const cnt    = parseInt(document.getElementById('invCounter').value) || 1;
  const pad    = parseInt(document.getElementById('invPad').value) || 3;
  const prefix = (document.getElementById('invPrefix')?.value || '').trim();
  const now    = new Date();
  const year   = now.getFullYear();
  const yy     = String(year).slice(-2);
  const nextYY = String(year + 1).slice(-2);
  const mm     = String(now.getMonth() + 1).padStart(2, '0');
  const num    = String(cnt).padStart(pad, '0');

  let result = fmt
    .replace(/\{YEAR\}/g, year)
    .replace(/\{YY\}/g, yy + '-' + nextYY)  // e.g. 26-27
    .replace(/\{MM\}/g, mm)
    .replace(/\{NUM\}/g, num)
    .replace(/\{PREFIX\}/g, prefix || 'ACM');

  // Show prefix field only if format uses it
  const prefixField = document.getElementById('prefixField');
  if (prefixField) prefixField.style.display = fmt.includes('{PREFIX}') ? 'block' : 'none';

  document.getElementById('invNum').value = result;
  const preview = document.getElementById('invNumPreview');
  if (preview) preview.textContent = result;
  upd();
}

function insertFmt(token) {
  const inp = document.getElementById('invFmt');
  const start = inp.selectionStart;
  const end   = inp.selectionEnd;
  const val   = inp.value;
  inp.value = val.slice(0, start) + token + val.slice(end);
  inp.selectionStart = inp.selectionEnd = start + token.length;
  inp.focus();
  refreshInvNum();
}

function applyFmtPreset(fmt) {
  document.getElementById('invFmt').value = fmt;
  refreshInvNum();
}

// ════════════════════════════════════════════
// UPI DEEP LINK & QR
// ════════════════════════════════════════════
let upiMode = 'upi';

function setUPIMode(mode) {
  upiMode = mode;
  document.getElementById('upiFields').style.display      = mode === 'upi'    ? 'block' : 'none';
  document.getElementById('customQRFields').style.display = mode === 'custom' ? 'block' : 'none';
  document.getElementById('modeUPI').classList.toggle('active', mode === 'upi');
  document.getElementById('modeCustom').classList.toggle('active', mode === 'custom');
  upd();
}

function buildUPILink() {
  const pa   = document.getElementById('upiID').value.trim();
  const pn   = encodeURIComponent(document.getElementById('upiName').value.trim() || 'Payee');
  const amt  = document.getElementById('upiAmt').value.trim();
  const tn   = encodeURIComponent(document.getElementById('upiNote').value.trim() || 'Invoice Payment');
  const linkDisplay = document.getElementById('upiLinkDisplay');

  if (!pa) {
    linkDisplay.textContent = 'Fill UPI ID above to generate';
    document.getElementById('qrSidePreview').innerHTML = '';
    document.getElementById('qrSideEmpty').style.display = 'block';
    upd(); return;
  }

  let link = `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}&cu=INR`;
  if (amt) link += `&am=${amt}`;

  linkDisplay.textContent = link;
  document.getElementById('qrContent').value = link;

  // Side preview QR
  const wrap = document.getElementById('qrSidePreview');
  wrap.innerHTML = '';
  document.getElementById('qrSideEmpty').style.display = 'none';
  try {
    new QRCode(wrap, { text: link, width: 100, height: 100, correctLevel: QRCode.CorrectLevel.M });
  } catch(e) {}

  upd();
}

function autoFillUPIAmt() {
  // Calculate current grand total from preview
  const grandEl = document.getElementById('pGrand');
  if (grandEl) {
    const raw = grandEl.textContent.replace(/[^0-9.]/g, '');
    if (raw) { document.getElementById('upiAmt').value = raw; buildUPILink(); }
  }
}

function openUPIApp(app) {
  const pa  = document.getElementById('upiID').value.trim();
  const pn  = encodeURIComponent(document.getElementById('upiName').value.trim() || 'Payee');
  const amt = document.getElementById('upiAmt').value.trim();
  const tn  = encodeURIComponent(document.getElementById('upiNote').value.trim() || 'Invoice Payment');

  if (!pa) { alert('Please enter a UPI ID first.'); return; }

  let base = `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}&cu=INR`;
  if (amt) base += `&am=${amt}`;

  // App-specific deep links
  const links = {
    gpay:    `tez://upi/pay?pa=${pa}&pn=${pn}&tn=${tn}&cu=INR${amt?'&am='+amt:''}`,
    phonepe: `phonepe://pay?pa=${pa}&pn=${pn}&tn=${tn}&cu=INR${amt?'&am='+amt:''}`,
    paytm:   `paytmmp://pay?pa=${pa}&pn=${pn}&tn=${tn}&cu=INR${amt?'&am='+amt:''}`,
    bhim:    base,
  };

  // Try app deep link, fall back to standard UPI
  const a = document.createElement('a');
  a.href = links[app] || base;
  a.click();
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
function init() {
  // Invoice number counter from storage
  try {
    const cnt = parseInt(localStorage.getItem('invPro_count') || '1');
    document.getElementById('invCounter').value = cnt;
  } catch(e){}
  refreshInvNum();

  // Dates
  const today = new Date();
  const due = new Date(); due.setDate(today.getDate() + 30);
  document.getElementById('invDate').value = fmtInputDate(today);
  document.getElementById('dueDate').value = fmtInputDate(due);

  // Try restore state
  try {
    const saved = localStorage.getItem('invPro_state');
    if (saved) restoreState(JSON.parse(saved));
    else { addRow(); addTaxRow('GST', 18); }
  } catch(e) { addRow(); addTaxRow('GST', 18); }

  // Check URL params
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('d')) restoreFromURL(params.get('d'));
  } catch(e){}

  setupSigPad();
  renderCatalog();
  upd();
}

function fmtInputDate(d) {
  return d.toISOString().split('T')[0];
}

// ════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════
function switchTab(name, el) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  el.classList.add('active');
}

// ════════════════════════════════════════════
// LOGO
// ════════════════════════════════════════════
function loadLogo(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    state.logoData = ev.target.result;
    document.getElementById('thumbImg').src = ev.target.result;
    document.getElementById('thumbImg').style.display = 'block';
    upd();
  };
  r.readAsDataURL(file);
}

// ════════════════════════════════════════════
// TEMPLATE & ACCENT
// ════════════════════════════════════════════
function setTemplate(name, el) {
  state.template = name;
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const preview = document.getElementById('invoicePreview');
  preview.className = 'tpl-' + name;
  upd();
}

function updateAccent() {
  setAccent(document.getElementById('accentColor').value);
}
function setAccent(color) {
  state.accent = color;
  document.getElementById('accentColor').value = color;
  document.getElementById('invoicePreview').style.setProperty('--t-accent', color);
}

// ════════════════════════════════════════════
// SHIP TO TOGGLE
// ════════════════════════════════════════════
function toggleShipTo() {
  const b = document.getElementById('shipToBlock');
  b.style.display = b.style.display === 'none' ? 'block' : 'none';
  upd();
}

// ════════════════════════════════════════════
// CATALOG
// ════════════════════════════════════════════
function showAddCatalog() {
  const f = document.getElementById('addCatalogForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
function saveCatalogItem() {
  const name = document.getElementById('catName').value.trim();
  const price = parseFloat(document.getElementById('catPrice').value) || 0;
  const unit = document.getElementById('catUnit').value;
  if (!name) return;
  state.catalog.push({ name, price, unit });
  document.getElementById('catName').value = '';
  document.getElementById('catPrice').value = '';
  document.getElementById('addCatalogForm').style.display = 'none';
  renderCatalog();
  saveState();
}
function renderCatalog() {
  const list = document.getElementById('catalogList');
  if (!state.catalog.length) { list.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:10px 0">No items yet</div>'; return; }
  list.innerHTML = state.catalog.map((item, i) => `
    <div class="catalog-item" onclick="insertCatalogItem(${i})">
      <div>
        <div class="catalog-item-name">${item.name}</div>
        <div style="font-size:10px;color:var(--text3)">${item.unit}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="catalog-item-price">${getCur()}${item.price.toFixed(2)}</div>
        <button class="catalog-del" onclick="event.stopPropagation();delCatalogItem(${i})">×</button>
      </div>
    </div>
  `).join('');
}
function insertCatalogItem(i) {
  const item = state.catalog[i];
  addRow(item.name, 1, item.unit, item.price);
  switchTab('items', document.querySelector('.tab:nth-child(2)'));
}
function delCatalogItem(i) {
  state.catalog.splice(i, 1);
  renderCatalog();
  saveState();
}

// ════════════════════════════════════════════
// LINE ITEMS
// ════════════════════════════════════════════
function addRow(name='', qty=1, unit='Nos', price=0, disc=0) {
  state.rowId++;
  const id = state.rowId;
  const tbody = document.getElementById('itemsBody');
  const tr = document.createElement('tr');
  tr.id = 'row-' + id;
  tr.dataset.discType = 'flat';
  tr.innerHTML = `
    <td><input type="text" value="${name}" placeholder="Item description" oninput="upd()" style="min-width:110px"></td>
    <td><input type="number" value="${qty}" min="0" step="0.01" style="width:50px" oninput="upd()"></td>
    <td>
      <select onchange="upd()" style="width:58px;padding:5px 4px">
        <option ${unit==='Nos'?'selected':''}>Nos</option>
        <option ${unit==='Kg'?'selected':''}>Kg</option>
        <option ${unit==='Ltr'?'selected':''}>Ltr</option>
        <option ${unit==='Hr'?'selected':''}>Hr</option>
        <option ${unit==='m'?'selected':''}>m</option>
        <option ${unit==='Box'?'selected':''}>Box</option>
      </select>
    </td>
    <td><input type="number" value="${price}" min="0" step="0.01" style="width:68px" oninput="upd()"></td>
    <td>
      <div class="disc-type-toggle">
        <button class="disc-type-btn active" onclick="setDiscType(${id},'flat',this)">₹</button>
        <button class="disc-type-btn" onclick="setDiscType(${id},'pct',this)">%</button>
        <input type="number" value="${disc}" min="0" step="0.01" style="width:48px" oninput="upd()">
      </div>
    </td>
    <td><button class="del-row-btn" onclick="delRow(${id})">×</button></td>
  `;
  tbody.appendChild(tr);
  upd();
}
function setDiscType(id, type, btn) {
  const row = document.getElementById('row-' + id);
  row.dataset.discType = type;
  row.querySelectorAll('.disc-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  upd();
}
function delRow(id) {
  const el = document.getElementById('row-' + id);
  if (el) el.remove();
  upd();
}

// ════════════════════════════════════════════
// TAX ROWS
// ════════════════════════════════════════════
let taxId = 0;
function addTaxRow(name='', pct=0) {
  taxId++;
  const id = taxId;
  const wrap = document.getElementById('taxRows');
  const div = document.createElement('div');
  div.className = 'tax-row';
  div.id = 'tax-' + id;
  div.innerHTML = `
    <input type="text" value="${name}" placeholder="Tax name (e.g. CGST)" oninput="upd()">
    <input type="number" value="${pct}" min="0" max="100" step="0.01" placeholder="%" oninput="upd()">
    <button class="remove-tax" onclick="delTax(${id})">×</button>
  `;
  wrap.appendChild(div);
  upd();
}
function addGSTPreset() {
  addTaxRow('CGST', 9);
  addTaxRow('SGST', 9);
}
function delTax(id) {
  const el = document.getElementById('tax-' + id);
  if (el) el.remove();
  upd();
}

// ════════════════════════════════════════════
// SIGNATURE PAD
// ════════════════════════════════════════════
function setupSigPad() {
  const canvas = document.getElementById('sigCanvas');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  canvas.addEventListener('mousedown', e => { drawing = true; ctx.beginPath(); ctx.moveTo(...pos(e, canvas)); });
  canvas.addEventListener('mousemove', e => { if (!drawing) return; ctx.strokeStyle = '#e8e6f0'; ctx.lineWidth = 2; ctx.lineTo(...pos(e, canvas)); ctx.stroke(); });
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mouseleave', () => drawing = false);
  // Touch
  canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; ctx.beginPath(); ctx.moveTo(...pos(e.touches[0], canvas)); }, {passive:false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!drawing) return; ctx.strokeStyle = '#e8e6f0'; ctx.lineWidth = 2; ctx.lineTo(...pos(e.touches[0], canvas)); ctx.stroke(); }, {passive:false});
  canvas.addEventListener('touchend', () => drawing = false);
}
function pos(e, el) {
  const r = el.getBoundingClientRect();
  return [(e.clientX - r.left) * el.width / r.width, (e.clientY - r.top) * el.height / r.height];
}
function clearSig() {
  const c = document.getElementById('sigCanvas');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
}
function applySig() {
  const c = document.getElementById('sigCanvas');
  state.sigData = c.toDataURL();
  upd();
}
function loadSigImg(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => { state.sigData = ev.target.result; upd(); };
  r.readAsDataURL(file);
}

// ════════════════════════════════════════════
// getCur
// ════════════════════════════════════════════
function getCur() { return document.getElementById('currency').value; }

// ════════════════════════════════════════════
// UPDATE PREVIEW
// ════════════════════════════════════════════
function upd() {
  const cur = getCur();
  const preview = document.getElementById('invoicePreview');

  // Logo / From name
  const fromName = document.getElementById('fromName').value.trim();
  const pLogo = document.getElementById('pLogo');
  const pFromName = document.getElementById('pFromName');
  if (state.logoData) {
    pLogo.src = state.logoData;
    pLogo.style.display = 'block';
    pFromName.style.display = 'none';
  } else {
    pLogo.style.display = 'none';
    pFromName.textContent = fromName;
    pFromName.style.display = fromName ? 'block' : 'none';
  }

  // From body
  document.getElementById('pFromNameBody').textContent = fromName;
  let fromDetail = '';
  const fromGST = document.getElementById('fromGST').value.trim();
  const fromPAN = document.getElementById('fromPAN').value.trim();
  const fromAddr = document.getElementById('fromAddr').value.trim();
  if (fromGST) fromDetail += 'GST: ' + fromGST + '<br>';
  if (fromPAN) fromDetail += 'PAN: ' + fromPAN + '<br>';
  if (fromAddr) fromDetail += fromAddr.replace(/\n/g,'<br>');
  document.getElementById('pFromDetail').innerHTML = fromDetail;

  // Invoice meta
  document.getElementById('pInvNum').textContent = document.getElementById('invNum').value;
  const invDateVal = document.getElementById('invDate').value;
  const dueDateVal = document.getElementById('dueDate').value;
  document.getElementById('pDate').textContent = invDateVal ? fmtDate(invDateVal) : '—';
  document.getElementById('pDue').textContent = dueDateVal ? fmtDate(dueDateVal) : '—';

  // Status stamp
  const status = document.getElementById('invStatus').value;
  const stamp = document.getElementById('invStamp');
  const stampText = document.getElementById('invStampText');
  stamp.style.display = status !== 'draft' ? 'block' : 'none';
  stamp.className = 'inv-stamp stamp-' + status;
  stampText.textContent = status.toUpperCase();

  // Bill To
  const custName = document.getElementById('custName').value.trim();
  document.getElementById('pCustName').textContent = custName || '—';
  let custDetail = '';
  const custGST = document.getElementById('custGST').value.trim();
  const custPhone = document.getElementById('custPhone').value.trim();
  const custAddr = document.getElementById('custAddr').value.trim();
  if (custGST) custDetail += 'GST: ' + custGST + '<br>';
  if (custPhone) custDetail += custPhone + '<br>';
  if (custAddr) custDetail += custAddr.replace(/\n/g,'<br>');
  document.getElementById('pCustDetail').innerHTML = custDetail;

  // Ship To
  const shipName = document.getElementById('shipName').value.trim();
  const shipAddr = document.getElementById('shipAddr').value.trim();
  const shipBlock = document.getElementById('pShipBlock');
  if (shipName || shipAddr) {
    shipBlock.style.display = 'block';
    document.getElementById('pShipName').textContent = shipName;
    document.getElementById('pShipAddr').innerHTML = shipAddr.replace(/\n/g,'<br>');
  } else {
    shipBlock.style.display = 'none';
  }

  // Line items
  const rows = document.querySelectorAll('#itemsBody tr');
  const ptbody = document.getElementById('pItemsBody');
  ptbody.innerHTML = '';
  let subtotal = 0;

  rows.forEach(row => {
    const inputs = row.querySelectorAll('input[type="text"], input[type="number"]');
    const sel = row.querySelector('select');
    const discType = row.dataset.discType || 'flat';

    const itemName = inputs[0] ? inputs[0].value.trim() : '';
    const qty  = parseFloat(inputs[1] ? inputs[1].value : 0) || 0;
    const unit = sel ? sel.value : 'Nos';
    const price = parseFloat(inputs[2] ? inputs[2].value : 0) || 0;
    const discVal = parseFloat(inputs[3] ? inputs[3].value : 0) || 0;

    const discAmt = discType === 'pct' ? (qty * price * discVal / 100) : discVal;
    const lineTotal = Math.max(0, qty * price - discAmt);
    subtotal += lineTotal;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="inv-item-name">${itemName || '<em style="color:#bbb">—</em>'}</div></td>
      <td>${qty}</td>
      <td>${unit}</td>
      <td>${cur}${price.toFixed(2)}</td>
      <td>${discAmt > 0 ? '−' + cur + discAmt.toFixed(2) : '—'}</td>
      <td>${cur}${lineTotal.toFixed(2)}</td>
    `;
    ptbody.appendChild(tr);
  });

  // Overall discount
  const overallDiscAmt = parseFloat(document.getElementById('overallDiscAmt').value) || 0;
  const overallDiscPct = parseFloat(document.getElementById('overallDiscPct').value) || 0;
  const afterDiscount = Math.max(0, subtotal - overallDiscAmt);
  document.getElementById('overallDiscDisplay').textContent = cur + overallDiscAmt.toFixed(2);
  document.getElementById('overallDiscCur').textContent = cur;

  // Taxes (applied after overall discount)
  const taxRowEls = document.querySelectorAll('#taxRows .tax-row');
  const totBody = document.getElementById('pTotalsBody');
  totBody.innerHTML = `<tr><td>Subtotal</td><td>${cur}${subtotal.toFixed(2)}</td></tr>`;

  if (overallDiscAmt > 0) {
    totBody.innerHTML += `<tr><td style="color:#e05c5c">Overall Discount (${overallDiscPct > 0 ? overallDiscPct + '%' : 'flat'})</td><td style="color:#e05c5c">−${cur}${overallDiscAmt.toFixed(2)}</td></tr>`;
    totBody.innerHTML += `<tr><td>After Discount</td><td>${cur}${afterDiscount.toFixed(2)}</td></tr>`;
  }

  let totalTax = 0;
  taxRowEls.forEach(row => {
    const [nameIn, pctIn] = row.querySelectorAll('input');
    const taxName = nameIn.value.trim() || 'Tax';
    const taxPct = parseFloat(pctIn.value) || 0;
    const taxAmt = afterDiscount * taxPct / 100;
    totalTax += taxAmt;
    totBody.innerHTML += `<tr><td>${taxName} (${taxPct}%)</td><td>${cur}${taxAmt.toFixed(2)}</td></tr>`;
  });

  const grand = afterDiscount + totalTax;
  document.getElementById('pGrand').textContent = cur + grand.toFixed(2);

  // Notes
  const notesEl = document.getElementById('pNotes');
  const notesVal = document.getElementById('notes').value.trim();
  if (notesVal) {
    notesEl.style.display = 'block';
    notesEl.innerHTML = '<div class="inv-notes-title">Notes & Terms</div>' + notesVal.replace(/\n/g,'<br>');
  } else {
    notesEl.style.display = 'none';
  }

  // Bank
  const bankEl = document.getElementById('pBank');
  const bName = document.getElementById('bankName').value.trim();
  const bAcc = document.getElementById('bankAcc').value.trim();
  const bIFSC = document.getElementById('bankIFSC').value.trim();
  const bBranch = document.getElementById('bankBranch').value.trim();
  const bUPI = document.getElementById('bankUPI').value.trim();
  if (bName || bAcc || bUPI) {
    bankEl.style.display = 'block';
    let html = '<div class="inv-bank-title">Payment Details</div>';
    if (bName)   html += `<div class="inv-bank-row"><span class="inv-bank-key">Bank:</span>${bName}</div>`;
    if (bAcc)    html += `<div class="inv-bank-row"><span class="inv-bank-key">A/C:</span>${bAcc}</div>`;
    if (bIFSC)   html += `<div class="inv-bank-row"><span class="inv-bank-key">IFSC:</span>${bIFSC}</div>`;
    if (bBranch) html += `<div class="inv-bank-row"><span class="inv-bank-key">Branch:</span>${bBranch}</div>`;
    if (bUPI)    html += `<div class="inv-bank-row"><span class="inv-bank-key">UPI:</span>${bUPI}</div>`;
    bankEl.innerHTML = html;
  } else {
    bankEl.style.display = 'none';
  }

  // Signature
  const sigImg = document.getElementById('pSigImg');
  if (state.sigData) {
    sigImg.src = state.sigData;
    sigImg.style.display = 'block';
  } else {
    sigImg.style.display = 'none';
  }
  document.getElementById('pSigName').textContent = document.getElementById('sigName').value || 'Authorized Signatory';

  // QR
  const showQRCheck = document.getElementById('showQRCheck').checked;
  const showQRLabel = document.getElementById('showQRLabel')?.checked !== false;
  const qrContent = document.getElementById('qrContent').value.trim();
  const qrWrap = document.getElementById('pQRWrap');
  const pQR = document.getElementById('pQR');
  const pQRLabel = document.getElementById('pQRLabel');
  if (showQRCheck && qrContent) {
    qrWrap.style.display = 'block';
    pQR.innerHTML = '';
    try {
      new QRCode(pQR, { text: qrContent, width: 60, height: 60, correctLevel: QRCode.CorrectLevel.M });
    } catch(e) {}
    if (pQRLabel) pQRLabel.style.display = showQRLabel ? 'block' : 'none';
  } else {
    qrWrap.style.display = 'none';
  }

  // Update catalog currency display
  renderCatalog();
}

// ════════════════════════════════════════════
// DATE FORMAT
// ════════════════════════════════════════════
function fmtDate(str) {
  const [y,m,d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

// ════════════════════════════════════════════
// OVERALL DISCOUNT SYNC
// ════════════════════════════════════════════
function syncOverallDisc(changedField) {
  // Get current subtotal from items
  let subtotal = 0;
  document.querySelectorAll('#itemsBody tr').forEach(row => {
    const inputs = row.querySelectorAll('input[type="text"], input[type="number"]');
    const discType = row.dataset.discType || 'flat';
    const qty   = parseFloat(inputs[1]?.value) || 0;
    const price = parseFloat(inputs[2]?.value) || 0;
    const dv    = parseFloat(inputs[3]?.value) || 0;
    const discAmt = discType === 'pct' ? (qty * price * dv / 100) : dv;
    subtotal += Math.max(0, qty * price - discAmt);
  });

  const pctEl = document.getElementById('overallDiscPct');
  const amtEl = document.getElementById('overallDiscAmt');

  if (changedField === 'pct') {
    const pct = parseFloat(pctEl.value) || 0;
    amtEl.value = (subtotal * pct / 100).toFixed(2);
  } else {
    const amt = parseFloat(amtEl.value) || 0;
    pctEl.value = subtotal > 0 ? ((amt / subtotal) * 100).toFixed(2) : '0';
  }
  upd();
}

// ════════════════════════════════════════════
// PDF DOWNLOAD
// ════════════════════════════════════════════
function downloadPDF() {
  const el = document.getElementById('invoicePreview');
  const invNum = document.getElementById('invNum').value || 'invoice';
  // Temporarily hide stamp for cleaner optional export (keep it)
  html2pdf(el, {
    margin: 0,
    filename: invNum + '.pdf',
    html2canvas: { scale: 2.5, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  });
  // Increment invoice counter
  try {
    const counterEl = document.getElementById('invCounter');
    const next = (parseInt(counterEl.value) || 1) + 1;
    counterEl.value = next;
    localStorage.setItem('invPro_count', next);
    refreshInvNum();
  } catch(e){}
}

// ════════════════════════════════════════════
// SAVE / RESTORE STATE
// ════════════════════════════════════════════
function saveState() {
  try {
    const data = collectData();
    localStorage.setItem('invPro_state', JSON.stringify(data));
    // Flash feedback
    const btn = event.target;
    if (btn) { const orig = btn.textContent; btn.textContent = '✓ Saved'; setTimeout(() => btn.textContent = orig, 1200); }
  } catch(e) { console.warn('Save failed', e); }
}

function collectData() {
  const fields = ['fromName','fromGST','fromPAN','fromAddr','invNum','invDate','dueDate',
    'currency','invStatus','custName','custGST','custPhone','custAddr','shipName','shipAddr',
    'notes','bankName','bankAcc','bankIFSC','bankBranch','bankUPI','sigName','qrContent'];
  const data = {};
  fields.forEach(id => { try { data[id] = document.getElementById(id).value; } catch(e){} });
  data.catalog = state.catalog;
  data.template = state.template;
  data.accent = state.accent;
  data.sigData = state.sigData;
  data.logoData = state.logoData;
  // Items
  data.items = [];
  document.querySelectorAll('#itemsBody tr').forEach(row => {
    const inputs = row.querySelectorAll('input[type="text"], input[type="number"]');
    const sel = row.querySelector('select');
    data.items.push({
      name: inputs[0]?.value || '',
      qty: inputs[1]?.value || '1',
      unit: sel?.value || 'Nos',
      price: inputs[2]?.value || '0',
      disc: inputs[3]?.value || '0',
      discType: row.dataset.discType || 'flat'
    });
  });
  // Taxes
  data.taxes = [];
  document.querySelectorAll('#taxRows .tax-row').forEach(row => {
    const [nameIn, pctIn] = row.querySelectorAll('input');
    data.taxes.push({ name: nameIn.value, pct: pctIn.value });
  });
  return data;
}

function restoreState(data) {
  const fields = ['fromName','fromGST','fromPAN','fromAddr','invNum','invDate','dueDate',
    'currency','invStatus','custName','custGST','custPhone','custAddr','shipName','shipAddr',
    'notes','bankName','bankAcc','bankIFSC','bankBranch','bankUPI','sigName','qrContent'];
  fields.forEach(id => { try { if (data[id] !== undefined) document.getElementById(id).value = data[id]; } catch(e){} });

  if (data.catalog) state.catalog = data.catalog;
  if (data.template) { state.template = data.template; document.getElementById('invoicePreview').className = 'tpl-' + data.template; document.querySelectorAll('.tpl-card').forEach(c => { c.classList.toggle('active', c.dataset.tpl === data.template); }); }
  if (data.accent) { state.accent = data.accent; setAccent(data.accent); }
  if (data.sigData) state.sigData = data.sigData;
  if (data.logoData) {
    state.logoData = data.logoData;
    document.getElementById('thumbImg').src = data.logoData;
    document.getElementById('thumbImg').style.display = 'block';
  }

  // Items
  document.getElementById('itemsBody').innerHTML = '';
  state.rowId = 0;
  if (data.items && data.items.length) {
    data.items.forEach(item => addRow(item.name, item.qty, item.unit, item.price, item.disc));
  } else { addRow(); }

  // Taxes
  document.getElementById('taxRows').innerHTML = '';
  taxId = 0;
  if (data.taxes && data.taxes.length) {
    data.taxes.forEach(t => addTaxRow(t.name, t.pct));
  }

  renderCatalog();
}

// ════════════════════════════════════════════
// NEW INVOICE
// ════════════════════════════════════════════
function newInvoice() {
  if (!confirm('Start a new invoice? Unsaved changes will be lost.')) return;
  // Increment counter
  try {
    let cnt = parseInt(localStorage.getItem('invPro_count') || '1');
    localStorage.setItem('invPro_count', cnt + 1);
    document.getElementById('invNum').value = 'INV-' + String(cnt + 1).padStart(4,'0');
  } catch(e){}
  // Clear customer
  ['custName','custGST','custPhone','custAddr','shipName','shipAddr'].forEach(id => { try { document.getElementById(id).value = ''; } catch(e){} });
  document.getElementById('notes').value = '';
  document.getElementById('invStatus').value = 'unpaid';
  // Clear items
  document.getElementById('itemsBody').innerHTML = '';
  state.rowId = 0;
  addRow();
  // Reset dates
  const today = new Date();
  const due = new Date(); due.setDate(today.getDate() + 30);
  document.getElementById('invDate').value = fmtInputDate(today);
  document.getElementById('dueDate').value = fmtInputDate(due);
  state.sigData = null;
  upd();
}

// ════════════════════════════════════════════
// SHARE / QR MODAL
// ════════════════════════════════════════════
function showQR() {
  const data = collectData();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g,'%2B');
  const url = window.location.origin + window.location.pathname + '?d=' + encoded;
  document.getElementById('shareUrl').value = url;
  const qrOut = document.getElementById('qrOutput');
  qrOut.innerHTML = '';
  try {
    new QRCode(qrOut, { text: url.substring(0, 500), width: 160, height: 160, correctLevel: QRCode.CorrectLevel.L });
  } catch(e) { qrOut.textContent = 'QR unavailable for this data size'; }
  document.getElementById('shareModal').classList.add('open');
}
function closeModal() {
  document.getElementById('shareModal').classList.remove('open');
}
function copyLink() {
  const input = document.getElementById('shareUrl');
  navigator.clipboard.writeText(input.value).catch(() => { input.select(); document.execCommand('copy'); });
  const btn = event.target;
  btn.textContent = '✓ Copied!';
  setTimeout(() => btn.textContent = 'Copy Link', 1500);
}
function restoreFromURL(encoded) {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(encoded.replace(/%2B/g,'+')))));
    restoreState(data);
  } catch(e) { console.warn('Could not restore from URL'); }
}

// Close modal on overlay click
document.getElementById('shareModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Auto-save every 30s
setInterval(() => {
  try { localStorage.setItem('invPro_state', JSON.stringify(collectData())); } catch(e){}
}, 30000);

init();