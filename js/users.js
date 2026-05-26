// ============================================================
//  SSI Inventory — User Management Module (v2 SAFE)
//  users.js  |  ADMIN access only
//  Stage 1 Batch 2: confirmation popups + soft delete
// ============================================================

const SSIUsers = (() => {

  const ROLES = ['ADMIN', 'STOCK', 'DISPATCH', 'SALES', 'ACCOUNTANT', 'ACCOUNTS'];

  const ROLE_COLORS = {
    ADMIN:      { bg:'#fef3c7', color:'#92400e' },
    STOCK:      { bg:'#FDECEA', color:'#8B1A1A' },
    DISPATCH:   { bg:'#d1fae5', color:'#065f46' },
    SALES:      { bg:'#ede9fe', color:'#5b21b6' },
    ACCOUNTANT: { bg:'#fce7f3', color:'#9d174d' },
    ACCOUNTS:   { bg:'#fef9c3', color:'#854d0e' },
  };

  function roleBadge(role) {
    const c = ROLE_COLORS[role] || { bg:'#f1f5f9', color:'#475569' };
    return `<span style="background:${c.bg};color:${c.color};padding:2px 10px;border-radius:999px;font-size:.7rem;font-weight:700;">${role}</span>`;
  }

  /* ── Render main users page ────────────────────────────── */
  function render(area) {
    if (!SSIApp.hasRole('ADMIN')) {
      area.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔒</div>
          <p style="color:#64748b;">Only Administrators can manage users.</p>
        </div>`;
      return;
    }
    refresh(area);
  }

  function refresh(area) {
    if (!area) area = document.getElementById('app-area') || document.getElementById('page-area');
    if (!area) return;

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">👤 User Management</h2>
        <div style="display:flex;gap:8px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:.85rem;color:#64748b;">
            <input type="checkbox" id="usr-show-inactive" onchange="SSIUsers.refresh()"/> Show inactive
          </label>
          <button class="btn btn-primary" onclick="SSIUsers.openForm()">+ Add User</button>
        </div>
      </div>

      <div class="card" style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;text-align:left;">
              <th style="padding:10px;">Name</th>
              <th style="padding:10px;">Username</th>
              <th style="padding:10px;">Role</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px;">Actions</th>
            </tr>
          </thead>
          <tbody id="users-tbody">${renderRows()}</tbody>
        </table>
      </div>
    `;
  }

  function renderRows() {
    const st = SSIApp.getState();
    const showInactive = document.getElementById('usr-show-inactive')?.checked;
    let users = st.users || [];
    if (!showInactive) users = users.filter(u => u.active !== false);
    if (!users.length) return `<tr><td colspan="5" style="text-align:center;padding:40px;color:#94a3b8;">No users found.</td></tr>`;

    const currentUser = SSIApp.state.currentUser;

    return users.map((u) => {
      const isActive = u.active !== false;
      const isSelf   = currentUser && currentUser.username === u.username;
      const statusBadge = isActive
        ? `<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:999px;font-size:.7rem;font-weight:700;">Active</span>`
        : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-size:.7rem;font-weight:700;">Inactive</span>`;
      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px;">${u.name||''}</td>
          <td style="padding:10px;color:#64748b;">${u.username||''}</td>
          <td style="padding:10px;">${roleBadge(u.role)}</td>
          <td style="padding:10px;">${statusBadge}</td>
          <td style="padding:10px;">
            <button class="btn btn-sm" onclick="SSIUsers.openForm('${u.id}')">✏️ Edit</button>
            <button class="btn btn-sm" onclick="SSIUsers.toggleActive('${u.id}')">${isActive?'🚫 Disable':'🟢 Enable'}</button>
            ${isSelf ? '' : `<button class="btn btn-sm btn-danger" onclick="SSIUsers.softDelete('${u.id}')">🗑️ Delete</button>`}
          </td>
        </tr>`;
    }).join('');
  }

  /* ── Form (add / edit) ────────────────────────────────── */
  function openForm(userId) {
    const st = SSIApp.getState();
    const user = userId ? (st.users || []).find(u => u.id === userId) : null;
    const isEdit = !!user;

    const modal = document.createElement('div');
    modal.id = 'user-modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div class="card" style="width:420px;max-width:95%;background:#fff;padding:20px;border-radius:8px;">
        <h3 style="margin:0 0 16px;">${isEdit?'Edit User':'Add User'}</h3>
        <div id="usr-err" style="display:none;background:#fee2e2;color:#991b1b;padding:8px;border-radius:6px;margin-bottom:12px;font-size:.85rem;"></div>
        <label style="display:block;margin-bottom:12px;">Full Name<br>
          <input id="usr-name" type="text" value="${user?.name||''}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:12px;">Username<br>
          <input id="usr-username" type="text" value="${user?.username||''}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;" ${isEdit?'readonly':''}></label>
        <label style="display:block;margin-bottom:12px;">Password ${isEdit?'(leave blank to keep)':''}<br>
          <input id="usr-password" type="text" value="" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:12px;">Role<br>
          <select id="usr-role" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;">
            ${ROLES.map(r => `<option value="${r}" ${(user?.role || 'SALES') === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select></label>
        <label style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">
          <input id="usr-active" type="checkbox" ${user?.active !== false ? 'checked' : ''}/> Active
        </label>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn" onclick="document.getElementById('user-modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="SSIUsers.saveUser('${userId||''}')">💾 Save User</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  /* ── Save user (create or update) ────────────────────── */
  async function saveUser(userId) {
    const saveBtn = document.querySelector('#user-modal-overlay .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving…'; }

    const name     = (document.getElementById('usr-name')?.value     || '').trim();
    const username = (document.getElementById('usr-username')?.value || '').trim().toLowerCase();
    const password = (document.getElementById('usr-password')?.value || '').trim();
    const role     = document.getElementById('usr-role')?.value || 'SALES';
    const active   = document.getElementById('usr-active')?.checked !== false;
    const errEl    = document.getElementById('usr-err');

    function showErr(msg) {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      const btn = document.querySelector('#user-modal-overlay .btn-primary');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Save User'; }
    }

    if (!name)     return showErr('Full Name is required.');
    if (!username) return showErr('Username is required.');
    if (!/^[a-z0-9_.@-]+$/.test(username)) return showErr('Username may only contain letters, numbers, underscore, hyphen, dot or @.');

    const st = SSIApp.getState();
    const users = st.users || [];
    const isEdit = !!userId;

    const dup = users.find(u => u.username === username && u.id !== userId);
    if (dup) return showErr(`Username "${username}" is already taken.`);

    if (!isEdit && !password) return showErr('Password is required for new users.');

    if (isEdit) {
      const user = users.find(u => u.id === userId);
      if (!user) return showErr('User not found.');
      user.name     = name;
      user.role     = role;
      user.active   = active;
      if (password) user.password = password;
      await SSIApp.saveState(st);
      SSIApp.toast('✅ User updated', 'success');
      SSIApp.audit('USER_EDIT', `Updated user: ${username} (${role})`);
    } else {
      const newUser = { id: SSIApp.uid(), name, username, password, role, active };
      st.users = [...users, newUser];
      await SSIApp.saveState(st);
      SSIApp.toast(`✅ User "${name}" created`, 'success');
      SSIApp.audit('USER_CREATE', `Created user: ${username} (${role})`);
    }

    document.getElementById('user-modal-overlay')?.remove();
    refresh();
  }

  /* ── Toggle active/inactive ───────────────────────────── */
  async function toggleActive(userId) {
    const currentUser = SSIApp.state.currentUser;
    const st = SSIApp.getState();
    const user = (st.users || []).find(u => u.id === userId);
    if (!user) return;

    if (currentUser && currentUser.username === user.username) {
      SSIApp.toast('⚠️ You cannot disable your own account', 'warning');
      return;
    }

    if (user.active !== false && user.role === 'ADMIN') {
      const adminCount = (st.users || []).filter(u => u.role === 'ADMIN' && u.active !== false).length;
      if (adminCount <= 1) {
        SSIApp.toast('⚠️ Cannot disable the only active Admin account', 'warning');
        return;
      }
    }

    user.active = user.active === false ? true : false;
    await SSIApp.saveState(st);
    const action = user.active ? '🟢 Enabled' : '🚫 Disabled';
    SSIApp.toast(`${action}: ${user.name}`);
    SSIApp.audit('USER_TOGGLE', `${action} user: ${user.username}`);
    refresh();
  }

  /* ── Soft delete user ────────────────────────────────── */
  async function softDelete(userId) {
    const currentUser = SSIApp.state.currentUser;
    const st = SSIApp.getState();
    const user = (st.users || []).find(u => u.id === userId);
    if (!user) return;

    if (currentUser && currentUser.username === user.username) {
      SSIApp.toast('⚠️ You cannot delete your own account', 'warning');
      return;
    }

    if (user.role === 'ADMIN') {
      const adminCount = (st.users || []).filter(u => u.role === 'ADMIN' && u.active !== false).length;
      if (adminCount <= 1) {
        SSIApp.toast('⚠️ Cannot delete the only active Admin account', 'warning');
        return;
      }
    }

    const ok = await SSIApp.confirm(
      `⚠️ Confirm Delete\n\nUser: "${user.name}" (${user.username})\nRole: ${user.role}\n\nThe user will be marked INACTIVE and hidden from the active list.\n` +
      `Their history will be preserved.\n\nProceed?`
    );
    if (!ok) return;

    user.active = false;
    user.deleted_at = new Date().toISOString();
    user.deleted_by = currentUser?.username || 'unknown';
    await SSIApp.saveState(st);
    SSIApp.toast('🗑️ User marked inactive');
    SSIApp.audit('USER_SOFT_DELETE', `Soft-deleted user: ${user.username} (${user.role})`);
    refresh();
  }

  return { render, refresh, openForm, saveUser, toggleActive, softDelete };

})();
