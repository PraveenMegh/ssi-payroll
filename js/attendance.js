/* ============================================================
   SSI Attendance Module — HOURLY BASIS  (v3)
   attendance.js
   Access: ADMIN (full edit), ACCOUNTANT / ACCOUNTS (view + edit)

   NEW in v3 — Hourly Attendance:
   ─────────────────────────────────
   ▸ Each record stores: check_in, check_out (HH:MM)
   ▸ worked_hours = check_out − check_in (computed, stored)
   ▸ Standard shift = 8 h (configurable per unit in future)
   ▸ Status auto-derived:
       worked_hours ≥ 8   → P  (Present, Full Day)
       worked_hours 4–7.9 → H  (Half Day)
       worked_hours 1–3.9 → H  (Half Day — short)
       worked_hours = 0   → A  (Absent — if no check-in)
       WO / HD / L        → manual override still available
   ▸ OT hours = max(0, worked_hours − 8)
   ▸ Grid shows worked hours in each cell  (e.g. "7.5h")
   ▸ Full-shift still manually markable (WO/HD/L/A) via quick-edit
   ▸ Summary shows: Total hours, Avg hrs/day, OT hours
   ▸ Payroll-compatible: exposes worked_hours & ot_hours
   ============================================================ */
const SSIAttendance = (() => {

  const SHIFT_HOURS = 8;        // Standard shift length in hours

  const STATUS_MAP = {
    P:  { label:'Present (Full)',  short:'P',  bg:'#dcfce7', color:'#166534' },
    H:  { label:'Half Day',        short:'H',  bg:'#fef3c7', color:'#92400e' },
    A:  { label:'Absent',          short:'A',  bg:'#fee2e2', color:'#991b1b' },
    L:  { label:'Leave',           short:'L',  bg:'#EDE9FE', color:'#6D28D9' },
    WO: { label:'Week Off',        short:'WO', bg:'#f3f4f6', color:'#6b7280' },
    HD: { label:'Holiday',         short:'HD', bg:'#f5f3ff', color:'#5b21b6' },
  };

  let _showDeleted = false;
  let _viewMode    = 'hours';   // 'hours' | 'status'

  /* ── Helpers ─────────────────────────────────────────────── */
  function _isActive(rec) { return rec && rec.active !== false; }

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

  /* ── Time helpers ─────────────────────────────────────────── */
  /** Parse "HH:MM" → decimal hours (e.g. "08:30" → 8.5) */
  function _toDecimalHours(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const parts = hhmm.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h + m / 60;
  }

  /** Decimal hours → "H:MM" display (e.g. 8.5 → "8:30") */
  function _fmtHours(decHours) {
    if (!decHours || decHours <= 0) return '—';
    const h = Math.floor(decHours);
    const m = Math.round((decHours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  /** Compute worked hours from check_in / check_out strings */
  function _calcWorkedHours(check_in, check_out) {
    const inH  = _toDecimalHours(check_in);
    const outH = _toDecimalHours(check_out);
    if (!inH || !outH || outH <= inH) return 0;
    // Handle overnight: if out < in, assume midnight cross (+24)
    const diff = outH >= inH ? outH - inH : outH + 24 - inH;
    return Math.round(diff * 100) / 100;  // 2 decimals
  }

  /** Auto-derive status from worked hours (if no manual override) */
  function _deriveStatus(workedHours, manualOverride) {
    // Manual statuses that aren't time-derived
    if (['WO','HD','L','A'].includes(manualOverride)) return manualOverride;
    if (workedHours <= 0) return 'A';
    if (workedHours >= SHIFT_HOURS) return 'P';
    return 'H';
  }

  /* ── Render ─────────────────────────────────────────────── */
  function render(area) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    refresh(area);
  }

  function refresh(area) {
    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const today   = new Date().toISOString().slice(0,10);
    const curYM   = today.slice(0,7);

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">🗓️ Attendance <span style="font-size:.75rem;font-weight:500;color:#C0392B;background:#FDECEA;padding:2px 10px;border-radius:20px;margin-left:8px;">⏱ Hourly Basis</span></h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="SSIAttendance.downloadTemplate()">⬇️ Template</button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            📥 Import CSV/Excel
            <input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="SSIAttendance.importFile(this)">
          </label>
          <button class="btn btn-secondary btn-sm" onclick="SSIAttendance.exportExcel()">📤 Export</button>
          <button class="btn btn-secondary btn-sm" onclick="SSIAttendance.toggleViewMode()"
            id="att-view-toggle" title="Switch between hours view and status view">
            ${_viewMode === 'hours' ? '🔤 Status View' : '⏱ Hours View'}
          </button>
          <button class="btn btn-primary" onclick="SSIAttendance.openBulkEntry()">+ Bulk Entry</button>
          ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="SSIAttendance.openDeleteMonthModal()">🗑️ Delete Month</button>` : ''}
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

      <!-- Restore banner -->
      <div id="att-restore-banner" style="display:none;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:#92400e;"></div>

      <!-- Attendance Grid -->
      <div class="card" style="overflow-x:auto;">
        <div id="att-grid"></div>
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:12px;align-items:center;">
        ${Object.entries(STATUS_MAP).map(([k,v])=>`
          <span style="background:${v.bg};color:${v.color};padding:4px 10px;border-radius:20px;font-weight:600;">${v.short} — ${v.label}</span>
        `).join('')}
        <span style="background:#f0fdf4;color:#166534;padding:4px 10px;border-radius:20px;font-weight:600;">⏱ = Worked Hours shown in cell</span>
        <span style="background:#fef9c3;color:#92400e;padding:4px 10px;border-radius:20px;font-weight:600;">OT = Hours beyond ${SHIFT_HOURS}h shift</span>
      </div>`;

    applyFilter();
  }

  function toggleViewMode() {
    _viewMode = _viewMode === 'hours' ? 'status' : 'hours';
    applyFilter();
    const btn = document.getElementById('att-view-toggle');
    if (btn) btn.textContent = _viewMode === 'hours' ? '🔤 Status View' : '⏱ Hours View';
  }

  function toggleShowDeleted(checked) {
    _showDeleted = !!checked;
    applyFilter();
  }

  function applyFilter() {
    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const month   = document.getElementById('att-filter-month')?.value || new Date().toISOString().slice(0,7);
    const typeF   = document.getElementById('att-filter-type')?.value  || '';
    const unitF   = document.getElementById('att-filter-unit')?.value  || '';
    const empF    = document.getElementById('att-filter-emp')?.value   || '';

    let emps = (st.employees||[]).filter(e => e.active !== false);
    if (SSIApp.hasRole('ACCOUNTS') && !SSIApp.hasRole('ADMIN')) emps = emps.filter(e => e.type === 'WORKER');
    if (typeF) emps = emps.filter(e => e.type === typeF);
    if (unitF) emps = emps.filter(e => e.unit_id === unitF);
    if (empF)  emps = emps.filter(e => e.id === empF);

    const [yr, mo]    = month.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const days = Array.from({length: daysInMonth}, (_,i) => {
      const d = String(i+1).padStart(2,'0');
      return `${yr}-${String(mo).padStart(2,'0')}-${d}`;
    });

    const allMonthRecs = (st.attendance||[]).filter(a => a.date && a.date.startsWith(month));
    const visibleRecs  = _showDeleted ? allMonthRecs : allMonthRecs.filter(_isActive);
    const deletedCount = allMonthRecs.filter(a => !_isActive(a)).length;

    const attMap = {};
    visibleRecs.forEach(a => { attMap[`${a.emp_id}|${a.date}`] = a; });

    // ── Summary ────────────────────────────────────────────────
    let totalP=0, totalA=0, totalH=0, totalL=0, totalWH=0, totalOT=0;
    emps.forEach(e => {
      days.forEach(d => {
        const rec = attMap[`${e.id}|${d}`];
        const s   = rec?.status || 'A';
        const wh  = Number(rec?.worked_hours) || 0;
        const ot  = Number(rec?.ot_hours)     || 0;
        if (s==='P')  totalP++;
        else if (s==='A') totalA++;
        else if (s==='H') totalH++;
        else if (s==='L') totalL++;
        totalWH += wh;
        totalOT += ot;
      });
    });

    const summaryEl = document.getElementById('att-summary');
    if (summaryEl) summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:0;">
        ${_card('👥 Employees',  emps.length,                           '#FDECEA','#922B21')}
        ${_card('✅ Full Days',  totalP,                                '#dcfce7','#166534')}
        ${_card('½ Half Days',   totalH,                                '#fef3c7','#92400e')}
        ${_card('❌ Absent',     totalA,                                '#fee2e2','#991b1b')}
        ${_card('⏱ Total Hrs',  _fmtHours(totalWH),                    '#e0f2fe','#0369a1')}
        ${_card('🌟 OT Hours',  _fmtHours(totalOT),                    '#fef9c3','#92400e')}
      </div>`;

    // ── Restore banner ─────────────────────────────────────────
    const banner = document.getElementById('att-restore-banner');
    if (banner) {
      if (isAdmin && deletedCount > 0) {
        banner.style.display = 'block';
        banner.innerHTML = `
          ⚠️ <strong>${deletedCount}</strong> attendance record(s) for ${_monthLabel(month)} are deleted.
          ${_showDeleted ? '' : '<em>(Hidden — enable "Show Deleted" to view)</em>'}
          <button onclick="SSIAttendance.restoreMonth('${month}')"
            style="margin-left:12px;background:#16a34a;color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;">
            ♻️ Restore Month
          </button>`;
      } else { banner.style.display = 'none'; }
    }

    // ── Grid ───────────────────────────────────────────────────
    const gridEl = document.getElementById('att-grid');
    if (!gridEl) return;
    if (!emps.length) {
      gridEl.innerHTML = `<p style="text-align:center;padding:40px;color:#94a3b8;">No employees found.</p>`;
      return;
    }

    const dayHeaders = days.map(d => {
      const dt  = new Date(d + 'T00:00:00');
      const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'][dt.getDay()];
      const isSun = dt.getDay() === 0;
      return `<th style="min-width:44px;text-align:center;font-size:11px;${isSun?'color:#ffcdd2;':''}">
        ${d.slice(8)}<br><span style="font-weight:400;font-size:10px;">${dow}</span>
      </th>`;
    }).join('');

    const rows = emps.map(e => {
      const cells = days.map(d => {
        const rec  = attMap[`${e.id}|${d}`];
        const s    = rec?.status || '';
        const sm   = s ? STATUS_MAP[s] : null;
        const wh   = Number(rec?.worked_hours) || 0;
        const ot   = Number(rec?.ot_hours)     || 0;
        const ci   = rec?.check_in  || '';
        const co   = rec?.check_out || '';
        const isDeleted   = rec && !_isActive(rec);
        const deletedStyle = isDeleted ? 'opacity:.4;text-decoration:line-through;' : '';

        let cellContent = '';
        if (_viewMode === 'hours') {
          // Show worked hours or status code
          if (wh > 0) {
            const h = Math.floor(wh);
            const m = Math.round((wh - h) * 60);
            const hLabel = m > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${h}h`;
            const otTag  = ot > 0 ? `<sup style="font-size:8px;color:#d97706;font-weight:700;">+${ot.toFixed(1)}</sup>` : '';
            cellContent  = `${hLabel}${otTag}`;
          } else {
            cellContent = sm?.short || '—';
          }
        } else {
          // Status view
          const otTag = ot > 0 ? `<sup style="font-size:9px;color:#f59e0b">+${ot}h</sup>` : '';
          cellContent = `${sm?.short||'—'}${otTag}`;
        }

        const tooltip = [
          sm?.label || 'Not Marked',
          ci ? `In: ${ci}` : '',
          co ? `Out: ${co}` : '',
          wh > 0 ? `Worked: ${_fmtHours(wh)}` : '',
          ot > 0 ? `OT: ${_fmtHours(ot)}` : '',
          isDeleted ? '(DELETED)' : ''
        ].filter(Boolean).join(' | ');

        const restoreBtn = (isDeleted && SSIApp.hasRole('ADMIN'))
          ? `<button onclick="event.stopPropagation();SSIAttendance.restoreRecord('${rec.id}')"
              title="Restore" style="position:absolute;top:-4px;right:-4px;background:#16a34a;color:#fff;
              border:none;width:14px;height:14px;border-radius:50%;font-size:9px;cursor:pointer;line-height:1;padding:0;">♻</button>`
          : '';

        return `<td style="text-align:center;padding:2px 1px;">
          <span ${isDeleted?'':'onclick="SSIAttendance.quickEdit(\''+e.id+'\',\''+d+'\',\''+s+'\')"'}
            title="${tooltip}"
            style="position:relative;display:inline-flex;align-items:center;justify-content:center;
              min-width:38px;height:26px;padding:1px 3px;border-radius:6px;font-size:11px;font-weight:700;
              ${isDeleted?'':'cursor:pointer;'}
              background:${sm?.bg||'#f3f4f6'};color:${sm?.color||'#9ca3af'};${deletedStyle}">
            ${cellContent}${restoreBtn}
          </span>
        </td>`;
      }).join('');

      const unit = (st.units||[]).find(u=>u.id===e.unit_id);
      return `<tr>
        <td style="white-space:nowrap;padding:4px 8px;position:sticky;left:0;background:#fff;z-index:1;border-right:2px solid #e2e8f0;min-width:170px;">
          <div style="font-weight:600;font-size:13px;">${e.name}</div>
          <div style="font-size:11px;color:#64748b;">${e.emp_code} · <span style="background:${e.type==='STAFF'?'#FDECEA':'#dcfce7'};color:${e.type==='STAFF'?'#922B21':'#166534'};padding:1px 5px;border-radius:8px;">${e.type}</span></div>
        </td>
        ${cells}
        <td style="text-align:center;padding:4px 8px;white-space:nowrap;font-size:12px;background:#f8fafc;min-width:120px;">
          ${_calcMonthSummary(e.id, days, attMap, e.type)}
        </td>
      </tr>`;
    }).join('');

    gridEl.innerHTML = `
      <table id="attendance-table" style="border-collapse:collapse;font-size:13px;width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;min-width:170px;">Employee</th>
            ${dayHeaders}
            <th style="min-width:120px;text-align:center;">Month Summary</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function _card(label, val, bg, color) {
    return `<div style="background:${bg};padding:14px 16px;border-radius:10px;">
      <div style="font-size:20px;font-weight:800;color:${color};">${val}</div>
      <div style="font-size:11px;color:${color};opacity:.8;margin-top:2px;">${label}</div>
    </div>`;
  }

  function _calcMonthSummary(empId, days, attMap, type) {
    let p=0, a=0, h=0, l=0, wo=0, totalWH=0, totalOT=0;
    days.forEach(d => {
      const rec = attMap[`${empId}|${d}`];
      const s   = rec?.status || 'A';
      const wh  = Number(rec?.worked_hours) || 0;
      const ot  = Number(rec?.ot_hours)     || 0;
      if      (s==='P')          p++;
      else if (s==='A')          a++;
      else if (s==='H')          h++;
      else if (s==='L')          l++;
      else if (s==='WO'||s==='HD') wo++;
      totalWH += wh;
      totalOT += ot;
    });
    const whDisplay = totalWH > 0 ? `<span style="color:#0369a1;font-size:11px;">⏱${_fmtHours(totalWH)}</span> ` : '';
    const otDisplay = totalOT > 0 ? `<span style="color:#d97706;font-size:11px;">OT:${_fmtHours(totalOT)}</span>` : '';
    return `<span style="color:#166534;font-weight:600;">P:${p}</span> <span style="color:#991b1b;">A:${a}</span> <span style="color:#92400e;">H:${h}</span> <span style="color:#3730a3;">L:${l}</span><br>${whDisplay}${otDisplay}`;
  }

  /* ══════════════════════════════════════════════════════════════
     QUICK EDIT — single cell pop-up (hourly input + status)
  ══════════════════════════════════════════════════════════════ */
  function quickEdit(empId, date, currentStatus) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT')) return;

    const st  = SSIApp.getState();
    const rec = (st.attendance||[]).find(a=>a.emp_id===empId&&a.date===date&&_isActive(a));
    const ci  = rec?.check_in  || '';
    const co  = rec?.check_out || '';
    const wh  = Number(rec?.worked_hours) || 0;
    const ot  = Number(rec?.ot_hours)     || 0;
    const emp = (st.employees||[]).find(e=>e.id===empId);

    document.getElementById('att-qe-overlay')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div id="att-qe-overlay"
        style="position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1010;"
        onclick="if(event.target.id==='att-qe-overlay')document.getElementById('att-qe-overlay').remove()">
        <div style="background:#fff;border-radius:.85rem;padding:0;min-width:360px;max-width:420px;width:92vw;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#8B1A1A,#C0392B);color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:700;font-size:.95rem;">${emp?.name||empId}</div>
              <div style="font-size:.75rem;opacity:.8;">${date} · ${emp?.emp_code||''}</div>
            </div>
            <button onclick="document.getElementById('att-qe-overlay').remove()"
              style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;">×</button>
          </div>

          <!-- Body -->
          <div style="padding:18px 20px;">

            <!-- Time inputs -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
              <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">🕐 Check-In</label>
                <input type="time" id="qe-check-in" value="${ci}"
                  oninput="SSIAttendance._recalcQE()"
                  style="width:100%;padding:8px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;font-weight:600;">
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">🕔 Check-Out</label>
                <input type="time" id="qe-check-out" value="${co}"
                  oninput="SSIAttendance._recalcQE()"
                  style="width:100%;padding:8px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;font-weight:600;">
              </div>
            </div>

            <!-- Computed display -->
            <div id="qe-computed" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#166534;">
              ${wh>0 ? `⏱ Worked: <strong>${_fmtHours(wh)}</strong> &nbsp;|&nbsp; OT: <strong>${_fmtHours(ot)}</strong>` : '⏱ Enter check-in and check-out times to auto-calculate hours'}
            </div>

            <!-- Manual status override (for WO/HD/L/A) -->
            <div style="margin-bottom:10px;">
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Manual Override (Leave / Week Off / Holiday)</label>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
                ${['WO','HD','L','A','P','H'].map(k=>{
                  const v = STATUS_MAP[k];
                  return `<button onclick="SSIAttendance._setQEStatus('${k}')"
                    id="qe-s-${k}"
                    style="padding:7px 4px;border-radius:8px;border:2px solid ${currentStatus===k?v.color:'#e2e8f0'};
                      background:${v.bg};color:${v.color};font-weight:700;cursor:pointer;font-size:12px;transition:border .15s;">
                    ${v.short}
                  </button>`;
                }).join('')}
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:5px;">P / H are auto-set from time — only override if needed</div>
            </div>

          </div>

          <!-- Footer -->
          <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid #f1f5f9;background:#f8fafc;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('att-qe-overlay').remove()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="SSIAttendance._saveQuickEdit('${empId}','${date}')">💾 Save</button>
          </div>

        </div>
      </div>`);

    // Highlight current status button
    _highlightQEStatus(currentStatus || '');
  }

  function _recalcQE() {
    const ci = document.getElementById('qe-check-in')?.value  || '';
    const co = document.getElementById('qe-check-out')?.value || '';
    const wh = _calcWorkedHours(ci, co);
    const ot = Math.max(0, Math.round((wh - SHIFT_HOURS) * 100) / 100);
    const computedEl = document.getElementById('qe-computed');
    if (computedEl) {
      if (wh > 0) {
        const autoStatus = _deriveStatus(wh, '');
        computedEl.style.background = wh >= SHIFT_HOURS ? '#f0fdf4' : '#fef9c3';
        computedEl.style.color      = wh >= SHIFT_HOURS ? '#166534' : '#92400e';
        computedEl.style.borderColor = wh >= SHIFT_HOURS ? '#bbf7d0' : '#fde68a';
        computedEl.innerHTML = `⏱ Worked: <strong>${_fmtHours(wh)}</strong> &nbsp;|&nbsp; OT: <strong>${ot > 0 ? _fmtHours(ot) : '—'}</strong> &nbsp;|&nbsp; Auto Status: <strong>${STATUS_MAP[autoStatus]?.label||autoStatus}</strong>`;
        // Auto-highlight the derived status
        _highlightQEStatus(autoStatus);
      } else if (ci && !co) {
        computedEl.style.background = '#fef3c7';
        computedEl.style.color = '#92400e';
        computedEl.style.borderColor = '#fde68a';
        computedEl.innerHTML = '⏱ Enter Check-Out time to calculate hours';
      } else {
        computedEl.style.background = '#f1f5f9';
        computedEl.style.color = '#64748b';
        computedEl.style.borderColor = '#e2e8f0';
        computedEl.innerHTML = '⏱ Enter check-in and check-out times';
      }
    }
    // Remove manual override data-status when times are entered (auto-derive)
    if (ci && co && wh > 0) {
      document.getElementById('att-qe-overlay')?.removeAttribute('data-manual-status');
    }
  }

  function _setQEStatus(status) {
    document.getElementById('att-qe-overlay')?.setAttribute('data-manual-status', status);
    _highlightQEStatus(status);
    // If setting WO/HD/L/A manually, clear time inputs
    if (['WO','HD','L','A'].includes(status)) {
      const computedEl = document.getElementById('qe-computed');
      if (computedEl) {
        computedEl.style.background = STATUS_MAP[status].bg;
        computedEl.style.color      = STATUS_MAP[status].color;
        computedEl.style.borderColor = STATUS_MAP[status].bg;
        computedEl.innerHTML = `📌 Manual override: <strong>${STATUS_MAP[status].label}</strong> (time fields will be ignored)`;
      }
    }
  }

  function _highlightQEStatus(status) {
    Object.keys(STATUS_MAP).forEach(k => {
      const btn = document.getElementById(`qe-s-${k}`);
      if (!btn) return;
      btn.style.borderColor = k === status ? STATUS_MAP[k].color : '#e2e8f0';
      btn.style.borderWidth = k === status ? '2.5px' : '2px';
    });
  }

  async function _saveQuickEdit(empId, date) {
    const overlay       = document.getElementById('att-qe-overlay');
    const manualStatus  = overlay?.getAttribute('data-manual-status') || '';
    const ci            = document.getElementById('qe-check-in')?.value  || '';
    const co            = document.getElementById('qe-check-out')?.value || '';

    let workedHours, otHours, status;

    if (manualStatus && ['WO','HD','L','A'].includes(manualStatus)) {
      // Full manual override — no hours
      status      = manualStatus;
      workedHours = 0;
      otHours     = 0;
    } else {
      // Time-based
      if (!ci && !co && !manualStatus) {
        SSIApp.toast('❌ Enter check-in/out times or select a status');
        return;
      }
      workedHours = _calcWorkedHours(ci, co);
      otHours     = Math.max(0, Math.round((workedHours - SHIFT_HOURS) * 100) / 100);
      status      = manualStatus || _deriveStatus(workedHours, '');
    }

    const st  = SSIApp.getState();
    if (!st.attendance) st.attendance = [];

    const idx = st.attendance.findIndex(a=>a.emp_id===empId&&a.date===date&&_isActive(a));
    const entry = {
      id:           idx>=0 ? st.attendance[idx].id : SSIApp.uid(),
      emp_id:       empId,
      date,
      status,
      check_in:     ci,
      check_out:    co,
      worked_hours: workedHours,
      ot_hours:     otHours,
      active:       true,
      user_id:      SSIApp.state.currentUser?.id || '',
      created_at:   idx>=0 ? st.attendance[idx].created_at : new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };

    if (idx>=0) st.attendance[idx] = entry;
    else        st.attendance.push(entry);

    await SSIApp.saveState(st);
    overlay?.remove();
    applyFilter();
    SSIApp.toast(`✅ Saved: ${STATUS_MAP[status]?.label||status}${workedHours>0?' · '+_fmtHours(workedHours):''}`, 'success');
  }

  /* ══════════════════════════════════════════════════════════════
     BULK ENTRY — hourly per employee per day
  ══════════════════════════════════════════════════════════════ */
  function _buildBulkRows(date) {
    const st   = SSIApp.getState();
    const emps = (st.employees||[]).filter(e=>e.active!==false);
    return emps.map(e => {
      const rec = (st.attendance||[]).find(a=>a.emp_id===e.id && a.date===date && _isActive(a));
      const s   = rec?.status || 'P';
      const ci  = rec?.check_in  || '';
      const co  = rec?.check_out || '';
      return `<tr style="border-bottom:1px solid #f1f5f9;" id="bulk-row-${e.id}">
        <td style="padding:8px 8px;">
          <div style="font-weight:600;font-size:13px;color:#111827;">${e.name}</div>
          <div style="font-size:11px;color:#64748b;">${e.emp_code} · ${e.type}</div>
        </td>
        <td style="padding:8px 8px;">
          <input type="time" id="bulk-ci-${e.id}" value="${ci}"
            oninput="SSIAttendance._recalcBulkRow('${e.id}')"
            style="width:104px;padding:5px 7px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:13px;">
        </td>
        <td style="padding:8px 8px;">
          <input type="time" id="bulk-co-${e.id}" value="${co}"
            oninput="SSIAttendance._recalcBulkRow('${e.id}')"
            style="width:104px;padding:5px 7px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:13px;">
        </td>
        <td style="padding:8px 8px;text-align:center;">
          <span id="bulk-wh-${e.id}" style="font-size:12px;font-weight:600;color:#0369a1;">
            ${rec?.worked_hours>0 ? _fmtHours(rec.worked_hours) : '—'}
          </span>
        </td>
        <td style="padding:8px 8px;">
          <select id="bulk-s-${e.id}" style="width:110px;padding:5px 6px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:12px;">
            ${Object.entries(STATUS_MAP).map(([k,v])=>`<option value="${k}" ${s===k?'selected':''}>${v.short} — ${v.label}</option>`).join('')}
          </select>
        </td>
      </tr>`;
    }).join('');
  }

  function _recalcBulkRow(empId) {
    const ci = document.getElementById(`bulk-ci-${empId}`)?.value || '';
    const co = document.getElementById(`bulk-co-${empId}`)?.value || '';
    const wh = _calcWorkedHours(ci, co);
    const whEl = document.getElementById(`bulk-wh-${empId}`);
    if (whEl) {
      if (wh > 0) {
        whEl.textContent = _fmtHours(wh);
        whEl.style.color = wh >= SHIFT_HOURS ? '#166534' : '#92400e';
        // Auto-set status
        const selEl = document.getElementById(`bulk-s-${empId}`);
        if (selEl) selEl.value = _deriveStatus(wh, '');
      } else {
        whEl.textContent = '—';
        whEl.style.color = '#94a3b8';
      }
    }
  }

  function openBulkEntry() {
    const today = new Date().toISOString().slice(0,10);
    SSIApp.modal(`
      <div style="padding:20px;">
        <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#111827;">📋 Bulk Attendance Entry <span style="font-size:12px;color:#C0392B;background:#FDECEA;padding:2px 8px;border-radius:12px;margin-left:6px;">⏱ Hourly</span></h3>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:10px;">
          <label style="font-weight:600;font-size:13px;color:#374151;">📅 Date:</label>
          <input type="date" id="bulk-date" value="${today}"
            onchange="document.getElementById('bulk-tbody').innerHTML=SSIAttendance._buildBulkRows(this.value)"
            style="padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;">
          <button onclick="SSIAttendance._applyDefaultShift()"
            style="background:#C0392B;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
            ⚡ Default Shift (9:00–17:00)
          </button>
        </div>

        <div style="overflow-y:auto;max-height:52vh;border:1px solid #e2e8f0;border-radius:10px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#C0392B;position:sticky;top:0;z-index:2;">
                <th style="padding:9px 8px;text-align:left;color:#fff;font-weight:600;">Employee</th>
                <th style="padding:9px 8px;color:#fff;font-weight:600;">Check-In</th>
                <th style="padding:9px 8px;color:#fff;font-weight:600;">Check-Out</th>
                <th style="padding:9px 8px;color:#fff;font-weight:600;text-align:center;">Worked Hrs</th>
                <th style="padding:9px 8px;color:#fff;font-weight:600;">Status</th>
              </tr>
            </thead>
            <tbody id="bulk-tbody">
              ${_buildBulkRows(today)}
            </tbody>
          </table>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="bulk-save-btn" onclick="SSIAttendance.saveBulk()">💾 Save All</button>
        </div>
      </div>`);
  }

  function _applyDefaultShift() {
    const st   = SSIApp.getState();
    const emps = (st.employees||[]).filter(e=>e.active!==false);
    emps.forEach(e => {
      const ciEl = document.getElementById(`bulk-ci-${e.id}`);
      const coEl = document.getElementById(`bulk-co-${e.id}`);
      const sEl  = document.getElementById(`bulk-s-${e.id}`);
      if (ciEl) ciEl.value = '09:00';
      if (coEl) coEl.value = '17:00';
      if (sEl)  sEl.value  = 'P';
      _recalcBulkRow(e.id);
    });
    SSIApp.toast('⚡ Default shift applied (9:00 AM – 5:00 PM, 8 hrs)');
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
      const ciEl   = document.getElementById(`bulk-ci-${empId}`);
      const coEl   = document.getElementById(`bulk-co-${empId}`);
      const selEl  = document.getElementById(`bulk-s-${empId}`);
      if (!selEl) return;

      const ci     = ciEl?.value || '';
      const co     = coEl?.value || '';
      const wh     = _calcWorkedHours(ci, co);
      const ot     = Math.max(0, Math.round((wh - SHIFT_HOURS) * 100) / 100);
      let   status = selEl.value || 'A';

      // If times were given, auto-derive status (unless WO/HD/L was manually chosen)
      if (wh > 0 && !['WO','HD','L'].includes(status)) {
        status = _deriveStatus(wh, '');
      }

      const idx = st.attendance.findIndex(a=>a.emp_id===empId&&a.date===date&&_isActive(a));
      const entry = {
        id:           idx>=0 ? st.attendance[idx].id : SSIApp.uid(),
        emp_id:       empId,
        date,
        status,
        check_in:     ci,
        check_out:    co,
        worked_hours: wh,
        ot_hours:     ['WO','HD','L','A'].includes(status) ? 0 : ot,
        active:       true,
        user_id:      SSIApp.state.currentUser?.id || '',
        created_at:   idx>=0 ? st.attendance[idx].created_at : new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      };
      if (idx>=0) st.attendance[idx] = entry;
      else        st.attendance.push(entry);
      saved++;
    });

    await SSIApp.saveState(st);
    SSIApp.toast(`✅ Hourly attendance saved for ${saved} employees on ${date}`, 'success');
    SSIApp.closeModal();
    applyFilter();
  }

  /* ── Template ────────────────────────────────────────────── */
  function downloadTemplate() {
    const rows = [
      ['emp_code','date','check_in','check_out','status'],
      ['EMP-001','2024-03-01','09:00','17:00','P'],
      ['EMP-001','2024-03-02','09:00','13:00','H'],
      ['EMP-002','2024-03-01','','','A'],
      ['EMP-002','2024-03-02','','','WO'],
      ['EMP-003','2024-03-01','09:00','19:30','P'],
    ];
    SSIApp.excelDownload(rows, 'Attendance_Template_Hourly', 'SSI_Attendance_Hourly_Template');
    SSIApp.toast('Template downloaded. Fill check_in/check_out as HH:MM (24-hr). Status auto-calculated from hours. Use WO/HD/L/A to override.');
  }

  /* ── Import ─────────────────────────────────────────────── */
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
      if (rows.length < 2) { SSIApp.toast('No data rows found.'); return; }

      const header  = rows[0].map(h=>String(h).toLowerCase().trim());
      const iCode   = header.indexOf('emp_code');
      const iDate   = header.indexOf('date');
      const iCI     = header.indexOf('check_in');
      const iCO     = header.indexOf('check_out');
      const iStatus = header.indexOf('status');

      if (iCode < 0 || iDate < 0) {
        SSIApp.toast('Required columns: emp_code, date. Optional: check_in, check_out, status'); return;
      }

      const st = SSIApp.getState();
      if (!st.attendance) st.attendance = [];
      let added=0, skipped=0;

      for (let i=1; i<rows.length; i++) {
        const r    = rows[i];
        const code = String(r[iCode]||'').trim();
        const date = String(r[iDate]||'').trim();
        if (!code || !date) { skipped++; continue; }

        const emp = (st.employees||[]).find(e=>e.emp_code===code);
        if (!emp) { skipped++; continue; }

        const ci     = iCI>=0     ? String(r[iCI]||'').trim()              : '';
        const co     = iCO>=0     ? String(r[iCO]||'').trim()              : '';
        const rawSt  = iStatus>=0 ? String(r[iStatus]||'').toUpperCase().trim() : '';
        const wh     = _calcWorkedHours(ci, co);
        const ot     = Math.max(0, Math.round((wh - SHIFT_HOURS) * 100) / 100);
        const status = rawSt && STATUS_MAP[rawSt]
          ? rawSt
          : _deriveStatus(wh, '');

        const idx   = st.attendance.findIndex(a=>a.emp_id===emp.id&&a.date===date&&_isActive(a));
        const entry = {
          id:           idx>=0 ? st.attendance[idx].id : SSIApp.uid(),
          emp_id:       emp.id,
          date,
          status,
          check_in:     ci,
          check_out:    co,
          worked_hours: wh,
          ot_hours:     ['WO','HD','L','A'].includes(status) ? 0 : ot,
          active:       true,
          user_id:      SSIApp.state.currentUser?.id||'',
          created_at:   idx>=0 ? st.attendance[idx].created_at : new Date().toISOString(),
          updated_at:   new Date().toISOString(),
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

  /* ── Export ─────────────────────────────────────────────── */
  function exportExcel() {
    const st    = SSIApp.getState();
    const month = document.getElementById('att-filter-month')?.value || new Date().toISOString().slice(0,7);
    const rows  = [['Employee Code','Name','Type','Unit','Date','Check-In','Check-Out','Worked Hours','OT Hours','Status','Status Label','Active']];
    (st.attendance||[]).filter(a=>a.date&&a.date.startsWith(month)).forEach(a => {
      const emp  = (st.employees||[]).find(e=>e.id===a.emp_id);
      const unit = (st.units||[]).find(u=>u.id===emp?.unit_id);
      rows.push([
        emp?.emp_code||'', emp?.name||'', emp?.type||'', unit?.name||'',
        a.date,
        a.check_in||'', a.check_out||'',
        a.worked_hours||0, a.ot_hours||0,
        a.status, STATUS_MAP[a.status]?.label||a.status,
        _isActive(a) ? 'YES' : 'NO (DELETED)'
      ]);
    });
    SSIApp.excelDownload(rows, 'Attendance_Hourly', `SSI_Attendance_${month}`);
  }

  /* ── Delete / Restore record ──────────────────────────────── */
  async function deleteRecord(recId) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st  = SSIApp.getState();
    const rec = (st.attendance||[]).find(a=>a.id===recId);
    if (!rec) return;
    const emp = (st.employees||[]).find(e=>e.id===rec.emp_id);
    const ok  = await _safeConfirm(`Delete attendance for ${emp?.name||'employee'} on ${rec.date}? (Recoverable)`);
    if (!ok) return;
    rec.active      = false;
    rec.deleted_at  = new Date().toISOString();
    rec.deleted_by  = SSIApp.state.currentUser?.username||'unknown';
    await SSIApp.saveState(st);
    SSIApp.toast('🗑️ Record deleted (recoverable)');
    applyFilter();
  }

  async function restoreRecord(recId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st  = SSIApp.getState();
    const rec = (st.attendance||[]).find(a=>a.id===recId);
    if (!rec) return;
    rec.active = true;
    rec.restored_at = new Date().toISOString();
    delete rec.deleted_at; delete rec.deleted_by;
    await SSIApp.saveState(st);
    SSIApp.toast('♻️ Record restored');
    applyFilter();
  }

  /* ── Delete Month ──────────────────────────────────────────── */
  function openDeleteMonthModal() {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st      = SSIApp.getState();
    const curMonth = document.getElementById('att-filter-month')?.value || new Date().toISOString().slice(0,7);
    const monthSet = new Set();
    (st.attendance||[]).forEach(a => { if (a.date) monthSet.add(a.date.slice(0,7)); });
    const months = Array.from(monthSet).sort().reverse();
    if (!months.length) { SSIApp.toast('No attendance data found.'); return; }

    const monthOptions = months.map(m =>
      `<option value="${m}" ${m===curMonth?'selected':''}>${_monthLabel(m)}</option>`
    ).join('');

    SSIApp.modal(`
      <div style="padding:8px;">
        <h3 style="margin:0 0 12px;color:#dc2626;font-size:18px;">🗑️ Delete Month Attendance</h3>
        <p style="font-size:13px;color:#475569;margin-bottom:14px;">
          All attendance records for the selected month will be soft-deleted (recoverable).
        </p>
        <div style="margin-bottom:14px;">
          <label style="font-size:13px;font-weight:600;">Month</label>
          <select id="del-month-select" onchange="SSIAttendance._updateDeleteMonthPreview()"
            style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;margin-top:4px;">
            ${monthOptions}
          </select>
        </div>
        <div id="del-month-preview" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px;font-size:13px;color:#92400e;margin-bottom:14px;"></div>
        <div style="background:#fee2e2;border:1px solid #dc2626;border-radius:10px;padding:12px;font-size:12px;color:#991b1b;margin-bottom:14px;">
          ⚠️ Records remain recoverable via <em>Show Deleted</em> toggle.
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-danger" id="del-month-next-btn" onclick="SSIAttendance._proceedToFinalConfirm()">Next →</button>
        </div>
      </div>`);
    setTimeout(_updateDeleteMonthPreview, 50);
  }

  function _updateDeleteMonthPreview() {
    const st      = SSIApp.getState();
    const month   = document.getElementById('del-month-select')?.value;
    const preview = document.getElementById('del-month-preview');
    if (!month || !preview) return;
    const monthRecs = (st.attendance||[]).filter(a=>a.date&&a.date.startsWith(month)&&_isActive(a));
    let p=0,a=0,h=0,l=0,wo=0,totalWH=0;
    monthRecs.forEach(r=>{
      if      (r.status==='P')           p++;
      else if (r.status==='A')           a++;
      else if (r.status==='H')           h++;
      else if (r.status==='L')           l++;
      else if (r.status==='WO'||r.status==='HD') wo++;
      totalWH += Number(r.worked_hours)||0;
    });
    const empSet = new Set(monthRecs.map(r=>r.emp_id));
    const paidPayroll = (st.payroll||[]).filter(p=>p.period===month&&p.status==='PAID');
    let payrollNote = paidPayroll.length > 0
      ? `<div style="background:#fee2e2;color:#991b1b;border-radius:8px;padding:8px;margin-top:8px;font-weight:600;">🚨 BLOCKED — PAID payroll exists. Reverse in Payroll first.</div>`
      : '';
    preview.innerHTML = `<b>📊 ${_monthLabel(month)}</b><br><br>
      • Employees: <b>${empSet.size}</b><br>
      • Total records: <b>${monthRecs.length}</b><br>
      • P:${p} · H:${h} · A:${a} · L:${l} · WO/HD:${wo}<br>
      • Total Worked Hours: <b>${_fmtHours(totalWH)}</b>
      ${payrollNote}`;
    const nextBtn = document.getElementById('del-month-next-btn');
    if (nextBtn) {
      nextBtn.disabled = paidPayroll.length > 0;
      nextBtn.style.opacity = paidPayroll.length > 0 ? '0.4' : '1';
    }
  }

  function _proceedToFinalConfirm() {
    const month = document.getElementById('del-month-select')?.value;
    if (!month) return;
    const st = SSIApp.getState();
    const monthRecs = (st.attendance||[]).filter(a=>a.date&&a.date.startsWith(month)&&_isActive(a));
    if (!monthRecs.length) { SSIApp.toast('No active records to delete.'); return; }
    const confirmText = `DELETE ${_monthLabelUpper(month)}`;
    SSIApp.modal(`
      <div style="padding:8px;">
        <h3 style="margin:0 0 12px;color:#dc2626;">🚨 FINAL CONFIRMATION</h3>
        <p style="font-size:14px;color:#475569;margin-bottom:12px;">
          Delete <b>${monthRecs.length}</b> attendance records for <b>${_monthLabel(month)}</b>?
        </p>
        <div style="background:#fee2e2;color:#991b1b;border-radius:6px;padding:8px 12px;font-family:monospace;font-size:15px;font-weight:700;text-align:center;margin-bottom:10px;">
          ${confirmText}
        </div>
        <input id="del-month-confirm-input" type="text" placeholder="Type above text to confirm"
          oninput="SSIAttendance._checkFinalConfirm('${confirmText}')"
          style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:monospace;margin-bottom:14px;">
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-danger" id="del-month-final-btn" disabled
            onclick="SSIAttendance._executeDeleteMonth('${month}')"
            style="opacity:0.4;cursor:not-allowed;">🗑️ Delete Now</button>
        </div>
      </div>`);
    setTimeout(()=>document.getElementById('del-month-confirm-input')?.focus(), 100);
  }

  function _checkFinalConfirm(expected) {
    const inp = document.getElementById('del-month-confirm-input');
    const btn = document.getElementById('del-month-final-btn');
    if (!inp || !btn) return;
    const match = inp.value.trim() === expected;
    btn.disabled = !match;
    btn.style.opacity = match ? '1' : '0.4';
    btn.style.cursor  = match ? 'pointer' : 'not-allowed';
  }

  async function _executeDeleteMonth(month) {
    const btn = document.getElementById('del-month-final-btn');
    if (btn) { btn.disabled=true; btn.textContent='⏳ Deleting…'; }
    const st  = SSIApp.getState();
    const now = new Date().toISOString();
    const by  = SSIApp.state.currentUser?.username||'unknown';
    let cnt = 0;
    (st.attendance||[]).forEach(a=>{
      if (a.date&&a.date.startsWith(month)&&_isActive(a)) {
        a.active=false; a.deleted_at=now; a.deleted_by=by;
        a.deleted_reason=`bulk delete (${month})`; cnt++;
      }
    });
    await SSIApp.saveState(st);
    SSIApp.closeModal();
    SSIApp.toast(`🗑️ ${cnt} records deleted for ${_monthLabel(month)} (recoverable).`,'success');
    const sel = document.getElementById('att-filter-month');
    if (sel) sel.value = month;
    applyFilter();
  }

  async function restoreMonth(month) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st = SSIApp.getState();
    const deleted = (st.attendance||[]).filter(a=>a.date&&a.date.startsWith(month)&&!_isActive(a));
    if (!deleted.length) { SSIApp.toast('Nothing to restore.'); return; }
    const ok = await _safeConfirm(`Restore all ${deleted.length} deleted records for ${_monthLabel(month)}?`);
    if (!ok) return;
    const now=new Date().toISOString(), by=SSIApp.state.currentUser?.username||'unknown';
    deleted.forEach(r=>{ r.active=true; r.restored_at=now; r.restored_by=by; delete r.deleted_at; delete r.deleted_by; delete r.deleted_reason; });
    await SSIApp.saveState(st);
    SSIApp.toast(`♻️ Restored ${deleted.length} records for ${_monthLabel(month)}`,'success');
    applyFilter();
  }

  /* ── Public API ─────────────────────────────────────────────── */
  return {
    render, refresh, applyFilter,
    toggleViewMode, toggleShowDeleted,
    openBulkEntry, saveBulk, _buildBulkRows, _recalcBulkRow, _applyDefaultShift,
    quickEdit, _setQEStatus, _recalcQE, _saveQuickEdit,
    deleteRecord, restoreRecord, restoreMonth,
    openDeleteMonthModal, _updateDeleteMonthPreview, _proceedToFinalConfirm,
    _checkFinalConfirm, _executeDeleteMonth,
    downloadTemplate, importFile, exportExcel,
    // Expose for payroll
    getWorkedHours(empId, date) {
      const rec = (SSIApp.getState().attendance||[]).find(a=>a.emp_id===empId&&a.date===date&&_isActive(a));
      return { workedHours: Number(rec?.worked_hours)||0, otHours: Number(rec?.ot_hours)||0, status: rec?.status||'A' };
    }
  };
})();
