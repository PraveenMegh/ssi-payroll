/* ============================================================
   SSI Dispatch Module (v2 SAFE)
   Stage 1 Batch 2: confirmation popups + dispatch quantity rules + timeline log
   Rules:
     - Dispatch qty CAN be less than ordered (partial dispatch)
     - Dispatch qty CANNOT exceed ordered (blocked, with optional ADMIN override)
     - Mandatory note when modifying quantities
     - Dispatch + reversal logged in order timeline + audit log
   ============================================================ */
const SSIDispatch = (() => {

  // Safe confirm helper — uses SSIApp.confirm if available, else native confirm
  async function _safeConfirm(msg) {
    if (window.SSIApp && typeof SSIApp.confirm === 'function') {
      try { return await SSIApp.confirm(msg); } catch(e) { /* fall through */ }
    }
    return window.confirm(msg);
  }

  // Append a history entry to an order (matches orders.js timeline format)
  function _addOrderHistory(order, action, detail) {
    if (!order.history) order.history = [];
    order.history.push({
      action,
      detail: detail || '',
      ts: new Date().toISOString(),
      user: SSIApp.state.currentUser?.username || 'unknown',
      user_name: SSIApp.state.currentUser?.name || ''
    });
  }

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','DISPATCH','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    refresh(area);
  }

  function refresh(area) {
    if (!area) area = document.getElementById('app-area') || document.getElementById('page-area');
    if (!area) return;
    const st   = SSIApp.getState();
    const queue    = (st.orders||[]).filter(o => o.status === 'SUBMITTED')
      .sort((a,b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return new Date(a.submitted_at||a.created_at) - new Date(b.submitted_at||b.created_at);
      });
    const history  = (st.orders||[]).filter(o => ['DISPATCHED','CANCELLED'].includes(o.status))
      .sort((a,b) => new Date(b.dispatched_at||b.updated_at||b.created_at) - new Date(a.dispatched_at||a.updated_at||a.created_at));

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">🚚 Dispatch Queue</h2>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary btn-sm" onclick="SSIDispatch.exportExcel()">📤 Export History</button>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #e2e8f0;">
        <button id="tab-queue" onclick="SSIDispatch.showTab('queue')"
          style="padding:12px 24px;border:none;background:none;font-size:14px;font-weight:700;color:#e11d2e;border-bottom:3px solid #e11d2e;cursor:pointer;margin-bottom:-2px;">
          📋 Queue
          <span style="background:#e11d2e;color:#fff;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:6px;">${queue.length}</span>
        </button>
        <button id="tab-history" onclick="SSIDispatch.showTab('history')"
          style="padding:12px 24px;border:none;background:none;font-size:14px;font-weight:600;color:#64748b;border-bottom:3px solid transparent;cursor:pointer;margin-bottom:-2px;">
          📦 History (${history.length})
        </button>
      </div>

      <!-- Queue Panel -->
      <div id="panel-queue">
        ${queue.length === 0
          ? '<div class="card empty-state"><div class="icon">✅</div><p>No pending orders. All dispatched!</p></div>'
          : queue.map(o => buildQueueCard(o, st)).join('')}
      </div>

      <!-- History Panel -->
      <div id="panel-history" style="display:none;">
        <div class="card">
          <div style="overflow-x:auto;">
            <table>
              <thead><tr>
                <th>Order #</th><th>Date</th><th>Client</th><th>Unit</th>
                <th>Ordered KG</th><th>Dispatched KG</th><th>Value</th>
                <th>Status</th><th>Dispatched By</th><th>Dispatch Date</th>
                ${SSIApp.hasRole('ADMIN') ? '<th>Actions</th>' : ''}
              </tr></thead>
              <tbody>
                ${history.map(o => {
                  const client   = st.clients.find(c=>c.id===o.client_id);
                  const unit     = st.units.find(u=>u.id===o.unit_id);
                  const dispBy   = st.users.find(u=>u.id===o.dispatched_by);
                  const isModified = o.dispatch_modified;
                  const dispQty  = isModified ? (o.dispatched_qty||0) : (o.total_qty||0);
                  const dispVal  = isModified ? (o.dispatched_value||0) : (o.total_value||0);
                  return `<tr>
                    <td><strong>${o.order_no}</strong>${isModified ? ' <span style="background:#fef3c7;color:#b45309;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;">✏️ MODIFIED</span>' : ''}</td>
                    <td>${SSIApp.dateFmt(o.date)}</td>
                    <td>${client?.name||'—'}</td>
                    <td>${unit?.name||'—'}</td>
                    <td style="color:#64748b;">${SSIApp.qtyFmt(o.total_qty||0)} KG</td>
                    <td style="font-weight:700;color:${isModified?'#d97706':'#16a34a'};">${SSIApp.qtyFmt(dispQty)} KG${isModified?` <span style="font-size:10px;color:#dc2626;">(↓${SSIApp.qtyFmt((o.total_qty||0)-dispQty)})</span>`:''}</td>
                    <td>${SSIApp.moneyFmt(dispVal,o.currency||'INR')}</td>
                    <td><span class="badge ${o.status==='DISPATCHED'?'badge-dispatched':'badge-cancelled'}">${o.status}</span></td>
                    <td style="font-size:12px;">${dispBy?.name||'—'}</td>
                    <td style="font-size:12px;">${SSIApp.dateFmt(o.dispatched_at)}</td>
                    ${SSIApp.hasRole('ADMIN') ? `<td>${o.status==='DISPATCHED' ? `<button class="btn btn-danger btn-sm" onclick="SSIDispatch.deleteDispatch('${o.id}')" title="Reverse dispatch (returns stock)">↩️ Reverse</button>` : ''}</td>` : ''}
                  </tr>`;
                }).join('') || `<tr><td colspan="${SSIApp.hasRole('ADMIN')?11:10}" style="text-align:center;padding:30px;color:#94a3b8;">No dispatch history yet</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function buildQueueCard(o, st) {
    const client  = st.clients.find(c=>c.id===o.client_id);
    const unit    = st.units.find(u=>u.id===o.unit_id);
    const salesp  = st.users.find(u=>u.id===o.created_by);
    const waitHrs = o.submitted_at
      ? Math.round((Date.now()-new Date(o.submitted_at).getTime())/3600000)
      : 0;

    const hasInsufficient = (o.items||[]).some(item => SSIApp.getStock(item.product_id, o.unit_id) < (item.total_qty||0));

    return `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px;overflow:hidden;border-left:4px solid ${o.urgent?'#dc2626':'#C0392B'};">
      <!-- Header -->
      <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:${o.urgent?'#fff5f5':'#f8fafc'};">
        <div style="display:flex;align-items:center;gap:12px;">
          ${o.urgent?'<span style="font-size:24px;">🚨</span>':'<span style="font-size:24px;">📋</span>'}
          <div>
            <div style="font-size:16px;font-weight:800;color:#111827;">${o.order_no} ${o.urgent?'— <span style="color:#dc2626;">URGENT</span>':''}</div>
            <div style="font-size:13px;color:#64748b;">${client?.name||'—'} | ${unit?.name||'—'} | By: ${salesp?.name||'—'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          ${hasInsufficient ? '<span style="background:#fef3c7;color:#b45309;font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;">⚠️ Partial Stock</span>' : ''}
          <div style="text-align:right;">
            <div style="font-size:13px;color:#64748b;">Waiting</div>
            <div style="font-size:15px;font-weight:700;color:${waitHrs>24?'#dc2626':'#d97706'};">${waitHrs}h</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;color:#64748b;">Total KG</div>
            <div style="font-size:15px;font-weight:700;">${SSIApp.qtyFmt(o.total_qty||0)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;color:#64748b;">Value</div>
            <div style="font-size:15px;font-weight:700;">${SSIApp.moneyFmt(o.total_value||0,o.currency)}</div>
          </div>
          <button class="btn btn-primary" onclick="SSIDispatch.openDispatchModal('${o.id}')">▶ Process</button>
        </div>
      </div>
      <!-- Items preview -->
      <div style="padding:12px 20px;border-top:1px solid #f1f5f9;">
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${(o.items||[]).map(item => {
            const prod = st.products.find(p=>p.id===item.product_id);
            const avail = SSIApp.getStock(item.product_id, o.unit_id);
            const ok = avail >= (item.total_qty||0);
            return `<span style="background:${ok?'#dcfce7':'#fee2e2'};color:${ok?'#166534':'#991b1b'};padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">
              ${prod?.name||'—'}: ${SSIApp.qtyFmt(item.total_qty||0)} KG ${ok?'✅':'⚠️ LOW (avail: '+SSIApp.qtyFmt(avail)+')'}
            </span>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }

  function openDispatchModal(orderId) {
    const st     = SSIApp.getState();
    const o      = (st.orders||[]).find(x=>x.id===orderId);
    if (!o) return;
    if (o.status !== 'SUBMITTED') {
      SSIApp.toast(`Order is ${o.status}, cannot dispatch again`, 'warning');
      return;
    }
    const client = st.clients.find(c=>c.id===o.client_id);
    const unit   = st.units.find(u=>u.id===o.unit_id);

    const itemRows = (o.items||[]).map((item, i) => {
      const prod  = st.products.find(p=>p.id===item.product_id);
      const avail = SSIApp.getStock(item.product_id, o.unit_id);
      const ok    = avail >= (item.total_qty||0);
      // Default dispatch qty = min(ordered, available), but at least 0
      const defaultDispQty = Math.min(item.total_qty||0, Math.max(0, avail));
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${prod?.name||'—'}</strong><br><span style="font-size:11px;color:#94a3b8;">${item.pack_mode||''}</span></td>
        <td style="font-weight:700;">${SSIApp.qtyFmt(item.total_qty||0)} ${prod?.uom||'KG'}</td>
        <td style="font-weight:700;color:${avail<=0?'#dc2626':ok?'#16a34a':'#d97706'};">${SSIApp.qtyFmt(avail)} ${prod?.uom||'KG'}</td>
        <td>
          <input type="number"
            id="dqty-${i}"
            value="${defaultDispQty.toFixed(3)}"
            min="0"
            max="${item.total_qty||0}"
            step="0.001"
            data-ordered="${item.total_qty||0}"
            style="width:110px;padding:6px 8px;border:2px solid ${ok?'#86efac':'#fca5a5'};border-radius:6px;font-size:13px;font-weight:700;text-align:right;"
            oninput="SSIDispatch.updateDispatchTotal('${orderId}')">
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;">max: ${SSIApp.qtyFmt(item.total_qty||0)}</div>
          <div id="dwarn-${i}" style="font-size:10px;color:#dc2626;margin-top:2px;display:none;font-weight:700;">⚠️ Exceeds ordered qty</div>
        </td>
        <td id="dline-${i}" style="font-weight:700;font-size:13px;text-align:right;">
          ${SSIApp.moneyFmt(defaultDispQty * (item.rate||0), o.currency||'INR')}
        </td>
        <td><span style="background:${ok?'#dcfce7':'#fef3c7'};color:${ok?'#166534':'#b45309'};font-size:11px;padding:2px 7px;border-radius:10px;font-weight:700;">${ok?'✅ OK':'⚠️ PARTIAL'}</span></td>
      </tr>`;
    }).join('');

    const initDispQty   = (o.items||[]).reduce((s,item) => s + Math.min(item.total_qty||0, Math.max(0, SSIApp.getStock(item.product_id, o.unit_id))), 0);
    const initDispValue = (o.items||[]).reduce((s,item,i) => s + Math.min(item.total_qty||0, Math.max(0, SSIApp.getStock(item.product_id, o.unit_id))) * (item.rate||0), 0);
    const allOk         = (o.items||[]).every(item => SSIApp.getStock(item.product_id, o.unit_id) >= (item.total_qty||0));

    const html = `
      <div class="modal-header">
        <h3 style="font-size:18px;font-weight:700;">🚚 Process Dispatch — ${o.order_no} ${o.urgent?'🚨':''}</h3>
        <button onclick="SSIApp.closeModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">✕</button>
      </div>
      <div class="modal-body">
        <!-- Order Info -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Client</div><strong>${client?.name||'—'}</strong>${(client?.gst_no||client?.gst)?`<br><span style="font-size:12px;color:#16a34a;">${client.gst_no||client.gst}</span>`:''}</div>
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Unit</div><strong>${unit?.name||'—'}</strong></div>
          <div class="info-card"><div style="font-size:12px;color:#64748b;">Ordered Value</div><strong>${SSIApp.moneyFmt(o.total_value||0,o.currency)}</strong></div>
        </div>

        <!-- Instruction banner -->
        ${!allOk ? `
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
          <strong style="color:#92400e;">⚠️ Partial Stock Available</strong>
          <p style="font-size:13px;color:#b45309;margin-top:4px;">Some items have less stock than ordered. The <strong>Dispatch Qty</strong> has been auto-filled with available stock. You can REDUCE the quantity if needed — but you CANNOT exceed the ordered quantity.</p>
        </div>` : `
        <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
          <strong style="color:#166534;">✅ Full stock available for all items!</strong>
        </div>`}

        <!-- Items Table with editable Dispatch Qty -->
        <div style="overflow-x:auto;">
          <table>
            <thead><tr>
              <th>#</th>
              <th>Product</th>
              <th>Ordered Qty</th>
              <th>In Stock</th>
              <th>✏️ Dispatch Qty <span style="font-weight:400;font-size:11px;">(editable, ≤ ordered)</span></th>
              <th style="text-align:right;">Line Value</th>
              <th>Stock Status</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
              <tr style="background:#f8fafc;font-weight:700;">
                <td colspan="2" style="text-align:right;">TOTALS →</td>
                <td style="color:#64748b;">${SSIApp.qtyFmt(o.total_qty||0)} KG<br><span style="font-size:11px;font-weight:400;">(original order)</span></td>
                <td></td>
                <td>
                  <div id="disp-total-kg" style="font-size:16px;font-weight:800;color:#111827;">${SSIApp.qtyFmt(initDispQty)} KG</div>
                  <div style="font-size:11px;color:#64748b;">to dispatch</div>
                </td>
                <td style="text-align:right;">
                  <div id="disp-total-val" style="font-size:15px;font-weight:800;color:#e11d2e;">${SSIApp.moneyFmt(initDispValue, o.currency||'INR')}</div>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Dispatch Note -->
        <div style="margin-top:16px;">
          <label id="dispatch-note-label">📝 Dispatch Note <span style="color:#94a3b8;font-weight:400;font-size:12px;">(optional — required if dispatch qty < ordered)</span></label>
          <input id="dispatch-note" placeholder="e.g. Truck No. UP15AB1234, Driver: Ramesh / Reason for partial: stock shortage">
        </div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;">
        <div id="disp-mod-warn" style="font-size:12px;color:#b45309;display:${allOk?'none':'block'};">
          ⚠️ Dispatch qty differs from order — order will be marked <strong>DISPATCHED (Modified)</strong>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-success" id="disp-confirm-btn" onclick="SSIDispatch.confirmDispatch('${orderId}')">✅ Confirm Dispatch</button>
        </div>
      </div>`;

    SSIApp.showModal(html);
  }

  // Live update totals when dispatch qty is changed
  function updateDispatchTotal(orderId) {
    const st = SSIApp.getState();
    const o  = (st.orders||[]).find(x=>x.id===orderId);
    if (!o) return;

    let totalDispKg  = 0;
    let totalDispVal = 0;
    let anyModified  = false;
    let anyExceeds   = false;

    (o.items||[]).forEach((item, i) => {
      const inputEl = document.getElementById(`dqty-${i}`);
      let dqty = parseFloat(inputEl?.value || 0);
      const ordered = item.total_qty || 0;

      // Block exceed-ordered: clamp visually + show warning
      const warnEl = document.getElementById(`dwarn-${i}`);
      if (dqty > ordered) {
        if (warnEl) warnEl.style.display = 'block';
        anyExceeds = true;
      } else {
        if (warnEl) warnEl.style.display = 'none';
      }

      // For computing totals, use clamped value (capped at ordered)
      const clamped = Math.min(Math.max(0, dqty), ordered);

      const lineVal = clamped * (item.rate||0);
      totalDispKg  += clamped;
      totalDispVal += lineVal;
      if (Math.abs(clamped - ordered) > 0.001) anyModified = true;

      const lineEl = document.getElementById(`dline-${i}`);
      if (lineEl) lineEl.textContent = SSIApp.moneyFmt(lineVal, o.currency||'INR');
    });

    const kgEl  = document.getElementById('disp-total-kg');
    const valEl = document.getElementById('disp-total-val');
    const warn  = document.getElementById('disp-mod-warn');
    const btn   = document.getElementById('disp-confirm-btn');
    if (kgEl)  kgEl.textContent  = SSIApp.qtyFmt(totalDispKg) + ' KG';
    if (valEl) valEl.textContent = SSIApp.moneyFmt(totalDispVal, o.currency||'INR');
    if (warn)  warn.style.display = anyModified ? 'block' : 'none';

    // Disable Confirm if any value exceeds ordered
    if (btn) {
      btn.disabled = anyExceeds;
      btn.style.opacity = anyExceeds ? '.5' : '1';
      btn.style.cursor  = anyExceeds ? 'not-allowed' : 'pointer';
      btn.title = anyExceeds ? 'Some dispatch quantities exceed ordered — fix before confirming' : '';
    }
  }

  async function confirmDispatch(orderId) {
    const noteEl = document.getElementById('dispatch-note');
    const note   = noteEl?.value.trim() || '';
    const st     = SSIApp.getState();
    const o      = (st.orders||[]).find(x=>x.id===orderId);
    if (!o) return;

    if (o.status !== 'SUBMITTED') {
      SSIApp.toast(`Order is ${o.status}, cannot dispatch again`, 'warning');
      return;
    }

    const user = SSIApp.currentUser();
    const now  = new Date().toISOString();
    const today= now.slice(0,10);

    // Collect actual dispatch quantities, validate
    let exceededAny = false;
    const dispatchedItems = (o.items||[]).map((item, i) => {
      const dqty = parseFloat(document.getElementById(`dqty-${i}`)?.value || 0);
      if (dqty > (item.total_qty||0)) exceededAny = true;
      const safe = Math.min(Math.max(0, dqty), item.total_qty||0);
      return {
        ...item,
        dispatched_qty: safe,
        dispatched_line_total: safe * (item.rate||0)
      };
    });

    if (exceededAny) {
      SSIApp.toast('❌ Dispatch quantity cannot exceed ordered quantity. Please fix.', 'error');
      return;
    }

    const dispatchedQty   = dispatchedItems.reduce((s,i) => s + (i.dispatched_qty||0), 0);
    const dispatchedValue = dispatchedItems.reduce((s,i) => s + (i.dispatched_line_total||0), 0);

    if (dispatchedQty <= 0) {
      SSIApp.toast('Dispatch quantity cannot be zero!', 'error');
      return;
    }

    const isModified = dispatchedItems.some(item =>
      Math.abs((item.dispatched_qty||0) - (item.total_qty||0)) > 0.001
    );

    // If modified, require a note
    if (isModified && !note) {
      SSIApp.toast('📝 Please add a Dispatch Note explaining the partial dispatch.', 'warning');
      const lbl = document.getElementById('dispatch-note-label');
      if (lbl) { lbl.style.color = '#dc2626'; lbl.textContent = '📝 Dispatch Note — REQUIRED for partial dispatch'; }
      noteEl?.focus();
      return;
    }

    // Final confirmation popup
    const summary = dispatchedItems.map((it, idx) => {
      const prod = st.products.find(p=>p.id===it.product_id);
      const diff = (it.total_qty||0) - (it.dispatched_qty||0);
      return `• ${prod?.name||'—'}: ${SSIApp.qtyFmt(it.dispatched_qty||0)} of ${SSIApp.qtyFmt(it.total_qty||0)} KG${diff>0.001?` (short by ${SSIApp.qtyFmt(diff)})`:''}`;
    }).join('\n');

    const ok = await _safeConfirm(
      `🚚 Confirm Dispatch — ${o.order_no}\n\n` +
      summary + '\n\n' +
      `Total: ${SSIApp.qtyFmt(dispatchedQty)} KG / ${SSIApp.moneyFmt(dispatchedValue, o.currency||'INR')}\n` +
      (isModified ? `Status: DISPATCHED (Modified)\nNote: ${note}\n\n` : `Status: DISPATCHED (Full)\n\n`) +
      `This will:\n` +
      `• Reduce inventory (OUT entries)\n` +
      `• Lock the order — no further edits\n\nProceed?`
    );
    if (!ok) return;

    // Create OUT inventory transactions using DISPATCHED quantities
    if (!st.inventory) st.inventory = [];
    dispatchedItems.forEach(item => {
      if ((item.dispatched_qty||0) <= 0) return;
      const invEntry = {
        id: SSIApp.uid(),
        date: today,
        type: 'OUT',
        unit_id: o.unit_id,
        product_id: item.product_id,
        pack_mode: item.pack_mode,
        pack_desc: `Dispatch: ${o.order_no}`,
        qty: item.dispatched_qty,
        note: `Order ${o.order_no} dispatch${isModified?' (Modified)':''}${note?' — '+note:''}`,
        order_id: orderId,
        order_no: o.order_no,
        user_id: user?.id,
        user_name: user?.name,
        created_at: now,
        active: true,
        history: [{
          action: 'CREATED (dispatch)',
          detail: `Order ${o.order_no}`,
          ts: now,
          user: user?.username || 'unknown',
          user_name: user?.name || ''
        }]
      };
      st.inventory.push(invEntry);
    });

    // Update order — preserve original items, add dispatched data
    const idx = st.orders.findIndex(x=>x.id===orderId);
    if (idx>=0) {
      const ord = st.orders[idx];
      Object.assign(ord, {
        status:           'DISPATCHED',
        dispatched_at:    now,
        dispatched_by:    user?.id,
        dispatched_by_username: user?.username || '',
        dispatch_note:    note,
        dispatch_modified:   isModified,
        original_items:      isModified ? JSON.parse(JSON.stringify(o.items)) : null,
        original_qty:        isModified ? (o.total_qty||0) : null,
        original_value:      isModified ? (o.total_value||0) : null,
        dispatched_items:    isModified ? dispatchedItems : null,
        dispatched_qty:      isModified ? dispatchedQty : null,
        dispatched_value:    isModified ? dispatchedValue : null,
        updated_at: now
      });

      // Order timeline log (matches orders.js format)
      _addOrderHistory(ord,
        isModified ? 'DISPATCHED (Modified)' : 'DISPATCHED',
        isModified
          ? `${SSIApp.qtyFmt(dispatchedQty)} of ${SSIApp.qtyFmt(o.total_qty||0)} KG · ${SSIApp.moneyFmt(dispatchedValue,o.currency||'INR')} · Note: ${note}`
          : `${SSIApp.qtyFmt(dispatchedQty)} KG · ${SSIApp.moneyFmt(dispatchedValue,o.currency||'INR')}${note?' · Note: '+note:''}`
      );
    }

    await SSIApp.saveState(st);
    SSIApp.toast(
      isModified
        ? `Order ${o.order_no} dispatched (Modified: ${SSIApp.qtyFmt(dispatchedQty)} of ${SSIApp.qtyFmt(o.total_qty||0)} KG) ✅`
        : `Order ${o.order_no} dispatched successfully ✅`,
      'success'
    );
    SSIApp.audit('DISPATCH', `Order ${o.order_no} dispatched by ${user?.name||user?.username||'unknown'}${isModified?` — MODIFIED (${SSIApp.qtyFmt(dispatchedQty)}/${SSIApp.qtyFmt(o.total_qty||0)} KG, note: ${note})`:''}`);
    SSIApp.closeModal();
    refresh(document.getElementById('app-area') || document.getElementById('page-area'));
  }

  function showTab(tab) {
    const queuePanel   = document.getElementById('panel-queue');
    const histPanel    = document.getElementById('panel-history');
    const tabQueue     = document.getElementById('tab-queue');
    const tabHistory   = document.getElementById('tab-history');
    if (!queuePanel) return;

    if (tab === 'queue') {
      queuePanel.style.display = '';
      histPanel.style.display  = 'none';
      tabQueue.style.color = '#e11d2e'; tabQueue.style.borderBottomColor = '#e11d2e';
      tabHistory.style.color = '#64748b'; tabHistory.style.borderBottomColor = 'transparent';
    } else {
      queuePanel.style.display = 'none';
      histPanel.style.display  = '';
      tabHistory.style.color = '#e11d2e'; tabHistory.style.borderBottomColor = '#e11d2e';
      tabQueue.style.color = '#64748b'; tabQueue.style.borderBottomColor = 'transparent';
    }
  }

  function exportExcel() {
    const st   = SSIApp.getState();
    const rows = [['Order #','Date','Client','GST No','Unit','Ordered KG','Dispatched KG','Dispatched Value','Currency','Modified?','Status','Dispatched By','Dispatch Date','Dispatch Note']];
    (st.orders||[]).filter(o => ['DISPATCHED','CANCELLED'].includes(o.status)).forEach(o => {
      const client  = st.clients.find(c=>c.id===o.client_id);
      const unit    = st.units.find(u=>u.id===o.unit_id);
      const dispBy  = st.users.find(u=>u.id===o.dispatched_by);
      const dispQty = o.dispatch_modified ? (o.dispatched_qty||0) : (o.total_qty||0);
      const dispVal = o.dispatch_modified ? (o.dispatched_value||0) : (o.total_value||0);
      rows.push([
        o.order_no, o.date, client?.name||'', client?.gst_no||client?.gst||'', unit?.name||'',
        o.total_qty||0, dispQty, dispVal, o.currency||'INR',
        o.dispatch_modified ? 'YES' : 'NO', o.status,
        dispBy?.name||'', o.dispatched_at?.slice(0,10)||'', o.dispatch_note||''
      ]);
    });
    SSIApp.excelDownload(rows, 'Dispatch', 'SSI_Dispatch_History');
    SSIApp.toast('Dispatch history exported ✅');
  }

  /* ── Reverse dispatch (ADMIN only) — strong confirmation + timeline log ── */
  async function deleteDispatch(orderId) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only', 'error'); return; }

    const st    = SSIApp.getState();
    const order = (st.orders||[]).find(o => o.id === orderId);
    if (!order) {
      SSIApp.toast('Order not found', 'error');
      return;
    }
    if (order.status !== 'DISPATCHED') {
      SSIApp.toast('Only DISPATCHED orders can be reversed', 'warning');
      return;
    }

    const linkedInv = (st.inventory||[]).filter(e => e.order_id === orderId && e.type === 'OUT' && e.active !== false);
    const linkedInvCount = linkedInv.length;
    const linkedQty = linkedInv.reduce((s,e) => s + (e.qty||0), 0);

    const ok1 = await _safeConfirm(
      `↩️ Reverse dispatch for ${order.order_no}?\n\n` +
      `This will:\n` +
      `• Mark the order back to SUBMITTED (so it can be re-dispatched)\n` +
      `• REVERSE ${linkedInvCount} inventory OUT entries (${SSIApp.qtyFmt(linkedQty)} KG returned to stock)\n` +
      `• Reset dispatched_at, dispatched_by, dispatched note\n` +
      `• Log this action in the order timeline\n\n` +
      `Proceed to step 2 of 2?`
    );
    if (!ok1) return;

    const ok2 = await _safeConfirm(
      `🚨 FINAL CONFIRMATION\n\nDispatch for ${order.order_no} will be reversed and inventory restored.\n\nClick OK to confirm.`
    );
    if (!ok2) return;

    const now = new Date().toISOString();
    const actor = SSIApp.state.currentUser?.username || 'admin';

    // Soft-delete linked OUT inventory entries (instead of erasing)
    let reversedCount = 0;
    (st.inventory||[]).forEach(e => {
      if (e.order_id === orderId && e.type === 'OUT' && e.active !== false) {
        e.active     = false;
        e.deleted_at = now;
        e.deleted_by = actor;
        if (!e.history) e.history = [];
        e.history.push({
          action: 'DELETED (dispatch reversed)',
          detail: `Order ${order.order_no} dispatch reversed`,
          ts: now,
          user: actor,
          user_name: SSIApp.state.currentUser?.name || ''
        });
        reversedCount++;
      }
    });

    // Reset order back to SUBMITTED
    const dispatchedQtyBefore = order.dispatch_modified ? (order.dispatched_qty||0) : (order.total_qty||0);
    order.status              = 'SUBMITTED';
    order.dispatched_at        = null;
    order.dispatched_by        = null;
    order.dispatched_by_username = null;
    order.dispatch_note        = '';
    order.dispatch_modified    = false;
    order.original_items       = null;
    order.original_qty         = null;
    order.original_value       = null;
    order.dispatched_items     = null;
    order.dispatched_qty       = null;
    order.dispatched_value     = null;
    order.updated_at           = now;

    _addOrderHistory(order, 'DISPATCH REVERSED',
      `${reversedCount} inventory entries reversed (${SSIApp.qtyFmt(linkedQty)} KG returned). Previous dispatched qty: ${SSIApp.qtyFmt(dispatchedQtyBefore)} KG. By ${actor}.`
    );

    await SSIApp.saveState(st);
    SSIApp.audit('DISPATCH_REVERSE', `Order ${order.order_no} dispatch reversed by ${actor} — ${reversedCount} inventory entries soft-deleted (${SSIApp.qtyFmt(linkedQty)} KG returned to stock)`);
    SSIApp.toast(`↩️ ${order.order_no} dispatch reversed — ${SSIApp.qtyFmt(linkedQty)} KG returned to stock`, 'success');
    refresh(document.getElementById('app-area') || document.getElementById('page-area'));
  }

  return { render, refresh, openDispatchModal, confirmDispatch, updateDispatchTotal, showTab, deleteDispatch, exportExcel };
})();
