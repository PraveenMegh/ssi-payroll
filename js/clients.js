/* ============================================================
   SSI Clients / Vendors Module — v2 SAFE
   Stage 1 Batch 2: confirmation popups + soft delete
   ============================================================ */

const SSIClients = (() => {

  let _searchTerm = '';
  let _showInactive = false;

  // ── Visible clients helper (SALES sees only their assigned clients) ─────────
  function visibleClients(st, user) {
    let all = st.clients || [];
    if (!_showInactive) all = all.filter(c => c.active !== false);
    if (!user || user.role === 'ADMIN' || user.role === 'ACCOUNTS') return all;
    const uname  = (user.username || '').toLowerCase();
    const uname2 = (user.name     || '').toLowerCase();
    return all.filter(c => {
      const at = (c.assignedTo || '').toLowerCase();
      return at === uname || at === uname2;
    });
  }

  function render(area) {
    if (!SSIApp.hasRole('ADMIN', 'SALES', 'ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    _searchTerm   = '';
    _showInactive = false;
    refresh(area);
  }

  function refresh(area) {
    if (!area) area = document.getElementById('app-area') || document.getElementById('page-area');
    if (!area) return;
    const st   = SSIApp.getState();
    const user = SSIApp.state.currentUser;
    const isAdmin = SSIApp.hasRole('ADMIN');

    let clients = visibleClients(st, user);
    if (_searchTerm) {
      const q = _searchTerm.toLowerCase().trim();
      clients = clients.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.gst ||'').toLowerCase().includes(q) ||
        (c.tel ||'').toLowerCase().includes(q) ||
        (c.address||'').toLowerCase().includes(q)
      );
    }

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">👥 Clients / Vendors</h2>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="cli-search" type="text" placeholder="Search…"
            value="${_searchTerm}" oninput="SSIClients.search(this.value)"
            style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:.85rem;width:200px;">
          ${isAdmin ? `<label style="display:flex;align-items:center;gap:6px;font-size:.85rem;color:#64748b;">
              <input type="checkbox" id="cli-show-inactive" ${_showInactive?'checked':''} onchange="SSIClients.toggleShowInactive(this.checked)"/> Show inactive
            </label>` : ''}
          ${isAdmin ? `<button class="btn btn-primary" onclick="SSIClients.openForm()">+ Add Client</button>` : ''}
        </div>
      </div>

      <div class="card" style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;text-align:left;">
              <th style="padding:10px;">Name</th>
              <th style="padding:10px;">GST</th>
              <th style="padding:10px;">Phone</th>
              <th style="padding:10px;">Type</th>
              <th style="padding:10px;">Assigned To</th>
              <th style="padding:10px;">Status</th>
              ${isAdmin ? '<th style="padding:10px;">Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>${renderRows(clients, isAdmin)}</tbody>
        </table>
        <div style="padding:10px;color:#64748b;font-size:.8rem;">Showing ${clients.length} clients</div>
      </div>
    `;
  }

  function renderRows(clients, isAdmin) {
    if (!clients.length) return `<tr><td colspan="${isAdmin?7:6}" style="text-align:center;padding:40px;color:#94a3b8;">No clients found.</td></tr>`;
    return clients.map(c => {
      const isActive = c.active !== false;
      const statusBadge = isActive
        ? `<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:999px;font-size:.7rem;font-weight:700;">Active</span>`
        : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-size:.7rem;font-weight:700;">Inactive</span>`;
      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px;font-weight:600;">${c.name||''}</td>
          <td style="padding:10px;color:#64748b;">${c.gst||''}</td>
          <td style="padding:10px;color:#64748b;">${c.tel||''}</td>
          <td style="padding:10px;">${c.type||'Client'}</td>
          <td style="padding:10px;color:#64748b;">${c.assignedTo||'—'}</td>
          <td style="padding:10px;">${statusBadge}</td>
          ${isAdmin ? `
            <td style="padding:10px;">
              <button class="btn btn-sm" onclick="SSIClients.openForm('${c.id}')">✏️ Edit</button>
              ${isActive
                ? `<button class="btn btn-sm btn-danger" onclick="SSIClients.softDelete('${c.id}')">🗑️ Delete</button>`
                : `<button class="btn btn-sm" onclick="SSIClients.restore('${c.id}')">♻️ Restore</button>`}
            </td>` : ''}
        </tr>`;
    }).join('');
  }

  function search(v) {
    _searchTerm = v || '';
    refresh();
  }

  function toggleShowInactive(checked) {
    _showInactive = !!checked;
    refresh();
  }

  /* ── Form (add / edit) ────────────────────────────────── */
  function openForm(clientId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st = SSIApp.getState();
    const c  = clientId ? (st.clients || []).find(x => x.id === clientId) : null;
    const isEdit = !!c;
    const salesUsers = (st.users || []).filter(u => u.role === 'SALES' && u.active !== false);

    const modal = document.createElement('div');
    modal.id = 'client-modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div class="card" style="width:520px;max-width:95%;background:#fff;padding:20px;border-radius:8px;max-height:90vh;overflow-y:auto;">
        <h3 style="margin:0 0 16px;">${isEdit?'Edit Client':'Add Client'}</h3>
        <div id="cli-err" style="display:none;background:#fee2e2;color:#991b1b;padding:8px;border-radius:6px;margin-bottom:12px;font-size:.85rem;"></div>

        <label style="display:block;margin-bottom:10px;">Name *<br>
          <input id="cli-name" type="text" value="${c?.name||''}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:10px;">GST Number<br>
          <input id="cli-gst" type="text" value="${c?.gst||''}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:10px;">Phone<br>
          <input id="cli-tel" type="text" value="${c?.tel||''}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:10px;">Address<br>
          <textarea id="cli-address" rows="2" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;">${c?.address||''}</textarea></label>
        <label style="display:block;margin-bottom:10px;">City<br>
          <input id="cli-city" type="text" value="${c?.city||''}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:10px;">Email<br>
          <input id="cli-email" type="text" value="${c?.email||''}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:10px;">Type<br>
          <select id="cli-type" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;">
            <option value="Client" ${(c?.type||'Client')==='Client'?'selected':''}>Client</option>
            <option value="Vendor" ${c?.type==='Vendor'?'selected':''}>Vendor</option>
          </select></label>
        <label style="display:block;margin-bottom:14px;">Assigned To (Sales)<br>
          <select id="cli-assigned" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;">
            <option value="">— None —</option>
            ${salesUsers.map(u => `<option value="${u.name}" ${c?.assignedTo===u.name?'selected':''}>${u.name}</option>`).join('')}
          </select></label>

        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn" onclick="document.getElementById('client-modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="SSIClients.saveClient('${clientId||''}')">💾 Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function saveClient(clientId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const saveBtn = document.querySelector('#client-modal-overlay .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving…'; }

    const name      = (document.getElementById('cli-name')?.value || '').trim();
    const gst       = (document.getElementById('cli-gst')?.value  || '').trim();
    const tel       = (document.getElementById('cli-tel')?.value  || '').trim();
    const address   = (document.getElementById('cli-address')?.value || '').trim();
    const city      = (document.getElementById('cli-city')?.value || '').trim();
    const email     = (document.getElementById('cli-email')?.value || '').trim();
    const type      = document.getElementById('cli-type')?.value  || 'Client';
    const assignedTo= document.getElementById('cli-assigned')?.value || '';
    const errEl     = document.getElementById('cli-err');

    function showErr(msg) {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      const btn = document.querySelector('#client-modal-overlay .btn-primary');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Save'; }
    }

    if (!name) return showErr('Name is required.');

    const st = SSIApp.getState();
    const isEdit = !!clientId;
    const currentUser = SSIApp.state.currentUser;
    const nowIso = new Date().toISOString();

    if (isEdit) {
      const idx = (st.clients || []).findIndex(x => x.id === clientId);
      if (idx < 0) return showErr('Client not found.');
      st.clients[idx] = {
        ...st.clients[idx],
        name, gst, tel, address, city, email, type, assignedTo,
        updated_at: nowIso,
        updated_by: currentUser?.username || 'unknown',
        active: st.clients[idx].active !== false
      };
      await SSIApp.saveState(st);
      SSIApp.toast('✅ Client updated', 'success');
      SSIApp.audit('UPDATE_CLIENT', `Updated: ${name}`);
    } else {
      const newClient = {
        id: SSIApp.uid(),
        name, gst, tel, address, city, email, type, assignedTo,
        active: true,
        created_at: nowIso,
        created_by: currentUser?.username || 'unknown'
      };
      st.clients = [...(st.clients || []), newClient];
      await SSIApp.saveState(st);
      SSIApp.toast(`✅ Client "${name}" added`, 'success');
      SSIApp.audit('ADD_CLIENT', `Added: ${name}`);
    }
    document.getElementById('client-modal-overlay')?.remove();
    refresh();
  }

  /* ── Soft delete ─────────────────────────────────────── */
  async function softDelete(clientId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st = SSIApp.getState();
    const c  = (st.clients || []).find(x => x.id === clientId);
    if (!c) return;

    const ok = await SSIApp.confirm(
      `⚠️ Confirm Delete Client\n\nClient: "${c.name}"\nGST: ${c.gst || '—'}\n\nThe client will be marked INACTIVE and hidden from active lists.\n` +
      `Past orders and history will be preserved.\n\nProceed?`
    );
    if (!ok) return;

    c.active     = false;
    c.deleted_at = new Date().toISOString();
    c.deleted_by = SSIApp.state.currentUser?.username || 'unknown';
    await SSIApp.saveState(st);
    SSIApp.toast('🗑️ Client marked inactive');
    SSIApp.audit('CLIENT_SOFT_DELETE', `Soft-deleted client: ${c.name}`);
    refresh();
  }

  /* ── Restore ─────────────────────────────────────────── */
  async function restore(clientId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st = SSIApp.getState();
    const c  = (st.clients || []).find(x => x.id === clientId);
    if (!c) return;

    c.active = true;
    c.restored_at = new Date().toISOString();
    c.restored_by = SSIApp.state.currentUser?.username || 'unknown';
    delete c.deleted_at;
    delete c.deleted_by;
    await SSIApp.saveState(st);
    SSIApp.toast('♻️ Client restored');
    SSIApp.audit('CLIENT_RESTORE', `Restored client: ${c.name}`);
    refresh();
  }

  return { render, refresh, search, toggleShowInactive, openForm, saveClient, softDelete, restore };

})();
