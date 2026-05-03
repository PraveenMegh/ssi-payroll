/* SSI Inventory Module - Smart Entry */
const SSIInventory = (() => {
  const ENTRY_TYPES = [
    { value:'OPENING',     label:'📂 Opening Stock' },
    { value:'IN',          label:'📥 Stock IN (Received)' },
    { value:'OUT',         label:'📤 Stock OUT (Dispatched/Sold)' },
    { value:'ISSUE',       label:'🔧 Internal Issue (Consumable)' },
    { value:'ADJUST',      label:'⚖️ Adjustment' },
    { value:'TRANSFER_OUT',label:'↗️ Transfer OUT' },
    { value:'TRANSFER_IN', label:'↙️ Transfer IN' },
  ];

  const PACK_MODES = [
    { value:'BAG',         label:'🛍️ KG Bags (Size × Count)' },
    { value:'CARTON_STD',  label:'📦 Cartons – Use Product Std' },
    { value:'CARTON_MAN',  label:'📦 Cartons – Enter KG/Carton' },
    { value:'DIRECT_KG',   label:'⚖️ Direct KG Entry' },
    { value:'NOS',         label:'🔢 Units / NOS' },
  ];

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','STOCK','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    refresh(area);
  }

  function refresh(area) {
    const st = SSIApp.getState();
    // Sort ascending for running balance calculation, then reverse for display (newest first)
    const ledgerAsc = [...st.inventory].sort((a,b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : (a.created_at||'').localeCompare(b.created_at||'');
    });
    // Pre-compute running balance per (unit_id, product_id) pair — chronological order
    const balanceMap = {};  // key: `${unit_id}|${product_id}` → running total after each entry (by entry id)
    ledgerAsc.forEach(t => {
      const key = `${t.unit_id}|${t.product_id}`;
      if (!balanceMap[key]) balanceMap[key] = 0;
      const isOut = ['OUT','TRANSFER_OUT','ISSUE'].includes(t.type);
      balanceMap[key] += isOut ? -(t.qty||0) : (t.qty||0);
      t._runningBal = balanceMap[key];  // attach to entry object (temp)
    });
    const ledger = [...ledgerAsc].reverse();  // newest first for display

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">🏭 Inventory Ledger</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="SSIInventory.downloadTemplate()">⬇️ Template</button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            📥 Import Excel <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="SSIInventory.importExcel(this)">
          </label>
          <button class="btn btn-secondary btn-sm" onclick="SSIInventory.exportExcel()">📤 Export</button>
          <button class="btn btn-primary" onclick="SSIInventory.openEntryModal()">+ Add Entry</button>
          ${SSIApp.hasRole('ADMIN') ? `<button class="btn btn-danger btn-sm" onclick="SSIInventory.clearInventory()" title="Reset all inventory to zero" style="background:#ef4444;">🗑️ Reset to Zero</button>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom:16px;padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
          <div>
            <label>Filter by Unit</label>
            <select id="inv-filter-unit" onchange="SSIInventory.applyFilter()">
              <option value="">All Units</option>
              ${st.units.filter(u=>u.active).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Filter by Product</label>
            <select id="inv-filter-product" onchange="SSIInventory.applyFilter()">
              <option value="">All Products</option>
              ${st.products.filter(p=>p.active).map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Filter by Type</label>
            <select id="inv-filter-type" onchange="SSIInventory.applyFilter()">
              <option value="">All Types</option>
              ${ENTRY_TYPES.map(t=>`<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>From Date</label>
            <input type="date" id="inv-filter-from" onchange="SSIInventory.applyFilter()">
          </div>
          <div>
            <label>To Date</label>
            <input type="date" id="inv-filter-to" onchange="SSIInventory.applyFilter()">
          </div>
        </div>
      </div>

      <div class="card">
        <div style="overflow-x:auto;">
          <table id="inv-table">
            <thead><tr>
              <th>Date</th><th>Type</th><th>Unit</th><th>Product</th>
              <th>Pack Mode</th><th style="text-align:right;">Qty (KG/NOS)</th>
              <th style="text-align:right;">Closing Balance</th>
              <th>Bill / Note</th><th>By</th>
              
            </tr></thead>
            <tbody id="inv-tbody">
              ${renderRows(ledger, st)}
            </tbody>
          </table>
        </div>
        <div id="inv-count-total" style="margin-top:12px;font-size:13px;color:#94a3b8;">Total: ${ledger.length} entries</div>
      </div>`;
  }

  function renderRows(ledger, st) {
    if (!ledger.length) return `<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;">No inventory entries yet. Add your first entry!</td></tr>`;
    const typeColors     = {IN:'#dcfce7',OUT:'#fee2e2',OPENING:'#FDECEA',ADJUST:'#fef3c7',TRANSFER_OUT:'#fce7f3',TRANSFER_IN:'#ede9fe',ISSUE:'#ede9fe'};
    const typeTextColors = {IN:'#166534',OUT:'#991b1b',OPENING:'#D35400',ADJUST:'#92400e',TRANSFER_OUT:'#9d174d',TRANSFER_IN:'#5b21b6',ISSUE:'#6d28d9'};
    return ledger.map(t => {
      const prod   = st.products.find(p=>p.id===t.product_id);
      const unit   = st.units.find(u=>u.id===t.unit_id);
      const user   = st.users.find(u=>u.id===t.user_id);
      const bg     = typeColors[t.type]     || '#f1f5f9';
      const tc     = typeTextColors[t.type] || '#374151';
      const isOut  = ['OUT','TRANSFER_OUT','ISSUE'].includes(t.type);
      const bal    = t._runningBal ?? 0;
      const balNeg = bal < 0;
      // Closing balance cell styling
      const balBg  = balNeg ? '#fee2e2' : (bal === 0 ? '#f1f5f9' : '#f0fdf4');
      const balClr = balNeg ? '#dc2626' : (bal === 0 ? '#94a3b8' : '#15803d');
      const balIcon= balNeg ? '⚠️ ' : '';
      return `<tr data-unit="${t.unit_id}" data-product="${t.product_id}" data-type="${t.type}" data-date="${t.date}">
        <td style="white-space:nowrap;">${SSIApp.dateFmt(t.date)}</td>
        <td><span style="background:${bg};color:${tc};padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;">${t.type}</span></td>
        <td style="font-size:13px;">${unit?.name||'—'}</td>
        <td><strong>${prod?.name||'—'}</strong><br><span style="font-size:11px;color:#94a3b8;">${prod?.sku||''}</span></td>
        <td style="font-size:12px;color:#64748b;">${t.pack_desc||'—'}</td>
        <td style="text-align:right;font-weight:700;color:${isOut?'#dc2626':'#16a34a'};">${isOut?'-':'+'} ${SSIApp.qtyFmt(t.qty)} ${prod?.uom||'KG'}</td>
        <td style="text-align:right;">
          <span style="display:inline-block;background:${balBg};color:${balClr};padding:3px 10px;border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap;">
            ${balIcon}${SSIApp.qtyFmt(Math.abs(bal))} ${prod?.uom||'KG'}
          </span>
        </td>
        <td style="font-size:12px;color:#64748b;max-width:180px;">
          ${t.type==='ISSUE' && t.issued_to
            ? `<div style="font-weight:600;color:#6d28d9;">${t.issued_to}</div>
               <div style="color:#7c3aed;font-size:11px;">${t.purpose||'—'}</div>
               ${t.department?`<div style="color:#94a3b8;font-size:10px;">${t.department}</div>`:''}`
            : (t.note||'—')}
        </td>
        <td style="font-size:12px;color:#94a3b8;">${user?.name||t.user_name||'—'}</td>
        
      </tr>`;
    }).join('');
  }

  function applyFilter() {
    const unitF = document.getElementById('inv-filter-unit')?.value    || '';
    const prodF = document.getElementById('inv-filter-product')?.value || '';
    const typeF = document.getElementById('inv-filter-type')?.value    || '';
    const fromF = document.getElementById('inv-filter-from')?.value    || '';
    const toF   = document.getElementById('inv-filter-to')?.value      || '';
    const rows  = document.querySelectorAll('#inv-tbody tr[data-unit]');
    let visible = 0;
    rows.forEach(row => {
      const show = (!unitF || row.dataset.unit===unitF)
        && (!prodF || row.dataset.product===prodF)
        && (!typeF || row.dataset.type===typeF)
        && (!fromF || row.dataset.date >= fromF)
        && (!toF   || row.dataset.date <= toF);
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const cnt = document.getElementById('inv-count-total');
    if (cnt) cnt.textContent = `Showing: ${visible} entries`;
  }

  function _onTypeChange(type) {
    const issueFields = document.getElementById('inv-issue-fields');
    if (issueFields) {
      issueFields.style.display = (type === 'ISSUE') ? 'block' : 'none';
    }
  }

  function openEntryModal(prefillProductId, prefillUnitId) {
    const st = SSIApp.getState();
    const html = `
      <div class="modal-header">
        <h3 style="font-size:18px;font-weight:700;">📥 Add Inventory Entry</h3>
        <button onclick="SSIApp.closeModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid form-grid-2" style="margin-bottom:16px;">
          <div>
            <label>Date *</label>
            <input type="date" id="inv-date" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div>
            <label>Entry Type *</label>
            <select id="inv-type" onchange="SSIInventory._onTypeChange(this.value)">
              ${ENTRY_TYPES.map(t=>`<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>SSI Unit *</label>
            <select id="inv-unit" onchange="SSIInventory.onProductUnitChange()">
              <option value="">— Select Unit —</option>
              ${st.units.filter(u=>u.active).map(u=>`<option value="${u.id}" ${u.id===prefillUnitId?'selected':''}>${u.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Product *</label>
            <select id="inv-product" onchange="SSIInventory.onProductUnitChange()">
              <option value="">— Select Product —</option>
              ${st.products.filter(p=>p.active).map(p=>`<option value="${p.id}" ${p.id===prefillProductId?'selected':''}>${p.name} (${p.uom||'KG'})</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Product Info Card -->
        <div id="inv-info-card" style="display:none;" class="info-card">
          <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">UoM</span><br><strong id="inv-uom-badge">KG</strong></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Pack Sizes</span><br><span id="inv-pack-sizes" style="font-size:13px;">—</span></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Carton Std</span><br><span id="inv-carton-std" style="font-size:13px;">—</span></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Current Stock</span><br><strong id="inv-current-stock" style="font-size:16px;">—</strong></div>
          </div>
        </div>

        <!-- Pack Mode -->
        <div id="inv-pack-section" style="display:none;">
          <div style="margin-bottom:16px;">
            <label>Pack Type</label>
            <select id="inv-pack-mode" onchange="SSIInventory.onPackModeChange()">
              ${PACK_MODES.map(m=>`<option value="${m.value}">${m.label}</option>`).join('')}
            </select>
          </div>

          <div id="inv-pack-fields" class="form-grid form-grid-3">
            <!-- dynamically filled -->
          </div>

          <div id="inv-total-display" style="display:none;background:#f0fdf4;border:2px solid #16a34a;border-radius:10px;padding:14px 20px;margin-top:16px;text-align:center;">
            <span style="font-size:13px;color:#16a34a;font-weight:600;">Total Quantity</span><br>
            <span id="inv-total-qty" style="font-size:28px;font-weight:900;color:#16a34a;">0.000</span>
            <span id="inv-total-uom" style="font-size:16px;color:#16a34a;font-weight:600;"> KG</span>
          </div>
        </div>

        <!-- ISSUE-specific fields (shown only when type = ISSUE) -->
        <div id="inv-issue-fields" style="display:none;margin-top:16px;padding:16px;background:#f5f3ff;border:1.5px solid #c4b5fd;border-radius:10px;">
          <div style="font-weight:700;font-size:13px;color:#6d28d9;margin-bottom:12px;">🔧 Internal Issue Details</div>
          <div class="form-grid form-grid-2">
            <div>
              <label>Issued To (Employee) *</label>
              <select id="inv-issued-emp" style="border-color:#c4b5fd;">
                <option value="">— Select Employee —</option>
                ${(st.employees||[]).filter(e=>e.active!==false).map(e=>`<option value="${e.id}">${e.name} (${e.emp_code})</option>`).join('')}
              </select>
              <div style="font-size:11px;color:#7c3aed;margin-top:4px;">Or type a name below if not in employee list</div>
            </div>
            <div>
              <label>Or Enter Name (free text)</label>
              <input id="inv-issued-name" placeholder="e.g. Raju - Mechanic / Maintenance Team" style="border-color:#c4b5fd;">
            </div>
            <div>
              <label>Purpose / Reason *</label>
              <input id="inv-purpose" placeholder="e.g. Machine repair, Safety gloves, Cleaning" style="border-color:#c4b5fd;">
            </div>
            <div>
              <label>Department (optional)</label>
              <input id="inv-dept" placeholder="e.g. Production, Maintenance, Admin" style="border-color:#c4b5fd;">
            </div>
          </div>
        </div>

        <!-- Note -->
        <div style="margin-top:16px;">
          <label>Bill No. / Note</label>
          <input id="inv-note" placeholder="e.g. Bill No. 1234 / Truck No. UP15AB1234">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIInventory.saveEntry()">💾 Save Entry</button>
      </div>`;

    SSIApp.showModal(html);
    if (prefillProductId && prefillUnitId) setTimeout(() => onProductUnitChange(), 100);
  }

  function onProductUnitChange() {
    const productId = document.getElementById('inv-product')?.value;
    const unitId    = document.getElementById('inv-unit')?.value;
    const infoCard  = document.getElementById('inv-info-card');
    const packSec   = document.getElementById('inv-pack-section');

    if (!productId || !unitId) {
      if (infoCard) infoCard.style.display = 'none';
      if (packSec)  packSec.style.display  = 'none';
      return;
    }

    const st   = SSIApp.getState();
    const prod = st.products.find(p => p.id === productId);
    if (!prod) return;

    const currentStock = SSIApp.getStock(productId, unitId);
    const isNOS = prod.uom === 'NOS';

    document.getElementById('inv-uom-badge').textContent  = prod.uom || 'KG';
    document.getElementById('inv-pack-sizes').textContent = (prod.pack_sizes||[]).join(', ') || '—';
    document.getElementById('inv-carton-std').textContent = prod.carton_std > 0 ? prod.carton_std + ' KG/ctn' : '—';
    const stockEl = document.getElementById('inv-current-stock');
    stockEl.textContent = SSIApp.qtyFmt(currentStock) + ' ' + (prod.uom || 'KG');
    stockEl.style.color = currentStock <= 0 ? '#dc2626' : currentStock <= (prod.reorder_level||0) ? '#d97706' : '#16a34a';
    infoCard.style.display = 'block';
    packSec.style.display  = 'block';

    if (isNOS) document.getElementById('inv-pack-mode').value = 'NOS';
    onPackModeChange();
  }

  // ─── Build the pack-fields HTML and wire up events ─────────
  function onPackModeChange() {
    const mode      = document.getElementById('inv-pack-mode')?.value;
    const fieldsDiv = document.getElementById('inv-pack-fields');
    const totalDiv  = document.getElementById('inv-total-display');
    if (!fieldsDiv) return;

    const productId = document.getElementById('inv-product')?.value;
    const st   = SSIApp.getState();
    const prod = productId ? st.products.find(p=>p.id===productId) : null;
    const packOpts = (prod?.pack_sizes||[]).map(s=>`<option value="${s}">${s}</option>`).join('');

    // Build HTML (NO inline onchange/oninput — we wire events below)
    let html = '';

    if (mode === 'BAG') {
      html = `
        <div>
          <label>Bag Size (KG)</label>
          <select id="inv-bag-size">
            <option value="">— Select —</option>
            ${packOpts}
            <option value="custom">Custom...</option>
          </select>
        </div>
        <div id="inv-bag-custom-wrap" style="display:none;">
          <label>Custom Bag Size (KG)</label>
          <input type="number" id="inv-bag-custom" min="0.001" step="0.001" value="" placeholder="e.g. 25">
        </div>
        <div>
          <label>No. of Bags *</label>
          <input type="number" id="inv-bags-count" min="1" step="1" value="" placeholder="e.g. 100">
        </div>`;
    } else if (mode === 'CARTON_STD') {
      const stdKg = prod?.carton_std || 0;
      html = `
        <div>
          <label>KG per Carton (from product)</label>
          <input type="number" id="inv-ctn-kg" value="${stdKg}" readonly style="background:#f1f5f9;">
        </div>
        <div>
          <label>No. of Cartons *</label>
          <input type="number" id="inv-ctn-count" min="1" step="1" value="" placeholder="e.g. 50">
        </div>`;
    } else if (mode === 'CARTON_MAN') {
      html = `
        <div>
          <label>KG per Carton *</label>
          <input type="number" id="inv-ctn-kg" min="0.001" step="0.001" value="" placeholder="e.g. 20">
        </div>
        <div>
          <label>No. of Cartons *</label>
          <input type="number" id="inv-ctn-count" min="1" step="1" value="" placeholder="e.g. 75">
        </div>`;
    } else if (mode === 'DIRECT_KG') {
      html = `
        <div style="grid-column:span 3;">
          <label>Direct KG Quantity *</label>
          <input type="number" id="inv-direct-qty" min="0.001" step="0.001" value="" placeholder="e.g. 1500">
        </div>`;
    } else if (mode === 'NOS') {
      html = `
        <div style="grid-column:span 3;">
          <label>Number of Units *</label>
          <input type="number" id="inv-direct-qty" min="1" step="1" value="" placeholder="e.g. 200">
        </div>`;
    }

    fieldsDiv.innerHTML = html;
    if (totalDiv) totalDiv.style.display = 'block';

    // ─── Wire up ALL events with addEventListener (reliable) ──
    _wireEvents(mode);
    calcTotal();  // Show 0 initially until user fills fields
  }

  // Wire all input events after DOM insertion
  function _wireEvents(mode) {
    if (mode === 'BAG') {
      const bagSizeEl = document.getElementById('inv-bag-size');
      const customWrap = document.getElementById('inv-bag-custom-wrap');
      const customInput = document.getElementById('inv-bag-custom');
      const countInput  = document.getElementById('inv-bags-count');

      if (bagSizeEl) {
        bagSizeEl.addEventListener('change', () => {
          if (!customWrap || !customInput) return;
          if (bagSizeEl.value === 'custom') {
            customWrap.style.display = 'block';
            customInput.focus();
          } else {
            customWrap.style.display = 'none';
            customInput.value = '';
          }
          calcTotal();
        });
      }
      if (customInput) customInput.addEventListener('input', calcTotal);
      if (countInput)  countInput.addEventListener('input',  calcTotal);

    } else if (mode === 'CARTON_STD' || mode === 'CARTON_MAN') {
      const kgEl    = document.getElementById('inv-ctn-kg');
      const cntEl   = document.getElementById('inv-ctn-count');
      if (kgEl)  kgEl.addEventListener('input',  calcTotal);
      if (cntEl) cntEl.addEventListener('input', calcTotal);

    } else if (mode === 'DIRECT_KG' || mode === 'NOS') {
      const dqEl = document.getElementById('inv-direct-qty');
      if (dqEl) dqEl.addEventListener('input', calcTotal);
    }
  }

  // ─── Compute qty from form — returns a number ───────────────
  function _getQty() {
    const mode = document.getElementById('inv-pack-mode')?.value;
    if (!mode) return 0;

    let qty = 0;

    if (mode === 'BAG') {
      const bagSizeEl   = document.getElementById('inv-bag-size');
      const customInput = document.getElementById('inv-bag-custom');
      const countInput  = document.getElementById('inv-bags-count');

      let bagSize = 0;
      if (bagSizeEl) {
        if (bagSizeEl.value === 'custom') {
          bagSize = parseFloat(customInput?.value || 0) || 0;
        } else if (bagSizeEl.value !== '') {
          // The value may be a string like "1 KG" or just "1"
          const raw = bagSizeEl.value.replace(/[^\d.]/g, '');
          bagSize = parseFloat(raw) || 0;
        }
      }
      const bags = parseFloat(countInput?.value || 0) || 0;
      qty = bagSize * bags;

    } else if (mode === 'CARTON_STD' || mode === 'CARTON_MAN') {
      const kgPerCtn = parseFloat(document.getElementById('inv-ctn-kg')?.value    || 0) || 0;
      const cartons  = parseFloat(document.getElementById('inv-ctn-count')?.value || 0) || 0;
      qty = kgPerCtn * cartons;

    } else if (mode === 'DIRECT_KG' || mode === 'NOS') {
      qty = parseFloat(document.getElementById('inv-direct-qty')?.value || 0) || 0;
    }

    return qty;
  }

  // Update the total display
  function calcTotal() {
    const totalEl = document.getElementById('inv-total-qty');
    const uomEl   = document.getElementById('inv-total-uom');
    if (!totalEl) return;

    const qty = _getQty();

    const mode      = document.getElementById('inv-pack-mode')?.value;
    const productId = document.getElementById('inv-product')?.value;
    const st   = SSIApp.getState();
    const prod = productId ? st.products.find(p=>p.id===productId) : null;
    const uom  = (mode === 'NOS' || prod?.uom === 'NOS') ? 'NOS' : 'KG';

    totalEl.textContent = SSIApp.qtyFmt(qty);
    if (uomEl) uomEl.textContent = ' ' + uom;

    // Colour feedback: red if 0, green if > 0
    const displayBox = document.getElementById('inv-total-display');
    if (displayBox) {
      if (qty > 0) {
        displayBox.style.borderColor = '#16a34a';
        displayBox.style.background  = '#f0fdf4';
        totalEl.style.color = '#16a34a';
      } else {
        displayBox.style.borderColor = '#e2e8f0';
        displayBox.style.background  = '#f8fafc';
        totalEl.style.color = '#94a3b8';
      }
    }
  }

  function getPackDesc() {
    const mode = document.getElementById('inv-pack-mode')?.value;
    if (mode === 'BAG') {
      const bagSizeEl   = document.getElementById('inv-bag-size');
      const customInput = document.getElementById('inv-bag-custom');
      let bagSizeLabel = '';
      if (bagSizeEl?.value === 'custom') {
        bagSizeLabel = (customInput?.value || '?') + ' KG (custom)';
      } else {
        bagSizeLabel = bagSizeEl?.value || '?';
      }
      const bags = document.getElementById('inv-bags-count')?.value || '?';
      return `Bags: ${bagSizeLabel} × ${bags}`;
    } else if (mode === 'CARTON_STD') {
      return `Cartons (Std ${document.getElementById('inv-ctn-kg')?.value} KG) × ${document.getElementById('inv-ctn-count')?.value}`;
    } else if (mode === 'CARTON_MAN') {
      return `Cartons (${document.getElementById('inv-ctn-kg')?.value} KG) × ${document.getElementById('inv-ctn-count')?.value}`;
    } else if (mode === 'DIRECT_KG') {
      return 'Direct KG';
    } else if (mode === 'NOS') {
      return 'Units/NOS';
    }
    return '—';
  }

  async function saveEntry() {
    const date      = document.getElementById('inv-date')?.value;
    const type      = document.getElementById('inv-type')?.value;
    const unitId    = document.getElementById('inv-unit')?.value;
    const productId = document.getElementById('inv-product')?.value;
    const note      = document.getElementById('inv-note')?.value?.trim() || '';
    const mode      = document.getElementById('inv-pack-mode')?.value;
    // ISSUE-specific fields
    const isIssue   = (type === 'ISSUE');
    const issuedEmpId  = isIssue ? (document.getElementById('inv-issued-emp')?.value || '') : '';
    const issuedName   = isIssue ? (document.getElementById('inv-issued-name')?.value?.trim() || '') : '';
    const purpose      = isIssue ? (document.getElementById('inv-purpose')?.value?.trim() || '') : '';
    const dept         = isIssue ? (document.getElementById('inv-dept')?.value?.trim() || '') : '';
    // Validate ISSUE fields
    if (isIssue && !purpose) {
      SSIApp.toast('❌ Please enter a Purpose/Reason for the internal issue', 'error');
      return;
    }

    if (!date || !type || !unitId || !productId) {
      SSIApp.toast('Please fill all required fields (Date, Type, Unit, Product)', 'error');
      return;
    }
    if (!mode) {
      SSIApp.toast('Please select a Pack Type', 'error');
      return;
    }

    // Recalculate qty directly from inputs — do NOT rely on display text
    const qty = _getQty();

    if (qty <= 0) {
      SSIApp.toast('Quantity must be greater than 0. Please check Bag Size, Count, or KG fields.', 'error');
      // Highlight the total box red
      calcTotal();
      return;
    }

    // Check OUT doesn't exceed stock
    if (['OUT','TRANSFER_OUT','ISSUE'].includes(type)) {
      const current = SSIApp.getStock(productId, unitId);
      if (qty > current) {
        SSIApp.toast(`Insufficient stock! Current: ${SSIApp.qtyFmt(current)} KG`, 'error');
        return;
      }
    }

    const user = SSIApp.currentUser();
    const st   = SSIApp.getState();
    const prod = st.products.find(p=>p.id===productId);

    // Resolve issued_to name: prefer employee dropdown, fallback to free text
    const st2 = SSIApp.getState();
    const issuedEmp = issuedEmpId ? (st2.employees||[]).find(e=>e.id===issuedEmpId) : null;
    const issued_to = issuedEmp ? `${issuedEmp.name} (${issuedEmp.emp_code})` : (issuedName || '');

    const entry = {
      id: SSIApp.uid(),
      date,
      type,
      unit_id: unitId,
      product_id: productId,
      pack_mode: mode,
      pack_desc: getPackDesc(),
      qty,
      note,
      issued_to,
      purpose,
      department: dept,
      user_id: user?.id,
      user_name: user?.name,
      created_at: new Date().toISOString()
    };

    st.inventory.push(entry);
    await SSIApp.saveState(st);
    SSIApp.toast(`✅ Entry saved: ${SSIApp.qtyFmt(qty)} ${prod?.uom||'KG'} added`);
    SSIApp.audit('INV_ENTRY', `${type} ${qty} ${prod?.name}`);
    SSIApp.closeModal();
    refresh(document.getElementById('page-area'));
  }

  async function deleteEntry(id) {
    const ok = await SSIApp.confirm('Delete this inventory entry? Stock balance will change.');
    if (!ok) return;
    const st = SSIApp.getState();
    st.inventory = st.inventory.filter(t => t.id !== id);
    await SSIApp.saveState(st);
    SSIApp.toast('Entry deleted');
    SSIApp.audit('INV_DELETE', id);
    refresh(document.getElementById('page-area'));
  }

  function exportExcel() {
    const st = SSIApp.getState();
    const rows = [['Date','Type','Unit','Product','SKU','Pack Mode','Pack Desc','Qty','UoM','Note','Issued To','Purpose','Department','By']];
    [...st.inventory].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(t => {
      const prod = st.products.find(p=>p.id===t.product_id);
      const unit = st.units.find(u=>u.id===t.unit_id);
      const user = st.users.find(u=>u.id===t.user_id);
      rows.push([
        t.date, t.type, unit?.name||'', prod?.name||'', prod?.sku||'',
        t.pack_mode||'', t.pack_desc||'', t.qty||0, prod?.uom||'KG',
        t.note||'', t.issued_to||'', t.purpose||'', t.department||'', user?.name||t.user_name||''
      ]);
    });
    SSIApp.excelDownload(rows, 'Inventory', 'SSI_Inventory_Ledger');
    SSIApp.toast('Inventory exported ✅');
  }

  function downloadTemplate() {
    const st = SSIApp.getState();
    const unitName1 = st.units.filter(u=>u.active)[0]?.name || 'Modinagar';
    const unitName2 = st.units.filter(u=>u.active)[1]?.name || unitName1;
    const prodName1 = st.products.filter(p=>p.active)[0]?.name || 'Product Name';
    const prodName2 = st.products.filter(p=>p.active)[1]?.name || prodName1;
    SSIApp.excelDownload([
      ['Date (YYYY-MM-DD)','Entry Type','Unit Name','Product Name','Pack Mode','Bag/Carton Size (KG)','Count (Bags/Cartons)','Direct Qty (KG or NOS)','Note / Bill No'],
      ['2026-03-29','OPENING', unitName1, prodName1,'BAG','50','30','','Opening balance'],
      ['2026-03-29','IN',      unitName1, prodName1,'DIRECT_KG','','','1500','Bill No. 1234'],
      ['2026-03-29','IN',      unitName2, prodName2,'BAG','30','20','','Stock IN'],
    ], 'Inventory', 'SSI_Inventory_Template');
    SSIApp.toast('Template downloaded ✅  — Entry Types: IN/OUT/OPENING/ADJUST/TRANSFER_IN/TRANSFER_OUT | Pack Modes: BAG/CARTON_STD/CARTON_MAN/DIRECT_KG/NOS', 'info');
  }

  async function importExcel(input) {
    const file = input.files[0]; if (!file) return;
    try {
      const rows = await SSIApp.excelRead(file);
      const st   = SSIApp.getState();
      const user = SSIApp.currentUser();
      let added = 0, errors = [];

      rows.forEach((r, idx) => {
        const dateRaw   = (r['Date (YYYY-MM-DD)'] || '').toString().trim();
        const typeRaw   = (r['Entry Type'] || '').toString().trim().toUpperCase();
        const unitName  = (r['Unit Name'] || '').toString().trim();
        const prodName  = (r['Product Name'] || '').toString().trim();
        const packMode  = (r['Pack Mode'] || 'DIRECT_KG').toString().trim().toUpperCase();
        const bagSize   = parseFloat(r['Bag/Carton Size (KG)']) || 0;
        const count     = parseFloat(r['Count (Bags/Cartons)']) || 0;
        const directQty = parseFloat(r['Direct Qty (KG or NOS)']) || 0;
        const note      = (r['Note / Bill No'] || '').toString().trim();

        if (!dateRaw || !typeRaw || !unitName || !prodName) {
          errors.push(`Row ${idx+2}: Missing required fields`); return;
        }
        const unit = st.units.find(u => u.name.toLowerCase() === unitName.toLowerCase() && u.active);
        if (!unit) { errors.push(`Row ${idx+2}: Unit "${unitName}" not found`); return; }
        const prod = st.products.find(p => p.name.toLowerCase() === prodName.toLowerCase() && p.active);
        if (!prod) { errors.push(`Row ${idx+2}: Product "${prodName}" not found`); return; }
        const validTypes = ['IN','OUT','OPENING','ADJUST','TRANSFER_IN','TRANSFER_OUT','ISSUE'];
        if (!validTypes.includes(typeRaw)) { errors.push(`Row ${idx+2}: Invalid type "${typeRaw}"`); return; }

        let qty = 0, pack_desc = '';
        if (packMode === 'BAG') {
          qty = bagSize * count; pack_desc = `Bags: ${bagSize} KG × ${count}`;
        } else if (packMode === 'CARTON_STD') {
          const stdKg = prod.carton_std || bagSize;
          qty = stdKg * count; pack_desc = `Cartons (Std ${stdKg}KG) × ${count}`;
        } else if (packMode === 'CARTON_MAN') {
          qty = bagSize * count; pack_desc = `Cartons (${bagSize}KG) × ${count}`;
        } else {
          qty = directQty; pack_desc = packMode === 'NOS' ? 'Units/NOS' : 'Direct KG';
        }
        if (qty <= 0) { errors.push(`Row ${idx+2}: Qty is 0 — check size/count/direct`); return; }

        st.inventory.push({
          id: SSIApp.uid(), date: dateRaw, type: typeRaw,
          unit_id: unit.id, product_id: prod.id,
          pack_mode: packMode, pack_desc, qty, note,
          user_id: user?.id, user_name: user?.name,
          created_at: new Date().toISOString()
        });
        added++;
      });

      await SSIApp.saveState(st);
      let msg = `✅ ${added} entries imported`;
      if (errors.length) msg += ` | ⚠️ ${errors.length} errors`;
      SSIApp.toast(msg, errors.length ? 'warning' : 'success');
      if (errors.length) console.warn('Import errors:', errors);
      SSIApp.audit('INV_IMPORT', `${added} entries`);
      refresh(document.getElementById('page-area'));
    } catch (e) {
      SSIApp.toast('Import failed: ' + e.message, 'error');
    }
    input.value = '';
  }

  async function clearInventory() {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st = SSIApp.getState();
    const count = (st.inventory||[]).length;
    if (count === 0) { SSIApp.toast('Inventory is already empty.'); return; }

    const ok = await SSIApp.confirm(
      `⚠️ RESET INVENTORY TO ZERO?\n\nThis will permanently DELETE all ${count} inventory entries.\nOrders and dispatch records are NOT affected.\n\nThis CANNOT be undone. Continue?`
    );
    if (!ok) return;

    // ── 1. Wipe inventory in the live state object immediately ──
    SSIApp.state.inventory = [];
    SSIApp.audit('INVENTORY_RESET', `All ${count} inventory entries cleared by admin`);

    // ── 2. Persist to localStorage right away (instant, no race) ──
    try { localStorage.setItem('ssiData', JSON.stringify(SSIApp.state)); } catch(e) {}

    // ── 3. Force-write to Firestore directly, bypassing _isSaving guard ──
    if (window.SSIFirebase && SSIFirebase.db) {
      try {
        const DOC = SSIFirebase.db.collection('ssi').doc('data');
        await DOC.set(SSIApp.state);
        // Update localStorage again after confirmed Firestore write
        try { localStorage.setItem('ssiData', JSON.stringify(SSIApp.state)); } catch(e) {}
      } catch(err) {
        console.error('[ClearInventory] Firestore write failed:', err.message);
        SSIApp.toast('⚠️ Saved locally only — sync may retry shortly');
      }
    }

    SSIApp.toast(`✅ Inventory reset — ${count} entries removed`);
    refresh(document.getElementById('page-area'));
  }

  return {
    render, refresh, applyFilter, _onTypeChange,
    openEntryModal, onProductUnitChange, onPackModeChange, calcTotal,
    saveEntry, deleteEntry, clearInventory,
    exportExcel, downloadTemplate, importExcel
  };
})();
