/* ============================================================
   SSI Inventory Module (v2 SAFE) — Smart Entry
   Stage 1 Batch 2: confirmation popups + soft delete + restore + type-to-confirm Reset
   ============================================================ */
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

  /* ── Helper: append a history entry to an inventory record ───── */
  function _addHistory(entry, action, detail) {
    if (!entry.history) entry.history = [];
    entry.history.push({
      action,
      detail: detail || '',
      ts: new Date().toISOString(),
      user: SSIApp.state.currentUser?.username || 'unknown',
      user_name: SSIApp.state.currentUser?.name || ''
    });
  }

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','STOCK','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    refresh(area);
  }

  function refresh(area) {
    const st = SSIApp.getState();

    // Active (non-deleted) ledger for balance & default display
    const allLedger    = st.inventory || [];
    const activeLedger = allLedger.filter(t => t.active !== false);

    // Sort ascending for running balance, then reverse for display (newest first)
    const ledgerAsc = [...activeLedger].sort((a,b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : (a.created_at||'').localeCompare(b.created_at||'');
    });
    const balanceMap = {};
    ledgerAsc.forEach(t => {
      const key = `${t.unit_id}|${t.product_id}`;
      if (!balanceMap[key]) balanceMap[key] = 0;
      const isOut = ['OUT','TRANSFER_OUT','ISSUE'].includes(t.type);
      balanceMap[key] += isOut ? -(t.qty||0) : (t.qty||0);
      t._runningBal = balanceMap[key];
    });

    // Display set: active by default, with optional inactive view
    const showInactiveCb = document.getElementById('inv-show-inactive');
    const showInactive   = !!(showInactiveCb && showInactiveCb.checked);
    const displaySet = showInactive
      ? [...allLedger].sort((a,b) => new Date(b.date) - new Date(a.date))
      : [...activeLedger].reverse();

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">🏭 Inventory Ledger</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          ${SSIApp.hasRole('ADMIN') ? `
            <label style="display:flex;align-items:center;gap:6px;font-size:.85rem;color:#64748b;">
              <input type="checkbox" id="inv-show-inactive" ${showInactive?'checked':''} onchange="SSIInventory.refresh()"/> Show deleted
            </label>` : ''}
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
              ${SSIApp.hasRole('ADMIN') ? '<th>Actions</th>' : ''}
            </tr></thead>
            <tbody id="inv-tbody">
              ${renderRows(displaySet, st)}
            </tbody>
          </table>
        </div>
        <div id="inv-count-total" style="margin-top:12px;font-size:13px;color:#94a3b8;">Total: ${displaySet.length} entries</div>
      </div>`;
  }

  function renderRows(ledger, st) {
    const isAdmin = SSIApp.hasRole('ADMIN');
    if (!ledger.length) return `<tr><td colspan="${isAdmin?10:9}" style="text-align:center;padding:40px;color:#94a3b8;">No inventory entries yet. Add your first entry!</td></tr>`;
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
      const balBg  = balNeg ? '#fee2e2' : (bal === 0 ? '#f1f5f9' : '#f0fdf4');
      const balClr = balNeg ? '#dc2626' : (bal === 0 ? '#94a3b8' : '#15803d');
      const balIcon= balNeg ? '⚠️ ' : '';
      const isInactive = t.active === false;
      const rowStyle = isInactive ? 'background:#fafafa;opacity:.65;text-decoration:line-through;' : '';
      return `<tr data-unit="${t.unit_id}" data-product="${t.product_id}" data-type="${t.type}" data-date="${t.date}" style="${rowStyle}">
        <td style="white-space:nowrap;">${SSIApp.dateFmt(t.date)}</td>
        <td>
          <span style="background:${bg};color:${tc};padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;">${t.type}</span>
          ${isInactive ? '<br><span style="background:#fee2e2;color:#991b1b;font-size:10px;padding:1px 5px;border-radius:3px;">DELETED</span>' : ''}
        </td>
        <td style="font-size:13px;">${unit?.name||'—'}</td>
        <td><strong>${prod?.name||'—'}</strong><br><span style="font-size:11px;color:#94a3b8;">${prod?.sku||''}</span></td>
        <td style="font-size:12px;color:#64748b;">${t.pack_desc||'—'}</td>
        <td style="text-align:right;font-weight:700;color:${isOut?'#dc2626':'#16a34a'};">${isOut?'-':'+'} ${SSIApp.qtyFmt(t.qty)} ${prod?.uom||'KG'}</td>
        <td style="text-align:right;">
          ${isInactive ? '<span style="color:#94a3b8;font-size:12px;">—</span>' : `
            <span style="display:inline-block;background:${balBg};color:${balClr};padding:3px 10px;border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap;">
              ${balIcon}${SSIApp.qtyFmt(Math.abs(bal))} ${prod?.uom||'KG'}
            </span>`}
        </td>
        <td style="font-size:12px;color:#64748b;max-width:180px;">
          ${t.type==='ISSUE' && t.issued_to
            ? `<div style="font-weight:600;color:#6d28d9;">${t.issued_to}</div>
               <div style="color:#7c3aed;font-size:11px;">${t.purpose||'—'}</div>
               ${t.department?`<div style="color:#94a3b8;font-size:10px;">${t.department}</div>`:''}`
            : (t.note||'—')}
        </td>
        <td style="font-size:12px;color:#94a3b8;">${user?.name||t.user_name||'—'}</td>
        ${isAdmin ? `
          <td style="white-space:nowrap;">
            ${t.history && t.history.length ? `<button class="btn btn-secondary btn-sm" onclick="SSIInventory.viewHistory('${t.id}')" title="View history">🕒</button>` : ''}
            ${isInactive
              ? `<button class="btn btn-secondary btn-sm" onclick="SSIInventory.restoreEntry('${t.id}')" title="Restore">♻️</button>`
              : `<button class="btn btn-danger btn-sm" onclick="SSIInventory.deleteEntry('${t.id}')" title="Delete (soft)">🗑️</button>`}
          </td>` : ''}
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

        <div id="inv-info-card" style="display:none;" class="info-card">
          <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">UoM</span><br><strong id="inv-uom-badge">KG</strong></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Pack Sizes</span><br><span id="inv-pack-sizes" style="font-size:13px;">—</span></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Carton Std</span><br><span id="inv-carton-std" style="font-size:13px;">—</span></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Current Stock</span><br><strong id="inv-current-stock" style="font-size:16px;">—</strong></div>
          </div>
        </div>

        <div id="inv-pack-section" style="display:none;">
          <div style="margin-bottom:16px;">
            <label>Pack Type</label>
            <select id="inv-pack-mode" onchange="SSIInventory.onPackModeChange()">
              ${PACK_MODES.map(m=>`<option value="${m.value}">${m.label}</option>`).join('')}
            </select>
          </div>

          <div id="inv-pack-fields" class="form-grid form-grid-3"></div>

          <div id="inv-total-display" style="display:none;background:#f0fdf4;border:2px solid #16a34a;border-radius:10px;padding:14px 20px;margin-top:16px;text-align:center;">
            <span style="font-size:13px;color:#16a34a;font-weight:600;">Total Quantity</span><br>
            <span id="inv-total-qty" style="font-size:28px;font-weight:900;color:#16a34a;">0.000</span>
            <span id="inv-total-uom" style="font-size:16px;color:#16a34a;font-weight:600;"> KG</span>
          </div>
        </div>

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

  function onPackModeChange() {
    const mode      = document.getElementById('inv-pack-mode')?.value;
    const fieldsDiv = document.getElementById('inv-pack-fields');
    const totalDiv  = document.getElementById('inv-total-display');
    if (!fieldsDiv) return;

    const productId = document.getElementById('inv-product')?.value;
    const st   = SSIApp.getState();
    const prod = productId ? st.products.find(p=>p.id===productId) : null;
    const packOpts = (prod?.pack_sizes||[]).map(s=>`<option value="${s}">${s}</option>`).join('');

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

    _wireEvents(mode);
    calcTotal();
  }

  function _wireEvents(mode) {
    if (mode === 'BAG') {
      const bagSizeEl  = document.getElementById('inv-bag-size');
      const customWrap = document.getElementById('inv-bag-custom-wrap');
      const customInput= document.getElementById('inv-bag-custom');
      const countInput = document.getElementById('inv-bags-count');

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
    const isIssue   = (type === 'ISSUE');
    const issuedEmpId  = isIssue ? (document.getElementById('inv-issued-emp')?.value || '') : '';
    const issuedName   = isIssue ? (document.getElementById('inv-issued-name')?.value?.trim() || '') : '';
    const purpose      = isIssue ? (document.getElementById('inv-purpose')?.value?.trim() || '') : '';
    const dept         = isIssue ? (document.getElementById('inv-dept')?.value?.trim() || '') : '';
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

    const qty = _getQty();

    if (qty <= 0) {
      SSIApp.toast('Quantity must be greater than 0. Please check Bag Size, Count, or KG fields.', 'error');
      calcTotal();
      return;
    }

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
      created_at: new Date().toISOString(),
      active: true,
      history: []
    };
    _addHistory(entry, 'CREATED', `${type} ${SSIApp.qtyFmt(qty)} ${prod?.uom||'KG'} — ${prod?.name||''} @ ${(st.units.find(u=>u.id===unitId)?.name)||''}`);

    if (!st.inventory) st.inventory = [];
    st.inventory.push(entry);
    await SSIApp.saveState(st);
    SSIApp.toast(`✅ Entry saved: ${SSIApp.qtyFmt(qty)} ${prod?.uom||'KG'} added`);
    SSIApp.audit('INV_ENTRY', `${type} ${qty} ${prod?.name}`);
    SSIApp.closeModal();
    refresh(document.getElementById('page-area'));
  }

  /* ── Soft delete inventory entry (Admin only) ────────────── */
  async function deleteEntry(id) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st = SSIApp.getState();
    const t  = (st.inventory||[]).find(x => x.id === id);
    if (!t) return;
    const prod = (st.products||[]).find(p => p.id === t.product_id);
    const unit = (st.units||[]).find(u => u.id === t.unit_id);

    const ok = await SSIApp.confirm(
      `⚠️ Delete Inventory Entry?\n\n` +
      `Date: ${SSIApp.dateFmt(t.date)}\n` +
      `Type: ${t.type}\n` +
      `Product: ${prod?.name || '—'}\n` +
      `Unit: ${unit?.name || '—'}\n` +
      `Qty: ${SSIApp.qtyFmt(t.qty||0)} ${prod?.uom||'KG'}\n\n` +
      `The entry will be marked DELETED and EXCLUDED from stock balance.\n` +
      `It will stay in history (visible via "Show deleted") and can be restored.\n\nProceed?`
    );
    if (!ok) return;

    t.active     = false;
    t.deleted_at = new Date().toISOString();
    t.deleted_by = SSIApp.state.currentUser?.username || 'unknown';
    _addHistory(t, 'DELETED (soft)', `Removed from stock by ${t.deleted_by}`);

    await SSIApp.saveState(st);
    SSIApp.toast('🗑️ Inventory entry marked deleted');
    SSIApp.audit('INV_SOFT_DELETE', `${t.type} ${t.qty} ${prod?.name||''} (${t.id})`);
    refresh(document.getElementById('page-area'));
  }

  /* ── Restore a soft-deleted entry ────────────────────────── */
  async function restoreEntry(id) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st = SSIApp.getState();
    const t  = (st.inventory||[]).find(x => x.id === id);
    if (!t) return;
    t.active = true;
    t.restored_at = new Date().toISOString();
    t.restored_by = SSIApp.state.currentUser?.username || 'unknown';
    delete t.deleted_at;
    delete t.deleted_by;
    _addHistory(t, 'RESTORED', `Restored by ${t.restored_by}`);
    await SSIApp.saveState(st);
    SSIApp.toast('♻️ Entry restored');
    SSIApp.audit('INV_RESTORE', `${t.type} ${t.qty} (${t.id})`);
    refresh(document.getElementById('page-area'));
  }

  /* ── View history of an entry ────────────────────────────── */
  function viewHistory(id) {
    const st = SSIApp.getState();
    const t  = (st.inventory||[]).find(x => x.id === id);
    if (!t) return;
    const prod = (st.products||[]).find(p => p.id === t.product_id);
    const unit = (st.units||[]).find(u => u.id === t.unit_id);
    const items = (t.history && t.history.length) ? t.history : [];

    const rowsHtml = items.map(h => `
      <tr style="border-top:1px solid #e2e8f0;">
        <td style="padding:6px 8px;font-size:12px;white-space:nowrap;">${SSIApp.dateFmt(h.ts)}<br><span style="color:#94a3b8;">${(h.ts||'').slice(11,19)}</span></td>
        <td style="padding:6px 8px;font-size:12px;font-weight:700;color:#334155;">${h.action||''}</td>
        <td style="padding:6px 8px;font-size:12px;">${h.user_name || h.user || ''}</td>
        <td style="padding:6px 8px;font-size:12px;color:#475569;">${h.detail || ''}</td>
      </tr>`).join('');

    const html = `
      <div class="modal-header">
        <h3 style="font-size:18px;font-weight:700;">🕒 Inventory Entry History</h3>
        <button onclick="SSIApp.closeModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom:12px;color:#64748b;font-size:13px;">
          <strong>${t.type}</strong> — ${prod?.name||'—'} @ ${unit?.name||'—'} · ${SSIApp.qtyFmt(t.qty||0)} ${prod?.uom||'KG'} · ${SSIApp.dateFmt(t.date)}
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">When</th>
              <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">Action</th>
              <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">By</th>
              <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">Detail</th>
            </tr>
          </thead>
          <tbody>
            ${items.length ? rowsHtml : `<tr><td colspan="4" style="padding:14px;color:#94a3b8;text-align:center;">No history entries.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Close</button>
      </div>`;
    SSIApp.showModal(html);
  }

  function exportExcel() {
    const st = SSIApp.getState();
    const rows = [['Date','Type','Unit','Product','SKU','Pack Mode','Pack Desc','Qty','UoM','Note','Issued To','Purpose','Department','By','Status','Last Change At','Last Change By','Last Change Action']];
    [...(st.inventory||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(t => {
      const prod = st.products.find(p=>p.id===t.product_id);
      const unit = st.units.find(u=>u.id===t.unit_id);
      const user = st.users.find(u=>u.id===t.user_id);
      const last = (t.history && t.history.length) ? t.history[t.history.length-1] : null;
      rows.push([
        t.date, t.type, unit?.name||'', prod?.name||'', prod?.sku||'',
        t.pack_mode||'', t.pack_desc||'', t.qty||0, prod?.uom||'KG',
        t.note||'', t.issued_to||'', t.purpose||'', t.department||'', user?.name||t.user_name||'',
        t.active === false ? 'Deleted' : 'Active',
        last?.ts || '',
        last?.user_name || last?.user || '',
        last?.action || ''
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

      // Confirm before importing — these can be many rows
      const ok = await SSIApp.confirm(
        `📥 Import ${rows.length} inventory rows from this file?\n\nThis will ADD entries to the ledger (existing entries are NOT replaced).\n\nProceed?`
      );
      if (!ok) { input.value=''; return; }

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

        const newEntry = {
          id: SSIApp.uid(), date: dateRaw, type: typeRaw,
          unit_id: unit.id, product_id: prod.id,
          pack_mode: packMode, pack_desc, qty, note,
          user_id: user?.id, user_name: user?.name,
          created_at: new Date().toISOString(),
          active: true,
          history: []
        };
        _addHistory(newEntry, 'IMPORTED', `Row ${idx+2}: ${typeRaw} ${qty} ${prod.name}`);
        if (!st.inventory) st.inventory = [];
        st.inventory.push(newEntry);
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

  /* ── Reset all inventory to zero (two-step + type-to-confirm) ── */
  async function clearInventory() {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st = SSIApp.getState();
    const all = st.inventory || [];
    const activeCount = all.filter(t => t.active !== false).length;
    if (activeCount === 0) { SSIApp.toast('Inventory is already empty.'); return; }

    const ok1 = await SSIApp.confirm(
      `⚠️ RESET INVENTORY TO ZERO?\n\nThis will mark ALL ${activeCount} active inventory entries as DELETED.\n\nThey will be excluded from stock balance but kept in history (visible via "Show deleted").\nYou can restore individual entries later.\n\nClick OK to proceed to final confirmation.`
    );
    if (!ok1) return;

    const confirmed = await _confirmTyped(
      `Type RESET INVENTORY to confirm marking all ${activeCount} entries deleted:`,
      'RESET INVENTORY'
    );
    if (!confirmed) return;

    const nowIso = new Date().toISOString();
    const actor  = SSIApp.state.currentUser?.username || 'admin';
    let count = 0;
    all.forEach(t => {
      if (t.active !== false) {
        t.active     = false;
        t.deleted_at = nowIso;
        t.deleted_by = actor;
        _addHistory(t, 'DELETED (reset)', `Bulk reset by ${actor}`);
        count++;
      }
    });

    SSIApp.audit('INVENTORY_RESET_SOFT', `Marked ${count} inventory entries deleted (kept in history)`);

    // Persist via the safe SSIApp.saveState path (uses Stage 1 stale-write guard)
    await SSIApp.saveState(st);

    SSIApp.toast(`✅ Inventory reset — ${count} entries marked deleted (recoverable)`);
    refresh(document.getElementById('page-area'));
  }

  function _confirmTyped(message, expectedText) {
    return new Promise(resolve => {
      const html = `
        <div class="modal-header" style="background:#7f1d1d;color:#fff;">
          <h3 style="margin:0;font-size:16px;">⚠️ Final Confirmation Required</h3>
          <button onclick="SSIApp.closeModal()" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div class="modal-body" style="padding:24px;">
          <p style="margin:0 0 16px;color:#7f1d1d;font-weight:600;">${message}</p>
          <input id="confirm-type-input" type="text" placeholder='Type: ${expectedText}'
            style="border:2px solid #dc2626;border-radius:8px;padding:10px 14px;width:100%;box-sizing:border-box;font-size:15px;letter-spacing:1px;"
            oninput="document.getElementById('confirm-type-btn').disabled = this.value.trim() !== '${expectedText}';">
        </div>
        <div class="modal-footer" style="justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal(); window._invResetResolve(false)">Cancel</button>
          <button id="confirm-type-btn" class="btn btn-danger" disabled
            onclick="SSIApp.closeModal(); window._invResetResolve(true)">
            🗑️ Reset Inventory
          </button>
        </div>`;
      window._invResetResolve = resolve;
      SSIApp.showModal(html);
    });
  }

  return {
    render, refresh, applyFilter, _onTypeChange,
    openEntryModal, onProductUnitChange, onPackModeChange, calcTotal,
    saveEntry, deleteEntry, restoreEntry, viewHistory, clearInventory,
    exportExcel, downloadTemplate, importExcel
  };
})();
