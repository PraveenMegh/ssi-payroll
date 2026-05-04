/* ============================================================
   SSI Sales Orders Module (v3 SAFE)
   Stage 1 Batch 2: confirmation popups + soft delete
   Stage 2 (early): edit allowed before dispatch + full timeline log
   ============================================================ */
const SSIOrders = (() => {
  const PACK_MODES = [
    { value:'BAG',        label:'🛍️ KG Bags (Size × Count)' },
    { value:'CARTON_STD', label:'📦 Cartons – Use Product Std' },
    { value:'CARTON_MAN', label:'📦 Cartons – Manual KG/Ctn' },
    { value:'DIRECT_KG',  label:'⚖️ Direct KG' },
    { value:'NOS',        label:'🔢 Units / NOS' },
  ];

  /* ── Helper: append a history entry to an order ────────────── */
  function _addHistory(order, action, detail) {
    if (!order.history) order.history = [];
    order.history.push({
      action,
      detail: detail || '',
      ts: new Date().toISOString(),
      user: SSIApp.state.currentUser?.username || 'unknown',
      user_name: SSIApp.state.currentUser?.name || ''
    });
  }

  /* ── Helper: who can edit this order ───────────────────────── */
  function _canEdit(order, user) {
    if (!order || !user) return false;
    if (order.status === 'DISPATCHED') return false;
    if (order.status === 'CANCELLED')  return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'SALES') return order.created_by === user.id;
    return false;
  }

  function _canCancel(order, user) {
    if (!order || !user) return false;
    if (order.status === 'DISPATCHED') return false;
    if (order.status === 'CANCELLED')  return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'SALES') return order.created_by === user.id;
    return false;
  }

  /* ── Robust client visibility (works even if SSIClients.visibleClients is private) ── */
  function _visibleClients(st, user) {
    const all = (st.clients || []).filter(c => c.active !== false);
    if (!user || user.role === 'ADMIN' || user.role === 'ACCOUNTS') return all;
    if (user.role === 'SALES') {
      const u1 = (user.username || '').toLowerCase();
      const u2 = (user.name || '').toLowerCase();
      return all.filter(c => {
        const at = (c.assignedTo || '').toLowerCase();
        return at === u1 || at === u2;
      });
    }
    return all;
  }

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','SALES','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    refresh(area);
  }

  function refresh(area) {
    const st   = SSIApp.getState();
    const user = SSIApp.currentUser();
    const isSales = user?.role === 'SALES';

    const orders = isSales
      ? (st.orders||[]).filter(o => o.created_by === user.id)
      : [...(st.orders||[])];
    orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const statusBadge = o => {
      const s = o.status;
      const map = { DRAFT:'badge-draft', SUBMITTED:'badge-submitted', DISPATCHED:'badge-dispatched', CANCELLED:'badge-cancelled' };
      if (s === 'DISPATCHED' && o.dispatch_modified) {
        return `<span class="badge badge-dispatched" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;">✏️ DISPATCHED<br><span style="font-size:10px;">MODIFIED</span></span>`;
      }
      return `<span class="badge ${map[s]||'badge-draft'}">${s}</span>`;
    };

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">🛒 Sales Orders</h2>
        <button class="btn btn-primary" onclick="SSIOrders.openForm()">+ New Order</button>
      </div>

      ${!isSales ? `
      <div class="card" style="margin-bottom:16px;padding:16px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div style="flex:1;min-width:140px;">
            <label>Status</label>
            <select id="ord-filter-status" onchange="SSIOrders.applyFilter()">
              <option value="">All (excl. Cancelled)</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="CANCELLED">Cancelled (only)</option>
              <option value="__ALL__">Show ALL incl. Cancelled</option>
            </select>
          </div>
          <div style="flex:1;min-width:140px;">
            <label>Salesperson</label>
            <select id="ord-filter-sales" onchange="SSIOrders.applyFilter()">
              <option value="">All</option>
              ${(st.users||[]).filter(u=>u.role==='SALES').map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;min-width:140px;">
            <label>From Date</label>
            <input type="date" id="ord-filter-from" onchange="SSIOrders.applyFilter()">
          </div>
          <div style="flex:1;min-width:140px;">
            <label>To Date</label>
            <input type="date" id="ord-filter-to" onchange="SSIOrders.applyFilter()">
          </div>
          <button class="btn btn-secondary btn-sm" onclick="SSIOrders.exportExcel()">📤 Export</button>
        </div>
      </div>` : ''}

      <div class="card">
        <div style="overflow-x:auto;">
          <table id="orders-table">
            <thead><tr>
              <th>Order #</th><th>Date</th><th>Client</th><th>Unit</th>
              <th>Items</th>
              <th>Ordered KG</th>
              <th>Ordered Value</th>
              <th style="text-align:center;">Urgent</th><th>Status</th>
              ${!isSales ? '<th>By</th>' : ''}
              <th>Last Change</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              ${orders.map(o => {
                const client   = (st.clients||[]).find(c=>c.id===o.client_id);
                const unit     = (st.units||[]).find(u=>u.id===o.unit_id);
                const salesp   = (st.users||[]).find(u=>u.id===o.created_by);
                const canEdit  = _canEdit(o, user);
                const canCancel= _canCancel(o, user);
                const lastEntry = (o.history && o.history.length) ? o.history[o.history.length-1] : null;
                const lastChangeCell = lastEntry
                  ? `<span style="font-size:11px;color:#64748b;">${SSIApp.dateFmt(lastEntry.ts)}<br>${lastEntry.action}<br><span style="color:#94a3b8;">${lastEntry.user||''}</span></span>`
                  : `<span style="font-size:11px;color:#cbd5e1;">—</span>`;
                const editedAfterSubmit = o.status === 'SUBMITTED' && o.edited_after_submit_at;
                return `<tr data-status="${o.status}" data-sales="${o.created_by}" data-date="${o.created_at?.slice(0,10)||''}">
                  <td>
                    <strong>${o.order_no}</strong>
                    ${o.dispatch_modified ? '<br><span style="background:#fef3c7;color:#92400e;font-size:10px;padding:1px 5px;border-radius:3px;">✏️ Modified</span>' : ''}
                    ${editedAfterSubmit ? '<br><span style="background:#dbeafe;color:#1e40af;font-size:10px;padding:1px 5px;border-radius:3px;" title="Edited after submission">✏️ Edited after submit</span>' : ''}
                    ${o.status==='CANCELLED' ? '<br><span style="background:#fee2e2;color:#991b1b;font-size:10px;padding:1px 5px;border-radius:3px;">CANCELLED</span>' : ''}
                  </td>
                  <td style="white-space:nowrap;">${SSIApp.dateFmt(o.created_at)}</td>
                  <td>
                    <strong>${client?.name||'—'}</strong>
                    ${(client?.gst_no||client?.gst)?`<br><span style="font-size:11px;color:#16a34a;">${client.gst_no||client.gst}</span>`:''}
                  </td>
                  <td style="font-size:13px;">${unit?.name||'—'}</td>
                  <td style="text-align:center;">${(o.items||[]).length}</td>
                  <td style="font-weight:600;">
                    ${SSIApp.qtyFmt(o.total_qty||0)} KG
                    ${o.dispatch_modified ? `<br><span style="font-size:11px;color:#d97706;">Disp: ${SSIApp.qtyFmt(o.dispatched_qty||0)} KG</span>` : ''}
                  </td>
                  <td style="font-weight:600;">
                    ${SSIApp.moneyFmt(o.total_value, o.currency||'INR')}
                    ${o.dispatch_modified ? `<br><span style="font-size:11px;color:#d97706;">Disp: ${SSIApp.moneyFmt(o.dispatched_value||0, o.currency||'INR')}</span>` : ''}
                  </td>
                  <td style="text-align:center;">${o.urgent?'<span class="badge badge-urgent">🚨 YES</span>':'<span style="color:#d1d5db;">—</span>'}</td>
                  <td>${statusBadge(o)}</td>
                  ${!isSales ? `<td style="font-size:12px;color:#64748b;">${salesp?.name||'—'}</td>` : ''}
                  <td>${lastChangeCell}</td>
                  <td style="white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="SSIOrders.viewOrder('${o.id}')" title="View details + history">👁️</button>
                    ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="SSIOrders.openForm('${o.id}')" title="Edit order">✏️</button>` : ''}
                    ${canCancel ? `<button class="btn btn-danger btn-sm" onclick="SSIOrders.cancelOrder('${o.id}')" title="Cancel order (kept in history)">✕ Cancel</button>` : ''}
                    ${SSIApp.hasRole('ADMIN') && o.status==='CANCELLED' ? `<button class="btn btn-danger btn-sm" onclick="SSIOrders.deleteOrder('${o.id}')" title="Permanently delete this cancelled order">🗑️</button>` : ''}
                  </td>
                </tr>`;
              }).join('') || `<tr><td colspan="13" style="text-align:center;padding:40px;color:#94a3b8;">No orders yet. Create your first order!</td></tr>`}
            </tbody>
          </table>
        </div>
        <div id="ord-count" style="margin-top:12px;font-size:13px;color:#94a3b8;">Total: ${orders.length} orders</div>
      </div>`;

    setTimeout(applyFilter, 0);
  }

  function applyFilter() {
    const statusF = document.getElementById('ord-filter-status')?.value;
    const salesF  = document.getElementById('ord-filter-sales')?.value  || '';
    const fromF   = document.getElementById('ord-filter-from')?.value   || '';
    const toF     = document.getElementById('ord-filter-to')?.value     || '';
    const rows    = document.querySelectorAll('#orders-table tbody tr[data-status]');
    let visible   = 0;
    rows.forEach(row => {
      let statusOk;
      if (statusF === '__ALL__')        statusOk = true;
      else if (statusF === 'CANCELLED') statusOk = (row.dataset.status === 'CANCELLED');
      else if (!statusF)                statusOk = (row.dataset.status !== 'CANCELLED');
      else                              statusOk = (row.dataset.status === statusF);

      const show = statusOk
        && (!salesF  || row.dataset.sales===salesF)
        && (!fromF   || row.dataset.date >= fromF)
        && (!toF     || row.dataset.date <= toF);
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const cnt = document.getElementById('ord-count');
    if (cnt) cnt.textContent = `Showing: ${visible} orders`;
  }

  function openForm(orderId) {
    try {
      const st   = SSIApp.getState();
      const user = SSIApp.currentUser();
      if (!user) { SSIApp.toast('Please log in again', 'error'); return; }

      const ord  = orderId ? (st.orders||[]).find(o=>o.id===orderId) : null;

      // Permission gate for editing
      if (orderId && !_canEdit(ord, user)) {
        SSIApp.toast('You cannot edit this order', 'warning');
        return;
      }

      const items = (ord?.items && ord.items.length) ? ord.items : [{}];

      const productOpts = (st.products||[]).filter(p=>p.active!==false)
        .map(p=>`<option value="${p.id}">${p.name||''} (${p.uom||'KG'})</option>`).join('');

      const myClients = _visibleClients(st, user).filter(c => c.type !== 'Vendor');
      const clientOpts = myClients
        .map(c=>{
          const gst = c.gst_no || c.gst || '';
          return `<option value="${c.id}" ${ord?.client_id===c.id?'selected':''}>${c.name}${gst?' | '+gst:''}</option>`;
        }).join('');

      const unitOpts = (st.units||[]).filter(u=>u.active!==false)
        .map(u=>`<option value="${u.id}" ${ord?.unit_id===u.id?'selected':''}>${u.name}</option>`).join('');

      const html = `
        <div class="modal-header">
          <h3 style="font-size:18px;font-weight:700;">${ord?'Edit':'New'} Sales Order ${ord?'— '+ord.order_no:''}</h3>
          <button onclick="SSIApp.closeModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid form-grid-3" style="margin-bottom:20px;">
            <div>
              <label>Date *</label>
              <input type="date" id="ord-date" value="${ord?.date||new Date().toISOString().slice(0,10)}">
            </div>
            <div>
              <label>SSI Unit *</label>
              <select id="ord-unit"><option value="">—Select—</option>${unitOpts}</select>
            </div>
            <div>
              <label>Currency</label>
              <select id="ord-currency">
                ${Object.keys(SSIApp.CURRENCIES).map(c=>`<option value="${c}" ${ord?.currency===c||(c==='INR'&&!ord)?'selected':''}>${c} (${SSIApp.CURRENCY_SYMBOLS[c]})</option>`).join('')}
              </select>
            </div>
            <div style="grid-column:span 2;">
              <label>Client *
                ${myClients.length === 0 && user?.role === 'SALES'
                  ? '<span style="color:#dc2626;font-weight:400;font-size:12px;"> — No clients assigned yet! Ask Admin to assign clients to you.</span>'
                  : `<span style="color:#94a3b8;font-weight:400;font-size:12px;"> (${myClients.length} available)</span>`}
              </label>
              <select id="ord-client">
                <option value="">—Select Client—</option>
                ${clientOpts}
              </select>
            </div>
            <div>
              <label>🚨 Urgent Order</label>
              <div style="margin-top:6px;">
                <button type="button" id="ord-urgent-btn"
                  onclick="SSIOrders.toggleUrgent()"
                  style="width:100%;padding:9px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;border:2px solid ${ord?.urgent?'#dc2626':'#d1d5db'};background:${ord?.urgent?'#dc2626':'#fff'};color:${ord?.urgent?'#fff':'#64748b'};transition:all .2s;">
                  ${ord?.urgent?'🚨 URGENT — YES':'⬜ URGENT — NO'}
                </button>
                <input type="hidden" id="ord-urgent-val" value="${ord?.urgent?'1':'0'}">
              </div>
            </div>
            <div style="grid-column:span 2;">
              <label>Remarks</label>
              <input id="ord-remarks" value="${ord?.remarks||''}" placeholder="Optional notes / instructions">
            </div>
          </div>

          <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:12px;">📋 Order Items</div>
          <div id="ord-items-container">
            ${items.map((item,idx) => buildItemRow(idx, item, productOpts)).join('')}
          </div>
          <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="SSIOrders.addItemRow()">+ Add Item</button>

          <div style="margin-top:20px;background:#f8fafc;border-radius:10px;padding:16px;display:flex;justify-content:flex-end;gap:40px;">
            <div style="text-align:right;">
              <div style="font-size:13px;color:#64748b;">Total KG / Units</div>
              <div id="ord-grand-kg" style="font-size:22px;font-weight:800;color:#111827;">0.000 KG</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;color:#64748b;">Grand Total Value</div>
              <div id="ord-grand-total" style="font-size:22px;font-weight:800;color:#e11d2e;">₹0.00</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          ${ord && ord.status === 'SUBMITTED'
              ? `<button class="btn btn-primary" onclick="SSIOrders.saveOrder('${orderId}','SUBMITTED')">💾 Save Changes (stays SUBMITTED)</button>`
              : `
                <button class="btn btn-secondary" onclick="SSIOrders.saveOrder('${orderId||''}','DRAFT')">💾 Save Draft</button>
                <button class="btn btn-primary"   onclick="SSIOrders.saveOrder('${orderId||''}','SUBMITTED')">📤 Submit Order</button>
              `}
        </div>`;

      SSIApp.showModal(html);
      recalcGrand();
    } catch (err) {
      console.error('[SSIOrders.openForm] error:', err);
      SSIApp.toast('Could not open order form: ' + (err.message||err), 'error');
    }
  }

  function _getSizeValue(idx) {
    const sel = document.querySelector(`.item-size-sel[data-idx="${idx}"]`);
    if (sel) {
      if (sel.value === '__custom__') {
        return parseFloat(document.querySelector(`.item-size-custom[data-idx="${idx}"]`)?.value) || 0;
      }
      return parseFloat(sel.value) || 0;
    }
    return parseFloat(document.querySelector(`.item-size-manual[data-idx="${idx}"]`)?.value) || 0;
  }

  function onItemSizeChange(idx) {
    const sel     = document.querySelector(`.item-size-sel[data-idx="${idx}"]`);
    const customI = document.querySelector(`.item-size-custom[data-idx="${idx}"]`);
    const warnEl  = document.querySelector(`.item-size-warning[data-idx="${idx}"]`);
    if (!sel) return;
    const isCustom = sel.value === '__custom__';
    if (customI) customI.style.display = isCustom ? '' : 'none';
    if (warnEl)  warnEl.style.display  = isCustom ? '' : 'none';
    calcItemTotal(idx);
  }

  function _buildSizeOpts(prod, selectedSize) {
    const sizes = (prod?.pack_sizes || []).map(s => {
      const m = (s + '').match(/[\d.]+/);
      return m ? parseFloat(m[0]) : null;
    }).filter(Boolean);
    let opts = '<option value="">— Select Size —</option>';
    sizes.forEach(sz => {
      const sel = (sz === selectedSize) ? 'selected' : '';
      opts += `<option value="${sz}" ${sel}>${sz} KG</option>`;
    });
    opts += `<option value="__custom__" ${!sizes.includes(selectedSize) && selectedSize ? 'selected' : ''}>✏️ Custom…</option>`;
    return opts;
  }

  function buildItemRow(idx, item, productOpts) {
    const st   = SSIApp.getState();
    const prod = item.product_id ? (st.products||[]).find(p=>p.id===item.product_id) : null;
    const packOpts = PACK_MODES.map(m=>`<option value="${m.value}" ${item.pack_mode===m.value?'selected':''}>${m.label}</option>`).join('');
    const mode = item.pack_mode || 'BAG';

    const hideSize  = (mode === 'DIRECT_KG' || mode === 'NOS');
    const selectedSz= parseFloat(item.pack_size) || 0;
    const isCustom  = prod && selectedSz && !(prod.pack_sizes||[]).some(s=>{ const m=(s+'').match(/[\d.]+/); return m&&parseFloat(m[0])===selectedSz; });

    const sizeHTML = `
      <div id="item-size-wrap-${idx}" style="${hideSize?'display:none;':''}">
        <label style="font-size:12px;" id="item-size-label-${idx}">Bag Size (KG)</label>
        ${ mode === 'BAG' ? `
          <select class="item-size-sel" data-idx="${idx}" onchange="SSIOrders.onItemSizeChange(${idx})" style="font-size:13px;">
            ${_buildSizeOpts(prod, selectedSz)}
          </select>
          <input type="number" class="item-size-custom" data-idx="${idx}" min="0" step="0.001"
            value="${isCustom ? selectedSz : ''}"
            placeholder="Enter KG"
            style="font-size:13px;margin-top:4px;${isCustom?'':'display:none;'}"
            oninput="SSIOrders.calcItemTotal(${idx})">
          <div class="item-size-warning" data-idx="${idx}" style="color:#dc2626;font-size:11px;margin-top:3px;${isCustom?'':'display:none;'}">
            ⚠️ Non-standard size — verify stock availability
          </div>
        ` : `
          <input type="number" class="item-size-manual" data-idx="${idx}" min="0" step="0.001"
            value="${item.pack_size||''}"
            placeholder="e.g. 50"
            ${ mode==='CARTON_STD' ? 'readonly style="background:#f1f5f9;font-size:13px;"' : 'style="font-size:13px;"' }
            oninput="SSIOrders.calcItemTotal(${idx})">
        ` }
      </div>`;

    return `<div class="item-row" id="item-row-${idx}" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong style="font-size:13px;color:#64748b;">Item ${idx+1}</strong>
        <button onclick="SSIOrders.removeItemRow(${idx})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:18px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1.4fr 1.4fr 1fr 1fr 1fr;gap:10px;align-items:end;">
        <div>
          <label style="font-size:12px;">Product</label>
          <select class="item-product" data-idx="${idx}" onchange="SSIOrders.onItemProductChange(${idx})" style="font-size:13px;">
            <option value="">—Select—</option>${productOpts}
            ${prod ? `<option value="${prod.id}" selected>${prod.name}</option>` : ''}
          </select>
        </div>
        <div>
          <label style="font-size:12px;">Pack Type</label>
          <select class="item-pack-mode" data-idx="${idx}" onchange="SSIOrders.onItemPackChange(${idx})" style="font-size:13px;">${packOpts}</select>
        </div>
        ${sizeHTML}
        <div>
          <label style="font-size:12px;" id="item-count-label-${idx}">No. of Bags</label>
          <input type="number" class="item-count" data-idx="${idx}" min="1" value="${item.count||''}" placeholder="e.g. 30" style="font-size:13px;" oninput="SSIOrders.calcItemTotal(${idx})">
        </div>
        <div>
          <label style="font-size:12px;">Rate (₹/KG)</label>
          <input type="number" class="item-rate" data-idx="${idx}" min="0" step="0.01" value="${item.rate||''}" placeholder="e.g. 45" style="font-size:13px;" oninput="SSIOrders.calcItemTotal(${idx})">
        </div>
        <div>
          <label style="font-size:12px;">Total KG</label>
          <div id="item-qty-${idx}" style="font-size:16px;font-weight:800;color:#16a34a;padding:8px 0;">${SSIApp.qtyFmt(item.total_qty||0)}</div>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
        <div id="item-formula-${idx}" style="font-size:12px;color:#94a3b8;font-style:italic;"></div>
        <div id="item-line-total-${idx}" style="font-size:15px;font-weight:700;color:#e11d2e;">₹0.00</div>
      </div>
    </div>`;
  }

  function onItemProductChange(idx) {
    const productEl = document.querySelector(`.item-product[data-idx="${idx}"]`);
    const productId = productEl?.value;
    if (!productId) return;
    const st   = SSIApp.getState();
    const prod = (st.products||[]).find(p=>p.id===productId);
    if (!prod) return;

    const rateEl = document.querySelector(`.item-rate[data-idx="${idx}"]`);
    if (rateEl && !rateEl.value) {
      const autoRate = prod.selling_price || prod.default_rate || '';
      if (autoRate) rateEl.value = autoRate;
    }

    const mode   = document.querySelector(`.item-pack-mode[data-idx="${idx}"]`)?.value || 'BAG';
    const selEl  = document.querySelector(`.item-size-sel[data-idx="${idx}"]`);
    if (mode === 'BAG' && selEl) {
      selEl.innerHTML = _buildSizeOpts(prod, 0);
      if ((prod.pack_sizes||[]).length === 1) {
        const m = (prod.pack_sizes[0]+'').match(/[\d.]+/);
        if (m) selEl.value = parseFloat(m[0]);
      }
      const customI = document.querySelector(`.item-size-custom[data-idx="${idx}"]`);
      const warnEl  = document.querySelector(`.item-size-warning[data-idx="${idx}"]`);
      if (customI) { customI.value = ''; customI.style.display = 'none'; }
      if (warnEl)  warnEl.style.display = 'none';
    }
    calcItemTotal(idx);
  }

  function onItemPackChange(idx) {
    const mode     = document.querySelector(`.item-pack-mode[data-idx="${idx}"]`)?.value;
    const label    = document.getElementById(`item-count-label-${idx}`);
    const sizeWrap = document.getElementById(`item-size-wrap-${idx}`);
    const sizeLabel= document.getElementById(`item-size-label-${idx}`);

    if (label) label.textContent = mode==='NOS' ? 'Quantity' : mode==='BAG' ? 'No. of Bags' : 'No. of Cartons';
    if (sizeLabel) sizeLabel.textContent = mode==='BAG' ? 'Bag Size (KG)' : 'Ctn Size (KG)';
    if (sizeWrap) sizeWrap.style.display = (mode==='DIRECT_KG'||mode==='NOS') ? 'none' : '';

    const productId = document.querySelector(`.item-product[data-idx="${idx}"]`)?.value;
    const prod      = productId ? (SSIApp.getState().products||[]).find(p=>p.id===productId) : null;

    if (mode === 'BAG') {
      if (sizeWrap) {
        const existingSel = sizeWrap.querySelector('.item-size-sel');
        if (!existingSel) {
          sizeWrap.innerHTML = `
            <label style="font-size:12px;" id="item-size-label-${idx}">Bag Size (KG)</label>
            <select class="item-size-sel" data-idx="${idx}" onchange="SSIOrders.onItemSizeChange(${idx})" style="font-size:13px;">
              ${_buildSizeOpts(prod, 0)}
            </select>
            <input type="number" class="item-size-custom" data-idx="${idx}" min="0" step="0.001"
              placeholder="Enter KG" style="font-size:13px;margin-top:4px;display:none;"
              oninput="SSIOrders.calcItemTotal(${idx})">
            <div class="item-size-warning" data-idx="${idx}" style="color:#dc2626;font-size:11px;margin-top:3px;display:none;">
              ⚠️ Non-standard size — verify stock availability
            </div>`;
        } else {
          existingSel.innerHTML = _buildSizeOpts(prod, 0);
          const customI = sizeWrap.querySelector('.item-size-custom');
          const warnEl  = sizeWrap.querySelector('.item-size-warning');
          if (customI) { customI.value = ''; customI.style.display = 'none'; }
          if (warnEl)  warnEl.style.display = 'none';
        }
        if (prod && (prod.pack_sizes||[]).length === 1) {
          const m = (prod.pack_sizes[0]+'').match(/[\d.]+/);
          const sel2 = sizeWrap.querySelector('.item-size-sel');
          if (m && sel2) sel2.value = parseFloat(m[0]);
        }
      }
    } else {
      if (sizeWrap) {
        const existingManual = sizeWrap.querySelector('.item-size-manual');
        if (!existingManual) {
          sizeWrap.innerHTML = `
            <label style="font-size:12px;" id="item-size-label-${idx}">${mode==='BAG'?'Bag':'Ctn'} Size (KG)</label>
            <input type="number" class="item-size-manual" data-idx="${idx}" min="0" step="0.001"
              placeholder="e.g. 50"
              ${ mode==='CARTON_STD' ? 'readonly style="background:#f1f5f9;font-size:13px;"' : 'style="font-size:13px;"' }
              oninput="SSIOrders.calcItemTotal(${idx})">` ;
        } else {
          existingManual.readOnly = (mode === 'CARTON_STD');
          existingManual.style.background = mode==='CARTON_STD' ? '#f1f5f9' : '';
        }
        if (mode === 'CARTON_STD' && prod?.carton_std) {
          const manI = sizeWrap.querySelector('.item-size-manual');
          if (manI) manI.value = prod.carton_std;
        }
      }
    }
    calcItemTotal(idx);
  }

  function calcItemTotal(idx) {
    const mode   = document.querySelector(`.item-pack-mode[data-idx="${idx}"]`)?.value || 'BAG';
    const size   = _getSizeValue(idx);
    const count  = parseFloat(document.querySelector(`.item-count[data-idx="${idx}"]`)?.value) || 0;
    const rate   = parseFloat(document.querySelector(`.item-rate[data-idx="${idx}"]`)?.value) || 0;

    let totalQty = 0, formula = '';
    if (mode === 'BAG') {
      totalQty = size * count; formula = `${size} KG × ${count} bags = ${SSIApp.qtyFmt(totalQty)} KG`;
    } else if (mode === 'CARTON_STD' || mode === 'CARTON_MAN') {
      totalQty = size * count; formula = `${size} KG/ctn × ${count} cartons = ${SSIApp.qtyFmt(totalQty)} KG`;
    } else if (mode === 'DIRECT_KG') {
      totalQty = count; formula = `Direct: ${SSIApp.qtyFmt(totalQty)} KG`;
    } else if (mode === 'NOS') {
      totalQty = count; formula = `${count} Units/NOS`;
    }

    const lineTotal = totalQty * rate;
    const currency  = document.getElementById('ord-currency')?.value || 'INR';
    const qtyEl    = document.getElementById(`item-qty-${idx}`);
    const totalEl  = document.getElementById(`item-line-total-${idx}`);
    const formulaEl= document.getElementById(`item-formula-${idx}`);
    if (qtyEl)     qtyEl.textContent    = SSIApp.qtyFmt(totalQty);
    if (totalEl)   totalEl.textContent  = SSIApp.moneyFmt(lineTotal, currency);
    if (formulaEl) formulaEl.textContent= formula;
    recalcGrand();
  }

  function recalcGrand() {
    const rows     = document.querySelectorAll('.item-row');
    let grandKg    = 0, grandVal = 0;
    const currency = document.getElementById('ord-currency')?.value || 'INR';
    rows.forEach((row, idx) => {
      const mode  = document.querySelector(`.item-pack-mode[data-idx="${idx}"]`)?.value || 'BAG';
      const size  = _getSizeValue(idx);
      const count = parseFloat(document.querySelector(`.item-count[data-idx="${idx}"]`)?.value) || 0;
      const rate  = parseFloat(document.querySelector(`.item-rate[data-idx="${idx}"]`)?.value) || 0;
      let qty = (mode==='DIRECT_KG'||mode==='NOS') ? count : size*count;
      grandKg  += qty;
      grandVal += qty*rate;
    });
    const kgEl  = document.getElementById('ord-grand-kg');
    const valEl = document.getElementById('ord-grand-total');
    if (kgEl)  kgEl.textContent  = SSIApp.qtyFmt(grandKg) + ' KG';
    if (valEl) valEl.textContent = SSIApp.moneyFmt(grandVal, currency);
  }

  function addItemRow() {
    const container = document.getElementById('ord-items-container');
    if (!container) return;
    const st = SSIApp.getState();
    const productOpts = (st.products||[]).filter(p=>p.active!==false)
      .map(p=>`<option value="${p.id}">${p.name||''} (${p.uom||'KG'})</option>`).join('');
    const idx = container.querySelectorAll('.item-row').length;
    container.insertAdjacentHTML('beforeend', buildItemRow(idx, {}, productOpts));
  }

  function removeItemRow(idx) {
    const row = document.getElementById(`item-row-${idx}`);
    if (row) { row.remove(); recalcGrand(); }
  }

  function toggleUrgent() {
    const val = document.getElementById('ord-urgent-val');
    const btn = document.getElementById('ord-urgent-btn');
    const isUrgent = val.value === '1';
    val.value = isUrgent ? '0' : '1';
    btn.style.background  = isUrgent ? '#fff' : '#dc2626';
    btn.style.color       = isUrgent ? '#64748b' : '#fff';
    btn.style.borderColor = isUrgent ? '#d1d5db' : '#dc2626';
    btn.textContent       = isUrgent ? '⬜ URGENT — NO' : '🚨 URGENT — YES';
  }

  function collectItems() {
    const rows = document.querySelectorAll('.item-row');
    const items = [];
    rows.forEach((row, idx) => {
      const productId = document.querySelector(`.item-product[data-idx="${idx}"]`)?.value;
      if (!productId) return;
      const mode  = document.querySelector(`.item-pack-mode[data-idx="${idx}"]`)?.value || 'BAG';
      const size  = _getSizeValue(idx);
      const count = parseFloat(document.querySelector(`.item-count[data-idx="${idx}"]`)?.value) || 0;
      const rate  = parseFloat(document.querySelector(`.item-rate[data-idx="${idx}"]`)?.value) || 0;
      let totalQty = (mode==='DIRECT_KG'||mode==='NOS') ? count : size*count;
      items.push({ product_id:productId, pack_mode:mode, pack_size:size, count, rate, total_qty:totalQty, line_total:totalQty*rate });
    });
    return items;
  }

  /* ── Diff helper for richer history detail on edit ────────────── */
  function _diffOrder(prev, curr, st) {
    const lines = [];
    if (prev.client_id !== curr.client_id) {
      const pc = (st.clients||[]).find(c=>c.id===prev.client_id);
      const cc = (st.clients||[]).find(c=>c.id===curr.client_id);
      lines.push(`Client: ${pc?.name||'—'} → ${cc?.name||'—'}`);
    }
    if (prev.unit_id !== curr.unit_id) {
      const pu = (st.units||[]).find(u=>u.id===prev.unit_id);
      const cu = (st.units||[]).find(u=>u.id===curr.unit_id);
      lines.push(`Unit: ${pu?.name||'—'} → ${cu?.name||'—'}`);
    }
    if ((prev.urgent?1:0) !== (curr.urgent?1:0)) {
      lines.push(`Urgent: ${prev.urgent?'YES':'NO'} → ${curr.urgent?'YES':'NO'}`);
    }
    if (prev.currency !== curr.currency) {
      lines.push(`Currency: ${prev.currency||'INR'} → ${curr.currency||'INR'}`);
    }
    if ((prev.total_qty||0) !== (curr.total_qty||0)) {
      lines.push(`Total KG: ${SSIApp.qtyFmt(prev.total_qty||0)} → ${SSIApp.qtyFmt(curr.total_qty||0)}`);
    }
    if ((prev.total_value||0) !== (curr.total_value||0)) {
      lines.push(`Total Value: ${SSIApp.moneyFmt(prev.total_value||0, prev.currency||'INR')} → ${SSIApp.moneyFmt(curr.total_value||0, curr.currency||'INR')}`);
    }
    if ((prev.items||[]).length !== (curr.items||[]).length) {
      lines.push(`Items: ${(prev.items||[]).length} → ${(curr.items||[]).length}`);
    }
    if ((prev.remarks||'') !== (curr.remarks||'')) {
      lines.push(`Remarks changed`);
    }
    return lines.join(' | ');
  }

  async function saveOrder(orderId, status) {
    const date     = document.getElementById('ord-date')?.value;
    const unitId   = document.getElementById('ord-unit')?.value;
    const clientId = document.getElementById('ord-client')?.value;
    const currency = document.getElementById('ord-currency')?.value || 'INR';
    const urgent   = document.getElementById('ord-urgent-val')?.value === '1';
    const remarks  = document.getElementById('ord-remarks')?.value.trim() || '';
    const items    = collectItems();

    if (!date || !unitId || !clientId) { SSIApp.toast('Please fill Date, Unit and Client', 'error'); return; }
    if (!items.length) { SSIApp.toast('Add at least one order item', 'error'); return; }
    if (items.some(i=>i.total_qty<=0)) { SSIApp.toast('All items must have quantity > 0', 'error'); return; }

    const st2 = SSIApp.getState();
    const nonStdItems = items.filter(it => {
      if (it.pack_mode !== 'BAG' || !it.pack_size) return false;
      const p = (st2.products||[]).find(x=>x.id===it.product_id);
      if (!p || !(p.pack_sizes||[]).length) return false;
      return !(p.pack_sizes||[]).some(s=>{ const m=(s+'').match(/[\d.]+/); return m&&Math.abs(parseFloat(m[0])-it.pack_size)<0.001; });
    });
    if (nonStdItems.length && status === 'SUBMITTED') {
      const names = nonStdItems.map(it=>{
        const p = (st2.products||[]).find(x=>x.id===it.product_id);
        return `${p?.name||it.product_id} (${it.pack_size} KG)`;
      }).join(', ');
      const ok = await SSIApp.confirm(`⚠️ Non-standard bag size detected:\n${names}\n\nThis size is NOT in the product's pack sizes. Continue submitting?`);
      if (!ok) return;
    }

    const totalKg    = items.reduce((s,i)=>s+(i.total_qty||0), 0);
    const totalValue = items.reduce((s,i)=>s+(i.line_total||0), 0);
    const user       = SSIApp.currentUser();
    const st         = SSIApp.getState();
    const nowIso     = new Date().toISOString();

    if (orderId) {
      const idx = (st.orders||[]).findIndex(o=>o.id===orderId);
      if (idx<0) { SSIApp.toast('Order not found', 'error'); return; }

      const prev = st.orders[idx];

      // Permission check
      if (!_canEdit(prev, user)) {
        SSIApp.toast('You cannot edit this order', 'warning');
        return;
      }

      const wasSubmitted = prev.status === 'SUBMITTED';
      const prevSnapshot = JSON.parse(JSON.stringify({
        client_id: prev.client_id, unit_id: prev.unit_id,
        urgent: prev.urgent, currency: prev.currency,
        total_qty: prev.total_qty, total_value: prev.total_value,
        items: prev.items, remarks: prev.remarks
      }));

      Object.assign(prev, {
        date, unit_id:unitId, client_id:clientId, currency, urgent, remarks, items,
        total_qty:totalKg, total_value:totalValue, status,
        updated_at: nowIso,
        updated_by: user?.username || 'unknown'
      });
      if (status==='SUBMITTED' && !prev.submitted_at) prev.submitted_at = nowIso;

      // If editing a SUBMITTED order, mark it
      if (wasSubmitted && status === 'SUBMITTED') {
        prev.edited_after_submit_at = nowIso;
        prev.edited_after_submit_by = user?.username || 'unknown';
      }

      const diffNow = JSON.parse(JSON.stringify({
        client_id: prev.client_id, unit_id: prev.unit_id,
        urgent: prev.urgent, currency: prev.currency,
        total_qty: prev.total_qty, total_value: prev.total_value,
        items: prev.items, remarks: prev.remarks
      }));
      const diffDetail = _diffOrder(prevSnapshot, diffNow, st) || `Total ${SSIApp.qtyFmt(totalKg)} KG / ${SSIApp.moneyFmt(totalValue, currency)}`;

      const action =
          (wasSubmitted && status === 'SUBMITTED') ? 'EDITED (after submit)'
        : (status === 'SUBMITTED' && !wasSubmitted) ? 'SUBMITTED'
        : (status === 'DRAFT')                       ? 'EDITED (Draft)'
        : 'EDITED';

      _addHistory(prev, action, diffDetail);

      SSIApp.toast(`Order ${prev.order_no} updated ✅`);
      SSIApp.audit('ORDER_EDIT', `${prev.order_no} ${action} by ${user?.username||'unknown'} — ${diffDetail}`);
    } else {
      const orderNo = SSIApp.nextOrderNo(st);
      const newOrder = {
        id: SSIApp.uid(),
        order_no: orderNo,
        date, unit_id:unitId, client_id:clientId,
        currency, urgent, remarks, items,
        total_qty: totalKg, total_value: totalValue,
        status,
        created_by: user?.id,
        created_by_username: user?.username || '',
        created_at: nowIso,
        submitted_at: status==='SUBMITTED' ? nowIso : null,
        history: []
      };
      _addHistory(newOrder, status === 'SUBMITTED' ? 'CREATED + SUBMITTED' : 'CREATED (Draft)',
        `Total ${SSIApp.qtyFmt(totalKg)} KG / ${SSIApp.moneyFmt(totalValue, currency)}`);
      if (!st.orders) st.orders = [];
      st.orders.push(newOrder);
      SSIApp.toast(`Order ${orderNo} ${status==='SUBMITTED'?'submitted':'saved'} ✅`);
      SSIApp.audit('ORDER_CREATE', `${orderNo} ${status} by ${user?.username||'unknown'}`);
    }

    if (!st.orders) st.orders = [];
    await SSIApp.saveState(st);
    SSIApp.closeModal();
    refresh(document.getElementById('page-area'));
  }

  function viewOrder(orderId) {
    const st   = SSIApp.getState();
    const o    = (st.orders||[]).find(x=>x.id===orderId);
    if (!o) return;
    const client  = (st.clients||[]).find(c=>c.id===o.client_id);
    const unit    = (st.units||[]).find(u=>u.id===o.unit_id);
    const salesp  = (st.users||[]).find(u=>u.id===o.created_by);
    const dispBy  = o.dispatched_by ? (st.users||[]).find(u=>u.id===o.dispatched_by) : null;
    const statusColors = {DRAFT:'#64748b',SUBMITTED:'#d97706',DISPATCHED:'#16a34a',CANCELLED:'#dc2626'};

    const buildItemsTable = (items, currency, title, headerColor) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;color:${headerColor};margin-bottom:8px;">${title}</div>
        <table>
          <thead><tr><th>#</th><th>Product</th><th>Pack</th><th>Size</th><th>Count</th><th style="text-align:right;">Total KG</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${(items||[]).map((item,i)=>{
              const prod = (st.products||[]).find(p=>p.id===item.product_id);
              const qty = item.dispatched_qty !== undefined ? item.dispatched_qty : item.total_qty;
              const lineAmt = item.dispatched_qty !== undefined ? item.dispatched_line_total : item.line_total;
              return `<tr>
                <td>${i+1}</td>
                <td><strong>${prod?.name||'—'}</strong></td>
                <td style="font-size:12px;">${item.pack_mode||'—'}</td>
                <td>${item.pack_size>0?item.pack_size+' KG':'—'}</td>
                <td>${item.count||0}</td>
                <td style="text-align:right;font-weight:700;">${SSIApp.qtyFmt(qty||0)}</td>
                <td style="text-align:right;">${SSIApp.moneyFmt(item.rate||0,currency)}</td>
                <td style="text-align:right;font-weight:700;">${SSIApp.moneyFmt(lineAmt||0,currency)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f8fafc;">
              <td colspan="5" style="text-align:right;font-weight:700;">Totals:</td>
              <td style="text-align:right;font-weight:800;">${SSIApp.qtyFmt((items||[]).reduce((s,i)=> s + (i.dispatched_qty !== undefined ? i.dispatched_qty : i.total_qty||0), 0))} KG</td>
              <td></td>
              <td style="text-align:right;font-weight:800;color:#e11d2e;">${SSIApp.moneyFmt((items||[]).reduce((s,i)=> s + (i.dispatched_qty !== undefined ? i.dispatched_line_total : i.line_total||0), 0), currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;

    const buildComparisonTable = () => {
      if (!o.dispatch_modified || !o.dispatched_items) return '';
      return `
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px;margin-top:16px;">
          <div style="font-size:14px;font-weight:700;color:#92400e;margin-bottom:12px;">📊 Original vs Dispatched Comparison</div>
          <table>
            <thead><tr>
              <th>Product</th>
              <th style="text-align:right;">Ordered KG</th>
              <th style="text-align:right;">Dispatched KG</th>
              <th style="text-align:right;">Difference</th>
              <th style="text-align:right;">Ordered Value</th>
              <th style="text-align:right;">Dispatched Value</th>
            </tr></thead>
            <tbody>
              ${(o.original_items||[]).map((orig, i) => {
                const disp = (o.dispatched_items||[])[i] || {};
                const prod = (st.products||[]).find(p=>p.id===orig.product_id);
                const diff = (disp.dispatched_qty||0) - (orig.total_qty||0);
                return `<tr>
                  <td><strong>${prod?.name||'—'}</strong></td>
                  <td style="text-align:right;">${SSIApp.qtyFmt(orig.total_qty||0)}</td>
                  <td style="text-align:right;font-weight:700;color:${diff<0?'#dc2626':'#16a34a'};">${SSIApp.qtyFmt(disp.dispatched_qty||0)}</td>
                  <td style="text-align:right;font-weight:700;color:${diff<0?'#dc2626':'#16a34a'};">${diff>=0?'+':''}${SSIApp.qtyFmt(diff)}</td>
                  <td style="text-align:right;">${SSIApp.moneyFmt(orig.line_total||0,o.currency)}</td>
                  <td style="text-align:right;font-weight:700;color:${diff<0?'#dc2626':'#16a34a'};">${SSIApp.moneyFmt(disp.dispatched_line_total||0,o.currency)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    };

    const buildTimeline = () => {
      const items = (o.history && o.history.length) ? o.history : [];
      if (!items.length) return `
        <div style="margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:6px;">🕒 Order Timeline</div>
          <div style="font-size:13px;color:#94a3b8;">No history recorded yet.</div>
        </div>`;
      return `
        <div style="margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:10px;">🕒 Order Timeline (${items.length} entries)</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#fff;">
                <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">When</th>
                <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">Action</th>
                <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">By</th>
                <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;">Detail</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(h => `
                <tr style="border-top:1px solid #e2e8f0;">
                  <td style="padding:6px 8px;font-size:12px;white-space:nowrap;">${SSIApp.dateFmt(h.ts)}<br><span style="color:#94a3b8;">${(h.ts||'').slice(11,19)}</span></td>
                  <td style="padding:6px 8px;font-size:12px;font-weight:700;color:#334155;">${h.action||''}</td>
                  <td style="padding:6px 8px;font-size:12px;">${h.user_name || h.user || ''}</td>
                  <td style="padding:6px 8px;font-size:12px;color:#475569;">${h.detail || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    };

    const html = `
      <div class="modal-header">
        <h3 style="font-size:18px;font-weight:700;">Order Details — ${o.order_no} ${o.urgent?'🚨':''} ${o.dispatch_modified?'<span style="background:#fef3c7;color:#92400e;font-size:13px;padding:2px 8px;border-radius:4px;">✏️ Modified</span>':''} ${o.edited_after_submit_at?'<span style="background:#dbeafe;color:#1e40af;font-size:13px;padding:2px 8px;border-radius:4px;">✏️ Edited after submit</span>':''} ${o.status==='CANCELLED'?'<span style="background:#fee2e2;color:#991b1b;font-size:13px;padding:2px 8px;border-radius:4px;">CANCELLED</span>':''}</h3>
        <button onclick="SSIApp.closeModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Client</div><strong>${client?.name||'—'}</strong>${(client?.gst_no||client?.gst)?`<br><span style="font-size:12px;color:#16a34a;">GST: ${client.gst_no||client.gst}</span>`:''}</div>
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Unit</div><strong>${unit?.name||'—'}</strong></div>
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Order Date</div><strong>${SSIApp.dateFmt(o.date)}</strong></div>
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Status</div>
            <span style="color:${statusColors[o.status]};font-weight:700;">${o.status}</span>
            ${o.dispatch_modified ? '<span style="background:#fef3c7;color:#92400e;font-size:10px;padding:1px 6px;border-radius:3px;margin-left:6px;">MODIFIED</span>' : ''}
            ${o.edited_after_submit_at ? `<br><span style="font-size:11px;color:#1e40af;">Edited after submit: ${SSIApp.dateFmt(o.edited_after_submit_at)} by ${o.edited_after_submit_by||'—'}</span>`:''}
            ${o.dispatched_at?`<br><span style="font-size:11px;color:#64748b;">Dispatched: ${SSIApp.dateFmt(o.dispatched_at)} by ${dispBy?.name||'—'}</span>`:''}
            ${o.cancelled_at?`<br><span style="font-size:11px;color:#dc2626;">Cancelled: ${SSIApp.dateFmt(o.cancelled_at)} by ${o.cancelled_by||'—'}</span>`:''}
          </div>
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Salesperson</div><strong>${salesp?.name||'—'}</strong></div>
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Currency</div><strong>${o.currency||'INR'}</strong></div>
          ${o.remarks?`<div class="info-card" style="grid-column:span 2;"><div style="font-size:12px;color:#64748b;">Remarks</div><strong>${o.remarks}</strong></div>`:''}
          ${o.dispatch_note?`<div class="info-card" style="grid-column:span 2;"><div style="font-size:12px;color:#64748b;">Dispatch Note</div><strong>${o.dispatch_note}</strong></div>`:''}
        </div>

        ${o.dispatch_modified
          ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
               <div style="background:#fef2f2;border-radius:10px;padding:14px;border:1px solid #fca5a5;">
                 ${buildItemsTable(o.original_items||o.items, o.currency, '📋 Original Order (as submitted by Sales)', '#991b1b')}
               </div>
               <div style="background:#f0fdf4;border-radius:10px;padding:14px;border:1px solid #86efac;">
                 ${buildItemsTable(o.dispatched_items||o.items, o.currency, '🚚 Actually Dispatched (modified by Dispatch team)', '#166534')}
               </div>
             </div>
             ${buildComparisonTable()}`
          : buildItemsTable(o.items, o.currency, '📋 Order Items', '#111827')
        }

        ${buildTimeline()}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Close</button>
      </div>`;

    SSIApp.showModal(html);
  }

  /* ── Cancel order (soft delete: kept in history as CANCELLED) ── */
  async function cancelOrder(orderId) {
    const st = SSIApp.getState();
    const o  = (st.orders||[]).find(x=>x.id===orderId);
    if (!o) return;
    const user = SSIApp.currentUser();

    if (!_canCancel(o, user)) { SSIApp.toast('You cannot cancel this order', 'warning'); return; }
    if (o.status === 'CANCELLED') { SSIApp.toast('Order is already cancelled', 'info'); return; }
    if (o.status === 'DISPATCHED') { SSIApp.toast('Cannot cancel a dispatched order', 'warning'); return; }

    const ok = await SSIApp.confirm(
      `⚠️ Cancel Order ${o.order_no}?\n\n` +
      `Status will change to CANCELLED.\n` +
      `The order will be kept in history (you can view it via the Status filter "Cancelled (only)").\n` +
      `Inventory will NOT be changed.\n\nProceed?`
    );
    if (!ok) return;

    const nowIso = new Date().toISOString();
    o.status         = 'CANCELLED';
    o.cancelled_at   = nowIso;
    o.cancelled_by   = user?.username || 'unknown';
    o.updated_at     = nowIso;
    _addHistory(o, 'CANCELLED', '');

    await SSIApp.saveState(st);
    SSIApp.toast(`Order ${o.order_no} cancelled`);
    SSIApp.audit('ORDER_CANCEL', `${o.order_no} cancelled by ${o.cancelled_by}`);
    refresh(document.getElementById('page-area'));
  }

  /* ── Permanently delete an order — ADMIN, only on already-cancelled orders ── */
  async function deleteOrder(orderId) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st = SSIApp.getState();
    const o  = (st.orders||[]).find(x=>x.id===orderId);
    if (!o) return;

    if (o.status !== 'CANCELLED') {
      SSIApp.toast('Cancel the order first before permanently deleting', 'warning');
      return;
    }

    const ok1 = await SSIApp.confirm(
      `⚠️ PERMANENTLY DELETE order ${o.order_no}?\n\n` +
      `This order is already CANCELLED. Deleting it will remove the record entirely from the system.\n` +
      `The audit log will keep a trace of the deletion.\n\nProceed to step 2 of 2?`
    );
    if (!ok1) return;

    const ok2 = await SSIApp.confirm(
      `🚨 FINAL CONFIRMATION\n\nOrder ${o.order_no} will be permanently removed.\nThis cannot be undone.\n\nClick OK to confirm.`
    );
    if (!ok2) return;

    st.orders = (st.orders||[]).filter(x=>x.id!==orderId);
    await SSIApp.saveState(st);
    SSIApp.toast(`Order ${o.order_no} permanently deleted ✅`);
    SSIApp.audit('ORDER_DELETE', `${o.order_no} permanently deleted by ${SSIApp.state.currentUser?.username || 'admin'} (no inventory change)`);
    refresh(document.getElementById('page-area'));
  }

  function exportExcel() {
    const st   = SSIApp.getState();
    const rows = [['Order #','Date','Client','GST No','Unit','Ordered KG','Dispatched KG','Ordered Value','Dispatched Value','Currency','Urgent','Status','Modified?','Edited after submit?','Salesperson','Dispatch Note','Remarks','Last Change At','Last Change By','Last Change Action']];
    (st.orders||[]).forEach(o => {
      const client = (st.clients||[]).find(c=>c.id===o.client_id);
      const unit   = (st.units||[]).find(u=>u.id===o.unit_id);
      const salesp = (st.users||[]).find(u=>u.id===o.created_by);
      const last   = (o.history && o.history.length) ? o.history[o.history.length-1] : null;
      rows.push([
        o.order_no, o.date, client?.name||'', client?.gst_no||client?.gst||'', unit?.name||'',
        o.total_qty||0,
        o.dispatch_modified ? (o.dispatched_qty||0) : (o.total_qty||0),
        o.total_value||0,
        o.dispatch_modified ? (o.dispatched_value||0) : (o.total_value||0),
        o.currency||'INR',
        o.urgent?'YES':'NO',
        o.status,
        o.dispatch_modified ? 'YES' : 'NO',
        o.edited_after_submit_at ? 'YES' : 'NO',
        salesp?.name||'',
        o.dispatch_note||'',
        o.remarks||'',
        last?.ts || '',
        last?.user_name || last?.user || '',
        last?.action || ''
      ]);
    });
    SSIApp.excelDownload(rows, 'Orders', 'SSI_Orders_Export');
    SSIApp.toast('Orders exported ✅');
  }

  return { render, refresh, openForm, saveOrder, viewOrder, cancelOrder, deleteOrder, addItemRow, removeItemRow, toggleUrgent, calcItemTotal, onItemProductChange, onItemPackChange, onItemSizeChange, recalcGrand, applyFilter, exportExcel };
})();
