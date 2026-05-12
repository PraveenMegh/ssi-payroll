/* ============================================================
   SSI Inventory — Local Auto-Backup Module
   js/backup.js
   v1.0 — Stage 1 Batch 3

   Features:
   - 🛡️ Backup Now button (manual, downloads JSON to computer)
   - Daily startup reminder (admin only)
   - Tracks last backup date in Firestore
   - Restore from file (admin only, 2-step confirmation)

   Backup format: JSON
   Filename: ssi-backup-YYYY-MM-DD-HHMMSS.json
   Default location: Browser's Downloads folder
   ============================================================ */

const SSIBackup = (() => {

  /* ── Get the current full state for backup ──────────────── */
  function _buildBackupPayload() {
    const st = SSIApp.getState();
    // Exclude transient fields (currentUser, runtime UI flags)
    const { currentUser, ...rest } = st;
    return {
      _meta: {
        type:        'SSI_INVENTORY_BACKUP',
        version:     '1.0',
        created_at:  new Date().toISOString(),
        created_by:  currentUser?.username || 'unknown',
        app_url:     window.location.origin,
        record_counts: {
          clients:    (rest.clients||[]).length,
          products:   (rest.products||[]).length,
          employees:  (rest.employees||[]).length,
          inventory:  (rest.inventory||[]).length,
          orders:     (rest.orders||[]).length,
          attendance: (rest.attendance||[]).length,
          payroll:    (rest.payroll||[]).length,
          users:      (rest.users||[]).length,
        }
      },
      data: rest
    };
  }

  /* ── Generate filename ──────────────────────────────────── */
  function _filename() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth()+1).padStart(2,'0');
    const dd   = String(now.getDate()).padStart(2,'0');
    const hh   = String(now.getHours()).padStart(2,'0');
    const mi   = String(now.getMinutes()).padStart(2,'0');
    const ss   = String(now.getSeconds()).padStart(2,'0');
    return `ssi-backup-${yyyy}-${mm}-${dd}-${hh}${mi}${ss}.json`;
  }

  /* ── Trigger browser download ──────────────────────────── */
  function _downloadJSON(content, filename) {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ── Record backup in state (so we know last backup date) ── */
  async function _recordBackup(filename) {
    const st = SSIApp.getState();
    if (!st.backupHistory) st.backupHistory = [];
    st.backupHistory.push({
      filename,
      date:     new Date().toISOString().slice(0,10),
      timestamp: new Date().toISOString(),
      by:       SSIApp.state.currentUser?.username || 'unknown',
      record_counts: {
        clients:    (st.clients||[]).length,
        products:   (st.products||[]).length,
        employees:  (st.employees||[]).length,
        inventory:  (st.inventory||[]).length,
        orders:     (st.orders||[]).length,
        attendance: (st.attendance||[]).length,
        payroll:    (st.payroll||[]).length,
      }
    });
    // Keep only last 90 entries (we don't need to track forever)
    if (st.backupHistory.length > 90) {
      st.backupHistory = st.backupHistory.slice(-90);
    }
    st.lastBackup = new Date().toISOString();
    await SSIApp.saveState(st);
  }

  /* ── Manual "Backup Now" — main entry point ────────────── */
  async function backupNow() {
    if (!SSIApp.hasRole('ADMIN')) {
      SSIApp.toast('🔒 Only Admin can create backups', 'warning');
      return false;
    }
    try {
      SSIApp.toast('📦 Preparing backup...', 'info');
      const payload  = _buildBackupPayload();
      const filename = _filename();
      _downloadJSON(payload, filename);
      await _recordBackup(filename);
      SSIApp.toast(`✅ Backup saved: ${filename}`, 'success');
      SSIApp.audit('BACKUP_CREATED', `Created backup: ${filename}`);
      _refreshBackupCard();
      return true;
    } catch (err) {
      console.error('[SSI Backup] Failed:', err);
      SSIApp.toast(`❌ Backup failed: ${err.message}`, 'error');
      return false;
    }
  }

  /* ── Check if backup is needed today (admin login) ─────── */
  function checkDailyReminder() {
    if (!SSIApp.hasRole('ADMIN')) return; // only admin sees reminder
    const st = SSIApp.getState();
    const today = new Date().toISOString().slice(0,10);
    const last  = (st.lastBackup || '').slice(0,10);
    if (last === today) return; // already done today

    // Build a friendly message
    const lastMsg = last
      ? `Last backup was on ${_formatDate(last)} (${_daysSince(last)} day(s) ago)`
      : 'No previous backup found';

    // Use a non-blocking modal so user can dismiss easily
    setTimeout(() => {
      if (typeof SSIApp.modal !== 'function') return;
      SSIApp.modal(`
        <h3 style="margin-bottom:14px;color:#92400e;">⚠️ Daily Backup Reminder</h3>
        <p style="font-size:14px;color:#475569;margin-bottom:14px;">
          You haven't created a backup today.<br>
          ${lastMsg}
        </p>
        <div style="background:#fef3c7;border-radius:8px;padding:12px;font-size:13px;color:#92400e;margin-bottom:16px;">
          💡 <b>Tip:</b> Backing up takes only 2 seconds. A JSON file 
          will be saved to your computer's Downloads folder. Move it 
          weekly to a safe folder like <code>Documents/SSI-Backups/</code>.
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Skip for today</button>
          <button class="btn btn-primary" onclick="SSIBackup.backupNow().then(()=>SSIApp.closeModal())">
            🛡️ Backup Now
          </button>
        </div>
      `);
    }, 2500); // wait 2.5s after login so the dashboard renders first
  }

  /* ── Restore from file (admin only, 2-step confirm) ────── */
  async function restoreFromFile() {
    if (!SSIApp.hasRole('ADMIN')) {
      SSIApp.toast('🔒 Only Admin can restore backups', 'warning');
      return;
    }
    const ok1 = await SSIApp.confirm(
      `⚠️ Restore Backup\n\nThis will REPLACE all current data with the contents of a backup file. ` +
      `Your current data will be overwritten.\n\nIt is STRONGLY recommended to first create a fresh ` +
      `backup of your current data (Backup Now) before restoring.\n\nProceed to select a backup file?`
    );
    if (!ok1) return;

    // Create hidden file input
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // Validate file structure
        if (!parsed._meta || parsed._meta.type !== 'SSI_INVENTORY_BACKUP') {
          SSIApp.toast('❌ Invalid backup file (wrong format)', 'error');
          return;
        }
        if (!parsed.data) {
          SSIApp.toast('❌ Invalid backup file (no data)', 'error');
          return;
        }

        const meta = parsed._meta;
        const counts = meta.record_counts || {};
        const summary =
          `📂 Backup file: ${file.name}\n` +
          `Created: ${_formatDateTime(meta.created_at)}\n` +
          `By: ${meta.created_by || 'unknown'}\n\n` +
          `Records in this backup:\n` +
          `  • Clients:    ${counts.clients||0}\n` +
          `  • Products:   ${counts.products||0}\n` +
          `  • Employees:  ${counts.employees||0}\n` +
          `  • Inventory:  ${counts.inventory||0}\n` +
          `  • Orders:     ${counts.orders||0}\n` +
          `  • Attendance: ${counts.attendance||0}\n` +
          `  • Payroll:    ${counts.payroll||0}\n\n` +
          `Type "RESTORE BACKUP" to confirm.`;

        const userInput = window.prompt(summary, '');
        if (userInput !== 'RESTORE BACKUP') {
          SSIApp.toast('Restore cancelled', 'info');
          return;
        }

        // Final replace
        const newState = parsed.data;
        // Preserve the current logged-in user so we don't log them out
        newState.currentUser = SSIApp.state.currentUser;
        Object.assign(SSIApp.state, newState);
        await SSIApp.saveState(SSIApp.state);
        SSIApp.audit('BACKUP_RESTORED', `Restored from: ${file.name} (created ${meta.created_at})`);
        SSIApp.toast('✅ Backup restored. The app will reload.', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        console.error('[SSI Backup] Restore failed:', err);
        SSIApp.toast(`❌ Restore failed: ${err.message}`, 'error');
      }
    };

    input.click();
  }

  /* ── Render the Backup card (called from Dashboard) ────── */
  function renderCard(targetId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const el = document.getElementById(targetId || 'backup-card');
    if (!el) return;

    const st = SSIApp.getState();
    const last = (st.lastBackup || '').slice(0,10);
    const today = new Date().toISOString().slice(0,10);
    const isToday = last === today;
    const daysAgo = last ? _daysSince(last) : null;

    let statusHtml;
    if (isToday) {
      statusHtml = `<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">✓ Up to date</span>`;
    } else if (daysAgo !== null && daysAgo <= 1) {
      statusHtml = `<span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">⚠ ${daysAgo} day ago</span>`;
    } else if (daysAgo !== null) {
      statusHtml = `<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">🚨 ${daysAgo} days ago</span>`;
    } else {
      statusHtml = `<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">🚨 Never backed up</span>`;
    }

    el.innerHTML = `
      <div class="card" style="padding:18px;margin-bottom:16px;border-left:4px solid #8B1A1A;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0 0 6px 0;color:#8B1A1A;font-size:17px;">🛡️ Data Backup</h3>
            <div style="font-size:13px;color:#475569;">
              Last backup: <b>${last ? _formatDate(last) : '—'}</b>
              ${statusHtml}
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:6px;">
              Backups save as JSON to your Downloads folder.<br>
              Move them weekly to <code>Documents/SSI-Backups/</code> for safety.
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="SSIBackup.backupNow()">🛡️ Backup Now</button>
            <button class="btn btn-secondary" onclick="SSIBackup.restoreFromFile()">📂 Restore from File</button>
            <button class="btn btn-secondary btn-sm" onclick="SSIBackup.showHistory()">📋 History</button>
          </div>
        </div>
      </div>
    `;
  }

  function _refreshBackupCard() {
    if (document.getElementById('backup-card')) renderCard('backup-card');
  }

  /* ── Show backup history modal ─────────────────────────── */
  function showHistory() {
    const st = SSIApp.getState();
    const hist = st.backupHistory || [];
    if (!hist.length) {
      SSIApp.toast('No backup history yet. Click "Backup Now" to create your first backup.', 'info');
      return;
    }
    const rows = hist.slice().reverse().slice(0, 30).map(h => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${_formatDateTime(h.timestamp)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${h.filename}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${h.by}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;color:#64748b;">
          C:${h.record_counts?.clients||0} •
          P:${h.record_counts?.products||0} •
          E:${h.record_counts?.employees||0} •
          O:${h.record_counts?.orders||0}
        </td>
      </tr>
    `).join('');
    SSIApp.modal(`
      <h3 style="margin-bottom:14px;">📋 Backup History (last 30)</h3>
      <div style="max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#8B1A1A;color:#fff;">
              <th style="padding:8px;text-align:left;">When</th>
              <th style="padding:8px;text-align:left;">Filename</th>
              <th style="padding:8px;text-align:left;">By</th>
              <th style="padding:8px;text-align:right;">Counts</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Close</button>
      </div>
    `);
  }

  /* ── Date helpers ──────────────────────────────────────── */
  function _formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2,'0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
  }
  function _formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-IN', {dateStyle:'medium', timeStyle:'short'});
  }
  function _daysSince(yyyymmdd) {
    if (!yyyymmdd) return null;
    const past = new Date(yyyymmdd + 'T00:00:00');
    const now  = new Date();
    const ms   = now - past;
    return Math.max(0, Math.floor(ms / 86400000));
  }

  /* ── Init ──────────────────────────────────────────────── */
  function init() {
    console.log('[SSI Backup] Module loaded v1.0');
    // Reminder runs only for admin, only once per session, only if not done today
    if (SSIApp.state && SSIApp.state.currentUser) {
      checkDailyReminder();
    }
  }

  return {
    init,
    backupNow,
    restoreFromFile,
    checkDailyReminder,
    renderCard,
    showHistory
  };
})();

// Auto-init when SSIApp is ready
if (typeof SSIApp !== 'undefined' && SSIApp.state && SSIApp.state.currentUser) {
  SSIBackup.init();
}
