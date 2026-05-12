/* ============================================================
   SSI Attendance Module
   attendance.js
   Access: ADMIN (full edit), ACCOUNTANT (view + edit attendance)

   v2 — Stage 2:
   - 🗑️ Delete Month Attendance (ADMIN, 2-step confirm, soft delete)
   - 👁️ Show Deleted toggle
   - ♻️ Per-row Restore + Bulk Restore Month
   - Payroll safety warning (non-PAID payroll regenerate notice)
   ============================================================ */
const SSIAttendance = (() => {

  const STATUS_MAP = {
    P:  { label:'Present',   short:'P',  bg:'#dcfce7', color:'#166534' },
    A:  { label:'Absent',    short:'A',  bg:'#fee2e2', color:'#991b1b' },
    H:  { label:'Half Day',  short:'H',  bg:'#fef3c7', color:'#92400e' },
    L:  { label:'Leave',     short:'L',  bg:'#EDE9FE', color:'#6D28D9' },
    WO: { label:'Week Off',  short:'WO', bg:'#f3f4f6', color:'#6b7280' },
    HD: { label:'Holiday',   short:'HD', bg:'#f5f3ff', color:'#5b21b6' },
  };

  // Persistent UI state (survives navigation/refresh through render cycles)
  let _showDeleted = false;

  /* ── Helpers for active/deleted handling ─────────────────── */
  function _isActive(rec) {
    // Backward compatible: records without `active` field are treated as active
    return rec && rec.active !== false;
  }
  function _safeConfirm(msg) {
    return (typeof SSIApp.confirm === 'function')
      ? SSIApp.confirm(msg)
      : Promise.resolve(window.confirm(msg));
  }
  function _monthLabel(ym) {
    if (!ym) return '';
    const [y,m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m)-1]} ${y}`;
  }
  function _monthLabelUpper(ym) {
    if (!ym) return '';
    const [y,m] = ym.split('-');
    const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    return `${months[parseInt(m)-1]} ${y}`;
  }

  /* ── render ─────────────────────────────────────────────── */
  function render(area) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    refresh(area);
  }

  function refresh(area) {
    const st     = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const today  = new Date().toISOString().slice(0,10);
    const curYM  = today.slice(0,7);

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">🗓️ Attendance</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="SSIAttendance.downloadTemplate()">⬇️ Template</button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            📥 Import CSV/Excel
            <input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="SSIAttendance.importFile(this)">
          </label>
          <button class="btn btn-secondary btn-sm" onclick="SSIAttendance.exportExcel()">📤 Export</button>
          <button class="btn btn-primary" onclick="SSIAttendance.openBulkEntry()">+ Bulk Entry</button>
          ${isAdmin ? `<button class="btn btn-danger" onclick="SSIAttendance.openDeleteMonthModal()" style="background:#dc2626;">🗑️ Delete Month Attendance</button>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom:16px;padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;align-items:end;">
          <div>
            <label>Month</label>
            <input type="month" id="att-filter-month" value="${curYM}" onchange="SSIAttendance.applyFilter()">
          </div>
          <div>
            <label>Employee Type</label>
            <select id="att-filter-type" onchange="SSIAttendance.applyFilter()">
              <option value="">All Types</option>
              <option value="STAFF">👔 Staff</option>
              <option value="WORKER">👷 Worker</option>
            </select>
          </div>
          <div>
            <label>Unit</label>
            <select id="att-filter-unit" onchange="SSIAttendance.applyFilter()">
              <option value="">All Units</option>
              ${(st.units||[]).filter(u=>u.active).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Employee</label>
            <select id="att-filter-emp" onchange="SSIAttendance.applyFilter()">
              <option value="">All Employees</option>
              ${(st.employees||[]).filter(e=>e.active!==false).map(e=>`<option value="${e.id}">${e.name} (${e.emp_code})</option>`).join('')}
            </select>
          </div>
          ${isAdmin ? `
          <div style="display:flex;align-items:center;gap:6px;padding-bottom:6px;">
            <input type="checkbox" id="att-show-deleted" ${_showDeleted?'checked':''}
              onchange="SSIAttendance.toggleShowDeleted(this.checked)"
              style="cursor:pointer;width:16px;height:16px;">
            <label for="att-show-deleted" style="cursor:pointer;font-size:13px;color:#64748b;">Show Deleted</label>
          </div>` : ''}
        </div>
      </div>

      <!-- Summary Cards -->
      <div id="att-summary" style="margin-bottom:16px;"></div>

      <!-- Restore Month banner (visible only when deleted records exist for selected month) -->
      <div id="att-restore-banner" style="display:none;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:#92400e;"></div>

      <!-- Attendance Grid -->
      <div class="card" style="overflow-x:auto;">
        <div id="att-grid"></div>
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:12px;">
        ${Object.entries(STATUS_MAP).map(([k,v])=>`
          <span style="background:${v.bg};color:${v.color};padding:4px 10px;border-radius:20px;font-weight:600;">${v.short} — ${v.label}</span>
        `).join('')}
      </div>`;

    applyFilter();
  }

  function toggleShowDeleted(checked) {
    _showDeleted = !!checked;
    applyFilter();
  }

  function applyFilter() {
    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');
    const month   = document.getElementById('att-filter-month')?.value || new Date().toISOString().slice(0,7);
    const typeF   = document.getElementById('att-filter-type')?.value  || '';
    const unitF   = document.getElementById('att-filter-unit')?.value  || '';
    const empF    = document.getElementById('att-filter-emp')?.value   || '';

    let emps = (st.employees||[]).filter(e => e.active !== false);
    if (isAccountsOnly) emps = emps.filter(e => e.type === 'WORKER');
    if (typeF) emps = emps.filter(e => e.type === typeF);
    if (unitF) emps = emps.filter(e => e.unit_id === unitF);
    if (empF)  emps = emps.filter(e => e.id === empF);

    const [yr, mo]  = month.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const days = Array.from({length: daysInMonth}, (_,i) => {
      const d = String(i+1).padStart(2,'0');
      return `${yr}-${String(mo).padStart(2,'0')}-${d}`;
    });

    // Build quick-lookup honoring _showDeleted flag
    const allMonthRecs = (st.attendance||[]).filter(a => a.date && a.date.startsWith(month));
    const visibleRecs  = _showDeleted ? allMonthRecs : allMonthRecs.filter(_isActive);
    const deletedCount = allMonthRecs.filter(a => !_isActive(a)).length;

    const attMap  = {};
    visibleRecs.forEach(a => { attMap[`${a.emp_id}|${a.date}`] = a; });

    // Summary
    let totalP=0, totalA=0, totalH=0, totalL=0;
    emps.forEach(e => {
      days.forEach(d => {
        const rec = attMap[`${e.id}|${d}`];
        const s   = rec?.status || 'A';
        if (s==='P') totalP++;
        else if (s==='A') totalA++;
        else if (s==='H') totalH++;
        else if (s==='L') totalL++;
      });
    });

    const summaryEl = document.getElementById('att-summary');
    if (summaryEl) summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:0;">
        ${card('👥 Employees', emps.length, '#FDECEA','#922B21')}
        ${card('✅ Present Days', totalP, '#dcfce7','#166534')}
        ${card('❌ Absent Days', totalA, '#fee2e2','#991b1b')}
        ${card('½ Half Days', totalH, '#fef3c7','#92400e')}
        ${card('🌿 Leaves', totalL, '#e0e7ff','#3730a3')}
      </div>`;

    // Restore Month banner (only admin, only when month has deleted records)
    const banner = document.getElementById('att-restore-banner');
    if (banner) {
      if (isAdmin && deletedCount > 0) {
        banner.style.display = 'block';
        banner.innerHTML = `
          ⚠️ <strong>${deletedCount}</strong> attendance record(s) for ${_monthLabel(month)} are marked as deleted.
          ${_showDeleted ? '' : '<em>(Hidden — enable "Show Deleted" to view)</em>'}
          <button onclick="SSIAttendance.restoreMonth('${month}')"
            style="margin-left:12px;background:#16a34a;color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;">
            ♻️ Restore Month
          </button>`;
      } else {
        banner.style.display = 'none';
      }
    }

    const gridEl = document.getElementById('att-grid');
    if (!gridEl) return;
    if (!emps.length) { gridEl.innerHTML = `<p style="text-align:center;padding:40px;color:#94a3b8;">No employees found for selected filters.</p>`; return; }

    // Build table — columns = days
    const dayHeaders = days.map(d => {
      const dt = new Date(d + 'T00:00:00');
      const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'][dt.getDay()];
      const isSun = dt.getDay() === 0;
      return `<th style="min-width:38px;text-align:center;font-size:11px;${isSun?'color:#fff;':''}">${d.slice(8)}<br><span style="font-weight:400;">${dow}</span></th>`;
    }).join('');

    const rows = emps.map(e => {
      const cells = days.map(d => {
        const rec = attMap[`${e.id}|${d}`];
        const s   = rec?.status || '';
        const sm  = s ? STATUS_MAP[s] : null;
        const isDeleted = rec && !_isActive(rec);
        const ot  = rec?.ot_hours ? `<sup style="font-size:9px;color:#f59e0b">+${rec.ot_hours}h</sup>` : '';
        const deletedStyle = isDeleted ? 'opacity:.45;text-decoration:line-through;' : '';
        const restoreBtn = (isDeleted && SSIApp.hasRole('ADMIN'))
          ? `<button onclick="event.stopPropagation();SSIAttendance.restoreRecord('${rec.id}')"
                title="Restore this record"
                style="position:absolute;top:-4px;right:-4px;background:#16a34a;color:#fff;border:none;width:14px;height:14px;border-radius:50%;font-size:9px;cursor:pointer;line-height:1;padding:0;">♻</button>` : '';
        return `<td style="text-align:center;padding:3px 2px;">
          <span ${isDeleted?'':'onclick="SSIAttendance.quickEdit(\''+e.id+'\',\''+d+'\',\''+(s||'A')+'\')"'}
            title="${sm?.label||'Not Marked'} ${rec?.ot_hours?'| OT:'+rec.ot_hours+'h':''}${isDeleted?' (DELETED)':''}"
            style="position:relative;display:inline-block;min-width:28px;padding:3px 2px;border-radius:6px;font-size:11px;font-weight:700;${isDeleted?'':'cursor:pointer;'}
              background:${sm?.bg||'#f3f4f6'};color:${sm?.color||'#9ca3af'};${deletedStyle}">
            ${sm?.short||'—'}${ot}${restoreBtn}
          </span>
        </td>`;
      }).join('');

      const unit = (st.units||[]).find(u=>u.id===e.unit_id);
      return `<tr>
        <td style="white-space:nowrap;padding:4px 8px;position:sticky;left:0;background:#fff;z-index:1;border-right:2px solid #e2e8f0;">
          <div style="font-weight:600;font-size:13px;">${e.name}</div>
          <div style="font-size:11px;color:#64748b;">${e.emp_code} · <span style="background:${e.type==='STAFF'?'#FDECEA':'#dcfce7'};color:${e.type==='STAFF'?'#922B21':'#166534'};padding:1px 5px;border-radius:8px;">${e.type}</span></div>
        </td>
        ${cells}
        <td style="text-align:center;padding:4px 8px;white-space:nowrap;font-size:12px;background:#f8fafc;">
          ${_calcMonthSummary(e.id, days, attMap, e.type)}
        </td>
      </tr>`;
    }).join('');

    gridEl.innerHTML = `
      <table id="attendance-table" style="border-collapse:collapse;font-size:13px;width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;min-width:160px;">Employee</th>
            ${dayHeaders}
            <th style="min-width:90px;text-align:center;">Summary</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function card(label, val, bg, color) {
    return `<div style="background:${bg};padding:14px 16px;border-radius:10px;">
      <div style="font-size:22px;font-weight:800;color:${color};">${val}</div>
      <div style="font-size:12px;color:${color};opacity:.8;">${label}</div>
    </div>`;
  }

  function _calcMonthSummary(empId, days, attMap, type) {
    let p=0,a=0,h=0,l=0,wo=0,ot=0;
    days.forEach(d => {
      const rec = attMap[`${empId}|${d}`];
      const s = rec?.status||'A';
      if (s==='P')  p++;
      else if (s==='A') a++;
      else if (s==='H') h++;
      else if (s==='L') l++;
      else if (s==='WO'||s==='HD') wo++;
      if (rec?.ot_hours) ot += Number(rec.ot_hours)||0;
    });
    const paidL = type==='STAFF' ? Math.min(l,2) : 0;
    const eff   = p + (h*0.5) + paidL;
    return `<span style="color:#166534;font-weight:600;">P:${p}</span> <span style="color:#991b1b;">A:${a}</span> <span style="color:#92400e;">H:${h}</span> <span style="color:#3730a3;">L:${l}</span>${ot>0?` <span style="color:#f59e0b;">OT:${ot}h</span>`:''}`;
  }

  /* ── Quick-edit single cell ──────────────────────────────── */
  function quickEdit(empId, date, currentStatus) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT')) return;
    const statuses = Object.entries(STATUS_MAP);
    const html = `
      <div id="att-qe-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1010;">
        <div style="background:#fff;border-radius:.75rem;padding:1.25rem;min-width:280px;box-shadow:0 20px 50px rgba(0,0,0,.3);">
          <div style="font-weight:700;margin-bottom:12px;">Mark Attendance — ${date}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${statuses.map(([k,v])=>`
              <button onclick="SSIAttendance._setStatus('${empId}','${date}','${k}')"
                style="padding:8px;border-radius:8px;border:2px solid ${currentStatus===k?v.color:'#e2e8f0'};
                  background:${v.bg};color:${v.color};font-weight:700;cursor:pointer;font-size:13px;">
                ${v.short} — ${v.label}
              </button>`).join('')}
          </div>
          <div id="att-ot-row" style="margin-top:10px;${currentStatus==='P'||currentStatus==='H'?'':'display:none;'}">
            <label style="font-size:13px;">OT Hours (Workers only)</label>
            <input type="number" id="att-ot-input" min="0" max="24" step="0.5" placeholder="0"
              style="width:100%;margin-top:4px;"
              value="${_getOT(empId, date)}">
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('att-qe-overlay').remove()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="SSIAttendance._saveQuickEdit('${empId}','${date}')">Save</button>
          </div>
        </div>
      </div>`;
    document.getElementById('att-qe-overlay')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function _getOT(empId, date) {
    const st  = SSIApp.getState();
    const rec = (st.attendance||[]).find(a=>a.emp_id===empId&&a.date===date && _isActive(a));
    return rec?.ot_hours || 0;
  }

  function _setStatus(empId, date, status) {
    document.querySelectorAll('#att-qe-overlay button[onclick*="_setStatus"]').forEach(b=>{
      b.style.borderWidth = '2px';
      b.style.borderColor = '#e2e8f0';
    });
    const clicked = [...document.querySelectorAll('#att-qe-overlay button')].find(b=>b.textContent.includes(STATUS_MAP[status]?.label));
    if (clicked) clicked.style.borderColor = STATUS_MAP[status]?.color||'#000';
    document.getElementById('att-qe-overlay').setAttribute('data-status', status);
    const otRow = document.getElementById('att-ot-row');
    if (otRow) otRow.style.display = (status==='P'||status==='H') ? '' : 'none';
  }

  async function _saveQuickEdit(empId, date) {
    const overlay = document.getElementById('att-qe-overlay');
    const status  = overlay?.getAttribute('data-status');
    if (!status) { SSIApp.toast('Select a status first'); return; }
    const otHours = parseFloat(document.getElementById('att-ot-input')?.value) || 0;

    const st  = SSIApp.getState();
    if (!st.attendance) st.attendance = [];

    const idx = st.attendance.findIndex(a=>a.emp_id===empId&&a.date===date && _isActive(a));
    const entry = {
      id:         idx>=0 ? st.attendance[idx].id : SSIApp.uid(),
      emp_id:     empId,
      date,
      status,
      ot_hours:   (status==='P'||status==='H') ? otHours : 0,
      active:     true,
      user_id:    SSIApp.state.currentUser?.id||'',
      created_at: idx>=0 ? st.attendance[idx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (idx>=0) st.attendance[idx] = entry;
    else        st.attendance.push(entry);

    await SSIApp.saveState(st);
    overlay?.remove();
    applyFilter();
  }

  /* ── Bulk Entry (mark all employees for a date) ──────────── */
  function _buildBulkRows(date) {
    const st   = SSIApp.getState();
    const emps = (st.employees||[]).filter(e=>e.active!==false);
    return emps.map(e => {
      const rec = (st.attendance||[]).find(a=>a.emp_id===e.id && a.date===date && _isActive(a));
      const s   = rec?.status || 'P';
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 8px;">
          <div style="font-weight:600;font-size:13px;color:#111827;">${e.name}</div>
          <div style="font-size:11px;color:#64748b;">${e.emp_code} · ${e.type}</div>
        </td>
        <td style="padding:10px 8px;">
          <select id="bulk-s-${e.id}" style="width:140px;padding:6px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:13px;">
            ${Object.entries(STATUS_MAP).map(([k,v])=>`<option value="${k}" ${s===k?'selected':''}>${v.short} — ${v.label}</option>`).join('')}
          </select>
        </td>
        <td style="padding:10px 8px;">
          <input type="number" id="bulk-ot-${e.id}"
            min="0" max="24" step="0.5"
            value="${rec?.ot_hours||''}"
            placeholder="0"
            title="Overtime hours (extra hours worked beyond normal shift)"
            style="width:72px;padding:6px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:13px;text-align:center;">
        </td>
      </tr>`;
    }).join('');
  }

  function openBulkEntry() {
    const today = new Date().toISOString().slice(0,10);

    SSIApp.modal(`
      <div style="padding:24px;">
        <h3 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#111827;">📋 Bulk Attendance Entry</h3>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px 16px;background:#f8fafc;border-radius:10px;">
          <label style="font-weight:600;font-size:13px;color:#374151;">📅 Date:</label>
          <input type="date" id="bulk-date" value="${today}"
            onchange="document.getElementById('bulk-tbody').innerHTML=SSIAttendance._buildBulkRows(this.value)"
            style="padding:7px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;">
          <span style="font-size:12px;color:#94a3b8;margin-left:4px;">(changing date reloads existing attendance)</span>
        </div>

        <div style="overflow-y:auto;max-height:52vh;border:1px solid #e2e8f0;border-radius:10px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#C0392B;position:sticky;top:0;z-index:2;">
                <th style="padding:10px 8px;text-align:left;color:#fff;font-weight:600;">Employee</th>
                <th style="padding:10px 8px;color:#fff;font-weight:600;">Status</th>
                <th style="padding:10px 8px;color:#fff;font-weight:600;" title="Overtime hours worked beyond normal shift">OT Hrs <span style="font-size:10px;opacity:0.8;">(optional)</span></th>
              </tr>
            </thead>
            <tbody id="bulk-tbody">
              ${_buildBulkRows(today)}
            </tbody>
          </table>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="bulk-save-btn" onclick="SSIAttendance.saveBulk()">💾 Save All</button>
        </div>
      </div>`);
  }

  async function saveBulk() {
    const date = document.getElementById('bulk-date')?.value;
    if (!date) { SSIApp.toast('❌ Please select a date'); return; }

    const saveBtn = document.getElementById('bulk-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving…'; }

    const st = SSIApp.getState();
    if (!st.attendance) st.attendance = [];

    const emps = (st.employees||[]).filter(e=>e.active!==false);

    let saved = 0;
    emps.forEach(emp => {
      const empId  = emp.id;
      const selEl  = document.getElementById(`bulk-s-${empId}`);
      const otEl   = document.getElementById(`bulk-ot-${empId}`);
      if (!selEl) return;

      const status  = selEl.value || 'P';
      const otHours = parseFloat(otEl?.value) || 0;
      const idx     = st.attendance.findIndex(a=>a.emp_id===empId&&a.date===date && _isActive(a));
      const entry   = {
        id:         idx>=0 ? st.attendance[idx].id : SSIApp.uid(),
        emp_id:     empId,
        date,
        status,
        ot_hours:   (status==='P'||status==='H') ? otHours : 0,
        active:     true,
        user_id:    SSIApp.state.currentUser?.id||'',
        created_at: idx>=0 ? st.attendance[idx].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (idx>=0) st.attendance[idx] = entry;
      else        st.attendance.push(entry);
      saved++;
    });

    await SSIApp.saveState(st);
    SSIApp.toast(`✅ Attendance saved for ${saved} employees on ${date}`, 'success');
    SSIApp.closeModal();
    applyFilter();
  }

  /* ── Template ─────────────────────────────────────────────── */
  function downloadTemplate() {
    const rows = [
      ['emp_code','date','status','ot_hours'],
      ['EMP-001','2024-03-01','P','0'],
      ['EMP-001','2024-03-02','P','2'],
      ['EMP-002','2024-03-01','A','0'],
      ['EMP-002','2024-03-02','H','0'],
    ];
    SSIApp.excelDownload(rows, 'Attendance_Template', 'SSI_Attendance_Import_Template');
    SSIApp.toast('Template downloaded. Status codes: P=Present, A=Absent, H=Half Day, L=Leave, WO=Week Off, HD=Holiday');
  }

  /* ── Import ──────────────────────────────────────────────── */
  async function importFile(input) {
    if (!input.files.length) return;
    const file = input.files[0];
    try {
      let rows = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        rows = text.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
      } else {
        if (typeof XLSX === 'undefined') { SSIApp.toast('Excel library not loaded!'); return; }
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows     = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      }
      if (rows.length < 2) { SSIApp.toast('No data rows'); return; }

      const header  = rows[0].map(h=>String(h).toLowerCase().trim());
      const iCode   = header.indexOf('emp_code');
      const iDate   = header.indexOf('date');
      const iStatus = header.indexOf('status');
      const iOT     = header.indexOf('ot_hours');

      if (iCode<0 || iDate<0 || iStatus<0) {
        SSIApp.toast('Columns required: emp_code, date, status'); return;
      }

      const st = SSIApp.getState();
      if (!st.attendance) st.attendance = [];
      let added=0, skipped=0;

      for (let i=1; i<rows.length; i++) {
        const r      = rows[i];
        const code   = String(r[iCode]||'').trim();
        const date   = String(r[iDate]||'').trim();
        const status = String(r[iStatus]||'').toUpperCase().trim();
        if (!code || !date || !status) { skipped++; continue; }
        if (!STATUS_MAP[status]) { skipped++; continue; }

        const emp = (st.employees||[]).find(e=>e.emp_code===code);
        if (!emp) { skipped++; continue; }

        const otHours = iOT>=0 ? parseFloat(r[iOT])||0 : 0;
        const idx = st.attendance.findIndex(a=>a.emp_id===emp.id&&a.date===date && _isActive(a));
        const entry = {
          id:         idx>=0 ? st.attendance[idx].id : SSIApp.uid(),
          emp_id:     emp.id,
          date,
          status,
          ot_hours:   (status==='P'||status==='H') ? otHours : 0,
          active:     true,
          user_id:    SSIApp.state.currentUser?.id||'',
          created_at: idx>=0 ? st.attendance[idx].created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (idx>=0) st.attendance[idx] = entry;
        else        st.attendance.push(entry);
        added++;
      }
      await SSIApp.saveState(st);
      SSIApp.toast(`✅ Import done — ${added} records saved, ${skipped} skipped`);
      applyFilter();
    } catch(err) {
      SSIApp.toast(`Import failed: ${err.message}`);
    }
    input.value = '';
  }

  /* ── Export ──────────────────────────────────────────────── */
  function exportExcel() {
    const st    = SSIApp.getState();
    const month = document.getElementById('att-filter-month')?.value || new Date().toISOString().slice(0,7);
    const rows  = [['Employee Code','Name','Type','Unit','Date','Status','Status Label','OT Hours','Active']];
    (st.attendance||[]).filter(a=>a.date&&a.date.startsWith(month)).forEach(a => {
      const emp  = (st.employees||[]).find(e=>e.id===a.emp_id);
      const unit = (st.units||[]).find(u=>u.id===emp?.unit_id);
      rows.push([
        emp?.emp_code||'', emp?.name||'', emp?.type||'', unit?.name||'',
        a.date, a.status, STATUS_MAP[a.status]?.label||a.status, a.ot_hours||0,
        _isActive(a) ? 'YES' : 'NO (DELETED)'
      ]);
    });
    SSIApp.excelDownload(rows, 'Attendance', `SSI_Attendance_${month}`);
  }


  /* ── Delete single attendance record (ADMIN only, soft) ──── */
  async function deleteRecord(recId) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st  = SSIApp.getState();
    const rec = (st.attendance||[]).find(a=>a.id===recId);
    if (!rec) return;
    const emp = (st.employees||[]).find(e=>e.id===rec.emp_id);
    const ok  = await _safeConfirm(`Delete attendance record for ${emp?.name||'this employee'} on ${rec.date}?\n\nThis can be restored later via "Show Deleted" toggle.`);
    if (!ok) return;
    rec.active     = false;
    rec.deleted_at = new Date().toISOString();
    rec.deleted_by = SSIApp.state.currentUser?.username || 'unknown';
    rec.deleted_reason = 'single delete';
    await SSIApp.saveState(st);
    SSIApp.audit('ATTENDANCE_SOFT_DELETE', `Soft-deleted attendance: ${rec.emp_id} ${rec.date}`);
    SSIApp.toast('🗑️ Attendance record marked deleted (recoverable)');
    applyFilter();
  }

  /* ── Restore single record (ADMIN) ───────────────────────── */
  async function restoreRecord(recId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st  = SSIApp.getState();
    const rec = (st.attendance||[]).find(a=>a.id===recId);
    if (!rec) return;
    rec.active = true;
    rec.restored_at = new Date().toISOString();
    rec.restored_by = SSIApp.state.currentUser?.username || 'unknown';
    delete rec.deleted_at;
    delete rec.deleted_by;
    delete rec.deleted_reason;
    await SSIApp.saveState(st);
    SSIApp.audit('ATTENDANCE_RESTORE', `Restored attendance: ${rec.emp_id} ${rec.date}`);
    SSIApp.toast('♻️ Attendance record restored');
    applyFilter();
  }

  /* ── Delete Month Attendance (the big new feature) ───────── */
  function openDeleteMonthModal() {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st = SSIApp.getState();
    const curMonth = document.getElementById('att-filter-month')?.value
                 || new Date().toISOString().slice(0,7);

    // Build available months from existing attendance
    const monthSet = new Set();
    (st.attendance||[]).forEach(a => { if (a.date) monthSet.add(a.date.slice(0,7)); });
    const months = Array.from(monthSet).sort().reverse();
    if (!months.length) {
      SSIApp.toast('⚠️ No attendance data found in any month.');
      return;
    }

    const monthOptions = months.map(m =>
      `<option value="${m}" ${m===curMonth?'selected':''}>${_monthLabel(m)}</option>`
    ).join('');

    SSIApp.modal(`
      <div style="padding:8px;">
        <h3 style="margin:0 0 12px 0;color:#dc2626;font-size:18px;">🗑️ Delete Month Attendance</h3>
        <p style="font-size:13px;color:#475569;margin-bottom:14px;">
          Select a month — all attendance records for that month will be marked as deleted.
          Records remain recoverable via <em>Show Deleted</em> + Restore.
        </p>

        <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="font-size:13px;font-weight:600;color:#374151;">Month to delete</label>
            <select id="del-month-select"
              onchange="SSIAttendance._updateDeleteMonthPreview()"
              style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;margin-top:4px;">
              ${monthOptions}
            </select>
          </div>
        </div>

        <div id="del-month-preview" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px;font-size:13px;color:#92400e;margin-bottom:14px;"></div>

        <div style="background:#fee2e2;border:1px solid #dc2626;border-radius:10px;padding:12px;font-size:12px;color:#991b1b;margin-bottom:14px;">
          <b>⚠️ Important:</b> This is a destructive action.
          Records will be marked as deleted (recoverable for 90 days via Show Deleted toggle).
          A fresh backup is recommended before proceeding.
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-danger" id="del-month-next-btn"
            onclick="SSIAttendance._proceedToFinalConfirm()"
            style="background:#dc2626;">Next: Confirm →</button>
        </div>
      </div>
    `);

    // Initial preview
    setTimeout(_updateDeleteMonthPreview, 50);
  }

  function _updateDeleteMonthPreview() {
    const st = SSIApp.getState();
    const month = document.getElementById('del-month-select')?.value;
    const preview = document.getElementById('del-month-preview');
    if (!month || !preview) return;

    const monthRecs = (st.attendance||[]).filter(a => a.date && a.date.startsWith(month) && _isActive(a));
    let p=0,a=0,h=0,l=0,wo=0;
    monthRecs.forEach(r => {
      if (r.status==='P') p++;
      else if (r.status==='A') a++;
      else if (r.status==='H') h++;
      else if (r.status==='L') l++;
      else if (r.status==='WO' || r.status==='HD') wo++;
    });
    const empSet = new Set(monthRecs.map(r => r.emp_id));

    // Payroll safety check
    const payroll = (st.payroll||[]).filter(p => p.period === month);
    const paidPayroll  = payroll.filter(p => p.status === 'PAID');
    const draftPayroll = payroll.filter(p => p.status !== 'PAID');

    let payrollNote = '';
    if (paidPayroll.length > 0) {
      payrollNote = `<div style="background:#fee2e2;color:#991b1b;border:1px solid #dc2626;border-radius:8px;padding:10px;margin-top:10px;font-weight:600;">
        🚨 BLOCKED — ${paidPayroll.length} PAID payroll record(s) exist for ${_monthLabel(month)}.<br>
        Cannot delete attendance for a month that has been paid out.<br>
        Reverse the PAID status in Payroll first, then retry.
      </div>`;
    } else if (draftPayroll.length > 0) {
      payrollNote = `<div style="background:#fef3c7;color:#92400e;border-top:1px dashed #f59e0b;padding-top:10px;margin-top:10px;">
        ⚠️ <b>${draftPayroll.length} payroll record(s)</b> exist for ${_monthLabel(month)} (DRAFT/PROCESSED).<br>
        After deletion, you will need to regenerate payroll for accurate calculations.
      </div>`;
    }

    preview.innerHTML = `
      <b>📊 Preview — ${_monthLabel(month)}</b><br><br>
      • Employees affected: <b>${empSet.size}</b><br>
      • Total attendance records: <b>${monthRecs.length}</b><br>
      • Breakdown: P:${p} · A:${a} · H:${h} · L:${l} · WO/HD:${wo}<br>
      ${payrollNote}
    `;

    // Update Next button state if PAID payroll exists
    const nextBtn = document.getElementById('del-month-next-btn');
    if (nextBtn) {
      if (paidPayroll.length > 0) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.4';
        nextBtn.style.cursor = 'not-allowed';
        nextBtn.title = 'Blocked — PAID payroll exists';
      } else {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
        nextBtn.title = '';
      }
    }
  }

  function _proceedToFinalConfirm() {
    const month = document.getElementById('del-month-select')?.value;
    if (!month) return;
    const st = SSIApp.getState();
    const monthRecs = (st.attendance||[]).filter(a => a.date && a.date.startsWith(month) && _isActive(a));
    if (!monthRecs.length) {
      SSIApp.toast('No active records to delete for that month.');
      return;
    }
    const confirmText = `DELETE ${_monthLabelUpper(month)}`;

    SSIApp.modal(`
      <div style="padding:8px;">
        <h3 style="margin:0 0 12px 0;color:#dc2626;font-size:18px;">🚨 FINAL CONFIRMATION</h3>
        <p style="font-size:14px;color:#475569;margin-bottom:14px;">
          You are about to mark <b>${monthRecs.length}</b> attendance records for
          <b>${_monthLabel(month)}</b> as <b style="color:#dc2626;">DELETED</b>.
        </p>
        <p style="font-size:13px;color:#475569;margin-bottom:8px;">
          To proceed, type the text below exactly:
        </p>
        <div style="background:#fee2e2;color:#991b1b;border-radius:6px;padding:8px 12px;font-family:monospace;font-size:15px;font-weight:700;text-align:center;margin-bottom:10px;letter-spacing:1px;">
          ${confirmText}
        </div>
        <input id="del-month-confirm-input" type="text" placeholder="Type the text above"
          oninput="SSIAttendance._checkFinalConfirm('${confirmText}')"
          style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:monospace;letter-spacing:1px;margin-bottom:14px;">
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-danger" id="del-month-final-btn"
            onclick="SSIAttendance._executeDeleteMonth('${month}')"
            disabled
            style="background:#dc2626;opacity:0.4;cursor:not-allowed;">🗑️ Delete Now</button>
        </div>
      </div>
    `);
    setTimeout(() => document.getElementById('del-month-confirm-input')?.focus(), 100);
  }

  function _checkFinalConfirm(expected) {
    const inp = document.getElementById('del-month-confirm-input');
    const btn = document.getElementById('del-month-final-btn');
    if (!inp || !btn) return;
    if (inp.value.trim() === expected) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    }
  }

  async function _executeDeleteMonth(month) {
    const btn = document.getElementById('del-month-final-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Deleting…'; }

    const st  = SSIApp.getState();
    const now = new Date().toISOString();
    const by  = SSIApp.state.currentUser?.username || 'unknown';
    let cnt = 0;
    (st.attendance||[]).forEach(a => {
      if (a.date && a.date.startsWith(month) && _isActive(a)) {
        a.active = false;
        a.deleted_at = now;
        a.deleted_by = by;
        a.deleted_reason = `bulk month delete (${month})`;
        cnt++;
      }
    });
    await SSIApp.saveState(st);
    SSIApp.audit('ATTENDANCE_BULK_DELETE_MONTH', `Soft-deleted ${cnt} attendance records for ${month}`);
    SSIApp.closeModal();
    SSIApp.toast(`🗑️ Marked ${cnt} records as deleted for ${_monthLabel(month)}. Recoverable via Show Deleted.`, 'success');
    // Set filter to that month so user sees the result
    const sel = document.getElementById('att-filter-month');
    if (sel) sel.value = month;
    applyFilter();
  }

  /* ── Restore Month (bulk) ─────────────────────────────────── */
  async function restoreMonth(month) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st = SSIApp.getState();
    const deletedRecs = (st.attendance||[]).filter(a => a.date && a.date.startsWith(month) && !_isActive(a));
    if (!deletedRecs.length) {
      SSIApp.toast('No deleted records to restore for that month.');
      return;
    }
    const ok = await _safeConfirm(
      `Restore all ${deletedRecs.length} deleted attendance records for ${_monthLabel(month)}?`
    );
    if (!ok) return;
    const now = new Date().toISOString();
    const by  = SSIApp.state.currentUser?.username || 'unknown';
    deletedRecs.forEach(r => {
      r.active = true;
      r.restored_at = now;
      r.restored_by = by;
      delete r.deleted_at;
      delete r.deleted_by;
      delete r.deleted_reason;
    });
    await SSIApp.saveState(st);
    SSIApp.audit('ATTENDANCE_BULK_RESTORE_MONTH', `Restored ${deletedRecs.length} attendance records for ${month}`);
    SSIApp.toast(`♻️ Restored ${deletedRecs.length} records for ${_monthLabel(month)}`, 'success');
    applyFilter();
  }

  return {
    render, refresh, applyFilter, toggleShowDeleted,
    openBulkEntry, saveBulk, _buildBulkRows,
    quickEdit, _setStatus, _saveQuickEdit,
    deleteRecord, restoreRecord, restoreMonth,
    openDeleteMonthModal, _updateDeleteMonthPreview, _proceedToFinalConfirm,
    _checkFinalConfirm, _executeDeleteMonth,
    downloadTemplate, importFile, exportExcel
  };
})();
