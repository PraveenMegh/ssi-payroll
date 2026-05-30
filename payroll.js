/* ============================================================
   SSI Payroll Module
   payroll.js
   Access: ADMIN = all (staff + workers)
           ACCOUNTANT = workers only (staff salary hidden)
   Formula: Net = (MonthlySalary/daysInMonth) × EffectiveDays + OT − EPF − ESI − Advance
   OT Rate  = (MonthlySalary / daysInMonth / 8) per hour  (8-hr working day)
   EPF      = 12% of Basic (employer contribution, deducted for display)
   ESI      = 0.75% of Gross (employee, only if Gross ≤ ₹21,000)
   Advance  = manual entry per payroll record
   Staff:   up to 2 paid leaves counted as Present
   Workers: overtime eligible, no paid leaves

   FIX (this version):
   - All numeric values now rounded to 2 decimals at calculation
     and at display, eliminating long floating-point tails like
     21.529999999999998 → 21.53.
   ============================================================ */
const SSIPayroll = (() => {

  const PAID_LEAVES_STAFF = 2;
  const EPF_RATE  = 0.12;    // 12% employer EPF on basic
  const ESI_RATE  = 0.0075;  // 0.75% employee ESI on gross
  const ESI_LIMIT = 21000;   // ESI not applicable above ₹21,000 gross

  /* ── Round helper — guarantees 2 decimals everywhere ───── */
  function _r2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function _todayISO() { return new Date().toISOString().slice(0,10); }

  // Payroll month freezes on 15th of next month. Example: May 2026 freezes on 15 June 2026.
  function _freezeDate(period) {
    if (!period) return '';
    const [y,m] = period.split('-').map(Number);
    const d = new Date(y, m, 15); // JS month is zero-based; m = next month
    return d.toISOString().slice(0,10);
  }

  function _isFrozen(period) {
    if (!period) return false;
    return _todayISO() >= _freezeDate(period);
  }

  function _paidAmount(p) { return _money(p.paid_amount ?? (p.status === 'PAID' ? p.net_pay : 0)); }
  function _balanceAmount(p) { return Math.max(0, _money((p.net_pay||0) - _paidAmount(p))); }
  function _arrearAmount(p) { return _money(p.arrear_amount || 0); }

  function _monthsBetweenInclusive(fromYM, toYM) {
    if (!fromYM || !toYM) return [];
    let [fy,fm] = fromYM.split('-').map(Number);
    const [ty,tm] = toYM.split('-').map(Number);
    const out = [];
    while (fy < ty || (fy === ty && fm <= tm)) {
      out.push(`${fy}-${String(fm).padStart(2,'0')}`);
      fm++; if (fm > 12) { fm = 1; fy++; }
    }
    return out;
  }

  /* ── Employee lookup helper (3-tier: id → emp_code → null) ─
     Handles the case where employees were deleted and re-imported
     with new IDs after payroll records were already generated.  */
  function _findEmp(st, p) {
    const emps = st.employees || [];
    // Tier 1: exact id match (normal case)
    let emp = emps.find(e => e.id === p.emp_id);
    if (emp) return emp;
    // Tier 2: match by emp_code stored in payroll record (new records)
    if (p.emp_code) emp = emps.find(e => e.emp_code === p.emp_code);
    if (emp) return emp;
    // Tier 3: match by name stored in payroll record (new records)
    if (p.emp_name) emp = emps.find(e => e.name === p.emp_name);
    if (emp) return emp;
    // Tier 4: emp_id might actually be an emp_code (legacy edge case)
    emp = emps.find(e => e.emp_code === p.emp_id);
    return emp || null;
  }

  /* ── Auto-repair broken payroll → employee links ────────────
     When employees are deleted & re-imported they get new UUIDs.
     This function tries to re-link orphaned payroll records by
     matching monthly_salary to a unique employee. Runs silently
     on each payroll page load; saves state only if repairs made. */
  async function _repairPayrollLinks() {
    const st   = SSIApp.getState();
    const emps = st.employees || [];
    const recs = st.payroll   || [];
    if (!emps.length || !recs.length) return;

    let repaired = 0;

    // Build: emp_id → employee for fast lookup
    const empById  = {};
    emps.forEach(e => { empById[e.id] = e; });

    // Build: salary → [employees] for matching heuristic
    const empBySal = {};
    emps.forEach(e => {
      const sal1 = e.monthly_salary || 0;
      const sal2 = (e.bank_salary||0) + (e.cash_salary||0);
      const sal  = sal1 > 0 ? sal1 : sal2;
      if (sal <= 0) return;
      if (!empBySal[sal]) empBySal[sal] = [];
      empBySal[sal].push(e);
    });

    // Find broken records: emp_id not in current employees
    const brokenIds = new Set(
      recs.filter(p => !empById[p.emp_id] && !p.emp_code && !p.emp_name)
          .map(p => p.emp_id)
    );

    if (!brokenIds.size) return;

    const brokenMap = {};
    recs.forEach(p => {
      if (!brokenIds.has(p.emp_id)) return;
      if (!brokenMap[p.emp_id]) brokenMap[p.emp_id] = { salary: p.monthly_salary, recs: [] };
      brokenMap[p.emp_id].recs.push(p);
    });

    const matchedEmpIds = new Set(recs.filter(p => empById[p.emp_id]).map(p => p.emp_id));

    for (const [brokenEmpId, info] of Object.entries(brokenMap)) {
      const sal = info.salary;
      const candidates = (empBySal[sal] || []).filter(e => !matchedEmpIds.has(e.id));

      if (candidates.length !== 1) continue;

      const emp  = candidates[0];
      const unit = (st.units || []).find(u => u.id === emp.unit_id);
      matchedEmpIds.add(emp.id);

      info.recs.forEach(p => {
        p.emp_id    = emp.id;
        p.emp_name  = emp.name || '';
        p.emp_code  = emp.emp_code || '';
        p.emp_type  = emp.type || '';
        p.unit_name = unit?.name || '';
      });
      repaired += info.recs.length;
      console.log('[SSI Payroll] Repaired', info.recs.length, 'records → linked to', emp.emp_code, emp.name);
    }

    if (repaired > 0) {
      await SSIApp.saveState(st);
      console.log('[SSI Payroll] Auto-repair saved:', repaired, 'records fixed');
    }
  }

  /* ── Display fields helper (emp live → stored snapshot → '—') */
  function _empDisplay(emp, p) {
    const unit = (SSIApp.getState().units || []).find(u => u.id === emp?.unit_id);
    return {
      name: emp?.name     || p.emp_name  || '—',
      code: emp?.emp_code || p.emp_code  || '',
      type: emp?.type     || p.emp_type  || '',
      unit: unit?.name    || p.unit_name || '—',
    };
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
    _repairPayrollLinks().then(() => {
      _doRefresh(area);
    });
  }

  function _doRefresh(area) {
    const st    = SSIApp.getState();
    const today = new Date().toISOString().slice(0,7);
    const isAdmin = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');

    const payrolls = st.payroll || [];
    const periods = [...new Set(payrolls.map(p=>p.period))].sort().reverse();

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">💰 Payroll</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="SSIApp.navigate('attendance')">🗓️ Attendance Panel</button>
          ${SSIApp.hasRole('ADMIN') ? `<button class="btn btn-secondary btn-sm" onclick="SSIPayroll.openSalaryRevision()">📈 Salary Revision / Arrear</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="SSIPayroll.openBulkDeduction()">➖ Deduction Panel</button>
          <button class="btn btn-secondary btn-sm" onclick="SSIPayroll.openRevisionLog()">🧾 Revision Log</button>
          <button class="btn btn-secondary btn-sm" onclick="SSIPayroll.exportExcel()">📤 Export</button>
          <button class="btn btn-primary" onclick="SSIPayroll.openGenerateModal()">⚙️ Generate Payroll</button>
        </div>
      </div>

      <!-- Orphan warning banner -->
      <div id="pr-orphan-banner" style="display:none;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:#92400e;"></div>
      <div id="pr-freeze-banner" style="display:none;background:#eff6ff;border:1px solid #60a5fa;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:#1d4ed8;"></div>

      <!-- Period selector -->
      <div class="card" style="margin-bottom:16px;padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;align-items:end;">
          <div>
            <label>Payroll Month</label>
            <select id="pr-filter-period" onchange="SSIPayroll.applyFilter()">
              <option value="">All Months</option>
              ${periods.map(p=>`<option value="${p}">${_fmtPeriod(p)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Employee Type</label>
            <select id="pr-filter-type" onchange="SSIPayroll.applyFilter()">
              <option value="">All</option>
              <option value="WORKER">👷 Workers</option>
              ${(isAdmin) ? '<option value="STAFF">👔 Staff</option>' : ''}
            </select>
          </div>
          <div>
            <label>Unit</label>
            <select id="pr-filter-unit" onchange="SSIPayroll.applyFilter()">
              <option value="">All Units</option>
              ${(st.units||[]).filter(u=>u.active).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select id="pr-filter-status" onchange="SSIPayroll.applyFilter()">
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="PROCESSED">Processed</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div id="pr-summary" style="margin-bottom:16px;"></div>

      <!-- Table -->
      <div class="card" style="overflow-x:auto;">
        <table id="pr-table">
          <thead><tr>
            <th>Period</th><th>Employee</th><th>Type</th><th>Unit</th>
            <th style="text-align:right;">Monthly Sal.</th>
            <th style="text-align:center;">Days P</th>
            <th style="text-align:center;">H</th>
            <th style="text-align:center;">L</th>
            <th style="text-align:center;">Pay Days</th>
            <th style="text-align:right;">OT Hrs</th>
            <th style="text-align:right;">OT Amt</th>
            <th style="text-align:right;">Arrear</th>
            <th style="text-align:right;">Deduct.</th>
            <th style="text-align:right;">Gross</th>
            <th style="text-align:right;">Net Pay</th>
            <th style="text-align:right;">Paid Amt</th>
            <th style="text-align:right;">Balance</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="pr-tbody"><tr><td colspan="20" style="text-align:center;padding:40px;color:#94a3b8;">Select a month and generate payroll to begin.</td></tr></tbody>
        </table>
        <div id="pr-total-row" style="padding:12px 16px;font-size:13px;color:#64748b;text-align:right;"></div>
      </div>`;

    applyFilter();
  }

  function applyFilter() {
    const st       = SSIApp.getState();
    const isAdmin  = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');
    const period   = document.getElementById('pr-filter-period')?.value  || '';
    const typeF    = document.getElementById('pr-filter-type')?.value    || '';
    const unitF    = document.getElementById('pr-filter-unit')?.value    || '';
    const statusF  = document.getElementById('pr-filter-status')?.value  || '';

    let list = (st.payroll||[]).filter(p => {
      const emp = _findEmp(st, p);
      const empType = emp?.type || p.emp_type || '';
      if (!isAdmin && empType === 'STAFF') return false;
      if (period  && p.period   !== period)  return false;
      if (typeF   && empType    !== typeF)   return false;
      if (unitF   && emp?.unit_id !== unitF) return false;
      if (statusF && p.status   !== statusF) return false;
      return true;
    });

    list = list.sort((a,b) => {
      if (b.period !== a.period) return b.period.localeCompare(a.period);
      const ea = _findEmp(st, a);
      const eb = _findEmp(st, b);
      return ((ea?.name||a.emp_name||'')).localeCompare((eb?.name||b.emp_name||''));
    });

    // Summary totals — round each accumulation to avoid drift
    const totalNet    = _r2(list.reduce((s,p)=>s+_r2(p.net_pay),0));
    const totalGross  = _r2(list.reduce((s,p)=>s+_r2(p.gross_pay),0));
    const totalOT     = _r2(list.reduce((s,p)=>s+_r2(p.ot_amount),0));
    const totalDeduct = _r2(list.reduce((s,p)=>s+_r2(p.deductions),0));
    const totalPaid   = _money(list.reduce((s,p)=>s+_paidAmount(p),0));
    const totalBal    = _money(list.reduce((s,p)=>s+_balanceAmount(p),0));
    const totalArrear = _money(list.reduce((s,p)=>s+_arrearAmount(p),0));
    const paidCount   = list.filter(p=>p.status==='PAID').length;

    const summaryEl = document.getElementById('pr-summary');
    if (summaryEl) summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;">
        <div style="background:#FDECEA;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#922B21;">${list.length}</div><div style="font-size:12px;color:#922B21;">Records</div></div>
        <div style="background:#dcfce7;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#166534;">₹${_fmt(totalGross)}</div><div style="font-size:12px;color:#166534;">Gross Pay</div></div>
        <div style="background:#fef3c7;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#92400e;">₹${_fmt(totalOT)}</div><div style="font-size:12px;color:#92400e;">OT Amount</div></div>
        <div style="background:#e0f2fe;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#0369a1;">₹${_fmt(totalArrear)}</div><div style="font-size:12px;color:#0369a1;">Arrears</div></div>
        <div style="background:#fee2e2;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#991b1b;">₹${_fmt(totalDeduct)}</div><div style="font-size:12px;color:#991b1b;">Deductions</div></div>
        <div style="background:#f0fdf4;padding:14px 16px;border-radius:10px;border:2px solid #166534;"><div style="font-size:22px;font-weight:800;color:#166534;">₹${_fmt(totalNet)}</div><div style="font-size:12px;color:#166534;">Net Payable</div></div>
        <div style="background:#dcfce7;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#166534;">₹${_fmt(totalPaid)}</div><div style="font-size:12px;color:#166534;">Amount Paid</div></div>
        <div style="background:#fff7ed;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#c2410c;">₹${_fmt(totalBal)}</div><div style="font-size:12px;color:#c2410c;">Pending</div></div>
        <div style="background:#f5f3ff;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#5b21b6;">${paidCount}/${list.length}</div><div style="font-size:12px;color:#5b21b6;">Paid Employees</div></div>
      </div>`;

    const freezeBanner = document.getElementById('pr-freeze-banner');
    if (freezeBanner) {
      if (period && _isFrozen(period)) {
        freezeBanner.style.display = 'block';
        freezeBanner.innerHTML = `🔒 <b>${_fmtPeriod(period)} is frozen</b> from ${_freezeDate(period)}. Viewing/export is allowed. Edits create revision logs; old paid records are not deleted.`;
      } else {
        freezeBanner.style.display = 'none';
      }
    }

    const tbody = document.getElementById('pr-tbody');
    if (!tbody) return;

    const orphaned = list.filter(p => !_findEmp(st, p) && !p.emp_name);
    const orphanBanner = document.getElementById('pr-orphan-banner');
    if (orphanBanner) {
      if (orphaned.length > 0) {
        orphanBanner.style.display = 'block';
        orphanBanner.innerHTML = `⚠️ <strong>${orphaned.length} payroll record(s)</strong> have no linked employee — employees were deleted &amp; re-imported with new IDs. <button onclick="SSIPayroll.openRelinkModal()" style="margin-left:12px;background:#f59e0b;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;">🔗 Re-link Records</button>`;
      } else {
        orphanBanner.style.display = 'none';
      }
    }

    if (!list.length) { tbody.innerHTML = `<tr><td colspan="20" style="text-align:center;padding:40px;color:#94a3b8;">No payroll records found.</td></tr>`; return; }

    tbody.innerHTML = list.map(p => {
      const emp  = _findEmp(st, p);
      const { name: dName, code: dCode, type: dType, unit: dUnit } = _empDisplay(emp, p);
      const st_badge = _statusBadge(p.status);
      // Round each value at display time as last-line-of-defense
      const otHrs   = _r2(p.ot_hours);
      const otAmt   = _r2(p.ot_amount);
      const deduct  = _r2(p.deductions);
      const gross   = _r2(p.gross_pay);
      const netPay  = _r2(p.net_pay);
      const paidAmt = _paidAmount(p);
      const balAmt  = _balanceAmount(p);
      const arrear  = _arrearAmount(p);
      const monthly = _r2(p.monthly_salary);
      const frozen = _isFrozen(p.period);
      return `<tr>
        <td style="white-space:nowrap;">${_fmtPeriod(p.period)}</td>
        <td><b>${dName}</b><br><span style="font-size:11px;color:#64748b;">${dCode}</span></td>
        <td><span style="background:${dType==='STAFF'?'#FDECEA':'#dcfce7'};color:${dType==='STAFF'?'#922B21':'#166534'};padding:2px 7px;border-radius:10px;font-size:11px;">${dType}</span></td>
        <td>${dUnit}</td>
        <td style="text-align:right;">₹${_fmt(monthly)}</td>
        <td style="text-align:center;">${p.present_days}</td>
        <td style="text-align:center;">${p.half_days}</td>
        <td style="text-align:center;">${p.leave_days}</td>
        <td style="text-align:center;color:#3730a3;font-weight:600;">${_fmtQty(p.payable_days ?? (p.present_days + (p.half_days||0)*0.5 + (p.paid_leaves||0)))}</td>
        <td style="text-align:right;">${_fmt(otHrs)}</td>
        <td style="text-align:right;color:#f59e0b;font-weight:600;">${otAmt>0?'₹'+_fmt(otAmt):'—'}</td>
        <td style="text-align:right;color:#0369a1;font-weight:700;">${arrear>0?'₹'+_fmt(arrear):'—'}</td>
        <td style="text-align:right;color:#991b1b;">${deduct>0?'₹'+_fmt(deduct):'—'}</td>
        <td style="text-align:right;font-weight:600;">₹${_fmt(gross)}</td>
        <td style="text-align:right;font-weight:800;font-size:15px;color:#166534;">₹${_fmt(netPay)}</td>
        <td style="text-align:right;color:#166534;font-weight:700;">${paidAmt>0?'₹'+_fmt(paidAmt):'—'}</td>
        <td style="text-align:right;color:${balAmt>0?'#c2410c':'#64748b'};font-weight:700;">${balAmt>0?'₹'+_fmt(balAmt):'—'}</td>
        <td style="font-size:11px;color:#64748b;">${p.payment_date||''}<br>${p.payment_mode||''}</td>
        <td>${st_badge}${frozen?'<br><span style="font-size:10px;color:#1d4ed8;">🔒 Frozen</span>':''}</td>
        <td style="white-space:nowrap;">
          ${(p.status!=='PAID' && !frozen) ? `<button class="btn btn-secondary btn-sm" onclick="SSIPayroll.openEdit('${p.id}')" title="Edit deductions/remarks">✏️</button>` : ''}
          ${(p.status!=='PAID'&&SSIApp.hasRole('ADMIN')&&!frozen) ? `<button class="btn btn-danger btn-sm" onclick="SSIPayroll.deletePayroll('${p.id}')" title="Delete record">🗑️</button>` : ''}
          ${(p.status!=='PAID' || balAmt>0) ? `<button class="btn btn-primary btn-sm" onclick="SSIPayroll.openPayment('${p.id}')" title="Record payment" style="font-size:11px;">💳 Pay</button>` : ''}
          ${p.status==='PAID' ? `<button class="btn btn-secondary btn-sm" onclick="SSIPayroll.openRevision('${p.id}')" title="Post-payment revision">🔁 Revise</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="SSIPayroll.printSlip('${p.id}')" title="Print Slip">🖨️</button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Generate Payroll Modal ──────────────────────────────── */
  function openGenerateModal() {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT','ACCOUNTS')) return;
    const st    = SSIApp.getState();
    const today = new Date().toISOString().slice(0,7);
    const isAdmin = SSIApp.hasRole('ADMIN');

    SSIApp.modal(`
      <h3 style="margin-bottom:16px;">⚙️ Generate Payroll</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div>
          <label>Month *</label>
          <input type="month" id="gen-month" value="${today}">
        </div>
        <div>
          <label>Employee Type</label>
          <select id="gen-type">
            <option value="">All</option>
            <option value="WORKER">👷 Workers Only</option>
            ${(isAdmin) ? '<option value="STAFF">👔 Staff Only</option>' : ''}
          </select>
        </div>
        <div>
          <label>Unit</label>
          <select id="gen-unit">
            <option value="">All Units</option>
            ${(st.units||[]).filter(u=>u.active).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
          </select>
        </div>
        <div style="background:#e0f2fe;border-radius:8px;padding:10px;font-size:12px;color:#0369a1;">
          <b>ℹ️ OT Rate</b><br>Auto = Monthly ÷ 30 ÷ 8 hrs<br>e.g. ₹15,000 salary = ₹62.50/hr</div>
      </div>
      <div style="background:#fef3c7;border-radius:8px;padding:12px;font-size:13px;margin-bottom:16px;">
        <b>ℹ️ Rules applied:</b><br>
        • Salary is divided by 30 days and Sundays are included for monthly salary<br>
        • If all Monday–Saturday working days are present, full monthly salary is payable<br>
        • Short hours/absence reduce salary proportionately from the 30-day base<br>
        • OT rate = Monthly Salary ÷ 30 ÷ 8 per hour<br>
        • Amounts are rounded to whole rupees<br>
        • Existing payroll for same employee+month will be <b>overwritten</b> (if not PAID)
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIPayroll.runGenerate()">⚙️ Generate Now</button>
      </div>`);
  }

  async function runGenerate() {
    const month   = document.getElementById('gen-month')?.value;
    const typeF   = document.getElementById('gen-type')?.value  || '';
    const unitF   = document.getElementById('gen-unit')?.value  || '';
    if (!month) { SSIApp.toast('Select month'); return; }

    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');
    if (!st.payroll) st.payroll = [];

    let emps = (st.employees||[]).filter(e=>e.active!==false);
    if (!isAdmin) emps = emps.filter(e=>e.type==='WORKER');
    if (typeF)    emps = emps.filter(e=>e.type===typeF);
    if (unitF)    emps = emps.filter(e=>e.unit_id===unitF);

    if (!emps.length) { SSIApp.toast('No employees match the filter'); return; }

    const [yr, mo]    = month.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const days        = Array.from({length:daysInMonth},(_,i)=>{
      const d = String(i+1).padStart(2,'0');
      return `${yr}-${String(mo).padStart(2,'0')}-${d}`;
    });
    // Monday to Saturday are working days. Sundays are included in salary by default.
    const scheduledWorkingDays = days.filter(d => new Date(d + 'T00:00:00').getDay() !== 0).length;

    const attRecs = (st.attendance||[]).filter(a=>a.date&&a.date.startsWith(month) && a.active !== false);
    const attMap  = {};
    attRecs.forEach(a => { attMap[`${a.emp_id}|${a.date}`] = a; });

    let generated = 0, skipped = 0;

    emps.forEach(emp => {
      const existPaid = st.payroll.find(p=>p.emp_id===emp.id&&p.period===month&&p.status==='PAID');
      if (existPaid) { skipped++; return; }

      let present=0, half=0, leaves=0, absent=0, woff=0, otHours=0, paidAttendanceDays=0, workHours=0;
      days.forEach(d => {
        const rec = attMap[`${emp.id}|${d}`];
        const s   = rec?.status || 'A';
        if (s==='P')           present++;
        else if (s==='A')      absent++;
        else if (s==='H')      half++;
        else if (s==='L')      leaves++;
        else if (s==='WO'||s==='HD') woff++;

        if (rec?.work_hours) workHours += Number(rec.work_hours) || 0;
        if (rec?.ot_hours)   otHours   += Number(rec.ot_hours) || 0;

        // Hourly attendance support: paid_days is generated by attendance.js.
        // Old records remain compatible with P=1 day and H=0.5 day.
        if (rec?.paid_days !== undefined) paidAttendanceDays += Number(rec.paid_days) || 0;
        else if (s==='P') paidAttendanceDays += 1;
        else if (s==='H') paidAttendanceDays += 0.5;
      });
      // Round totals to prevent floating-point artifacts
      otHours = _r2(otHours);
      workHours = _r2(workHours);
      paidAttendanceDays = _r2(paidAttendanceDays);

      const paidLeaves = emp.type==='STAFF' ? Math.min(leaves, PAID_LEAVES_STAFF) : 0;

      // Salary rule: Monthly salary is divided by 30 days and Sundays are included.
      // If an employee is present for all Mon–Sat working days, full 30 days are paid.
      // Short hours / absences reduce payable days from the 30-day base.
      const payableWorkEquivalent = _r2(paidAttendanceDays + paidLeaves);
      const lossOfPayDays = Math.max(0, _r2(scheduledWorkingDays - payableWorkEquivalent));
      const effectiveDays = payableWorkEquivalent <= 0 ? 0 : Math.max(0, Math.min(30, _r2(30 - lossOfPayDays)));
      const perDay        = _r2((emp.monthly_salary||0) / 30);
      const otRate        = _r2((emp.monthly_salary||0) / 30 / 8);
      const grossBase     = _money(perDay * effectiveDays);
      const otAmount      = _money(otHours * otRate);
      const existing      = st.payroll.find(p=>p.emp_id===emp.id&&p.period===month);
      const existingArrear = _money(existing?.arrear_amount || 0);
      const grossPay      = _money(grossBase + otAmount + existingArrear);
      const advance       = _money(existing?.advance || 0);
      const otherDeduct   = _money(existing?.other_deduction || 0);
      const epfAmount     = _money(grossBase * EPF_RATE);
      const esiAmount     = grossPay <= ESI_LIMIT ? _money(grossPay * ESI_RATE) : 0;
      const totalDeduct   = _money(advance + otherDeduct + epfAmount + esiAmount);
      const deductions    = totalDeduct;
      const netPay        = Math.max(0, _money(grossPay - totalDeduct));

      const rec = {
        id:             existing?.id || SSIApp.uid(),
        emp_id:         emp.id,
        emp_name:       emp.name||'',
        emp_code:       emp.emp_code||'',
        emp_type:       emp.type||'',
        unit_name:      (SSIApp.getState().units||[]).find(u=>u.id===emp.unit_id)?.name||'',
        period:         month,
        monthly_salary: _r2(emp.monthly_salary||0),
        working_days:   30,
        scheduled_working_days: scheduledWorkingDays,
        payable_days:   effectiveDays,
        loss_of_pay_days: lossOfPayDays,
        present_days:   present,
        half_days:      half,
        leave_days:     leaves,
        paid_leaves:    paidLeaves,
        absent_days:    absent,
        week_offs:      woff,
        ot_hours:       otHours,
        work_hours:     workHours,
        ot_rate:        otRate,
        ot_amount:      otAmount,
        arrear_amount:   existingArrear,
        gross_pay:      grossPay,
        advance:        advance,
        other_deduction: otherDeduct,
        epf_amount:     epfAmount,
        esi_amount:     esiAmount,
        deductions:     totalDeduct,
        deduction_note: existing?.deduction_note || '',
        net_pay:        netPay,
        status:         existing?.status || 'DRAFT',
        payment_date:   existing?.payment_date || '',
        payment_mode:   existing?.payment_mode || '',
        remarks:        existing?.remarks || '',
        generated_by:   SSIApp.state.currentUser?.id||'',
        generated_at:   new Date().toISOString(),
      };

      const idx = st.payroll.findIndex(p=>p.emp_id===emp.id&&p.period===month);
      if (idx>=0) st.payroll[idx] = rec;
      else        st.payroll.push(rec);
      generated++;
    });

    await SSIApp.saveState(st);
    SSIApp.toast(`✅ Generated ${generated} payroll records${skipped?' ('+skipped+' PAID skipped)':''}`);
    SSIApp.audit('PAYROLL_GENERATE', `Generated ${generated} records for ${month}`);
    SSIApp.closeModal();

    const sel = document.getElementById('pr-filter-period');
    if (sel) {
      const opt = [...sel.options].find(o=>o.value===month);
      if (!opt) { const o=document.createElement('option'); o.value=month; o.textContent=_fmtPeriod(month); sel.insertBefore(o, sel.options[1]); }
      sel.value = month;
    }
    applyFilter();
  }

  /* ── Edit record (deductions / remarks) ─────────────────── */
  function openEdit(recId) {
    const st  = SSIApp.getState();
    const rec = (st.payroll||[]).find(p=>p.id===recId);
    if (!rec) return;
    const emp  = _findEmp(st, rec);

    SSIApp.modal(`
      <h3 style="margin-bottom:14px;">✏️ Edit Payroll — ${emp?.name||rec.emp_name||''} (${_fmtPeriod(rec.period)})</h3>
      <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>Gross Pay: <b>₹${_fmt(rec.gross_pay)}</b></div>
        <div>OT Amount: <b>₹${_fmt(rec.ot_amount)}</b></div>
        <div>Present: <b>${rec.present_days}</b> days</div>
        <div>Working Days: <b>${rec.working_days}</b> days</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label>💰 Advance / Loan Recovery (₹)</label>
          <input type="number" id="edit-advance" value="${_money(rec.advance||0)}" min="0" step="1" oninput="SSIPayroll._calcNet()">
        </div>
        <div>
          <label>📌 EPF (12% of Basic) <span style="font-size:10px;color:#64748b;">auto</span></label>
          <input type="number" id="edit-epf" value="${_money(rec.epf_amount||0)}" min="0" step="1" oninput="SSIPayroll._calcNet()">
        </div>
        <div>
          <label>🏥 ESI (0.75% if ≤₹21K) <span style="font-size:10px;color:#64748b;">auto</span></label>
          <input type="number" id="edit-esi" value="${_money(rec.esi_amount||0)}" min="0" step="1" oninput="SSIPayroll._calcNet()">
        </div>
        <div>
          <label>➖ Other Deduction (₹)</label>
          <input type="number" id="edit-other-deduction" value="${_money(rec.other_deduction||0)}" min="0" step="1" oninput="SSIPayroll._calcNet()">
        </div>
        <div>
          <label>📝 Deduction Note</label>
          <input id="edit-deduct-note" value="${rec.deduction_note||''}" placeholder="e.g. Advance recovery / penalty / other deduction">
        </div>
        <div>
          <label>Payment Mode</label>
          <select id="edit-pay-mode">
            <option value="">Select</option>
            <option value="CASH"   ${rec.payment_mode==='CASH'?'selected':''}>💵 Cash</option>
            <option value="BANK"   ${rec.payment_mode==='BANK'?'selected':''}>🏦 Bank Transfer</option>
            <option value="CHEQUE" ${rec.payment_mode==='CHEQUE'?'selected':''}>📄 Cheque</option>
          </select>
        </div>
        <div>
          <label>Remarks</label>
          <input id="edit-remarks" value="${rec.remarks||''}" placeholder="Any note…">
        </div>
      </div>
      <div style="background:#FDECEA;border-radius:8px;padding:12px;margin-top:14px;text-align:center;">
        <span style="font-size:13px;">Revised Net Pay: </span>
        <span id="edit-net-preview" data-gross="${_r2(rec.gross_pay)}" style="font-size:20px;font-weight:800;color:#922B21;">₹${_fmt(rec.net_pay||rec.gross_pay)}</span>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIPayroll.saveEdit('${recId}')">💾 Save</button>
      </div>`);
  }

  function _calcNet() {
    const adv = _money(parseFloat(document.getElementById('edit-advance')?.value)||0);
    const epf = _money(parseFloat(document.getElementById('edit-epf')?.value)||0);
    const esi = _money(parseFloat(document.getElementById('edit-esi')?.value)||0);
    const oth = _money(parseFloat(document.getElementById('edit-other-deduction')?.value)||0);
    const gross = _money(parseFloat(document.getElementById('edit-net-preview')?.dataset?.gross || 0));
    const n = Math.max(0, _money(gross - adv - epf - esi - oth));
    const el = document.getElementById('edit-net-preview');
    if (el) { el.textContent = '₹' + _fmt(n); }
  }

  async function saveEdit(recId) {
    const st  = SSIApp.getState();
    const idx = (st.payroll||[]).findIndex(p=>p.id===recId);
    if (idx<0) return;
    const rec     = st.payroll[idx];
    const advance = Math.max(0, _money(parseFloat(document.getElementById('edit-advance')?.value)||0));
    const epf     = Math.max(0, _money(parseFloat(document.getElementById('edit-epf')?.value)||0));
    const esi     = Math.max(0, _money(parseFloat(document.getElementById('edit-esi')?.value)||0));
    const other   = Math.max(0, _money(parseFloat(document.getElementById('edit-other-deduction')?.value)||0));
    const totalD  = _money(advance + epf + esi + other);
    const netPay  = Math.max(0, _money(rec.gross_pay - totalD));

    st.payroll[idx] = {
      ...rec,
      advance,
      other_deduction: other,
      epf_amount:     epf,
      esi_amount:     esi,
      deductions:     totalD,
      deduction_note: document.getElementById('edit-deduct-note')?.value.trim()||'',
      payment_mode:   document.getElementById('edit-pay-mode')?.value||'',
      remarks:        document.getElementById('edit-remarks')?.value.trim()||'',
      net_pay:        netPay,
      status:         rec.status === 'DRAFT' ? 'PROCESSED' : rec.status,
      updated_at:     new Date().toISOString(),
    };
    await SSIApp.saveState(st);
    SSIApp.toast('✅ Payroll record updated');
    SSIApp.closeModal();
    applyFilter();
  }

  /* ── Payment Tracking ────────────────────────────────────── */
  function openPayment(recId) {
    const st  = SSIApp.getState();
    const rec = (st.payroll||[]).find(p=>p.id===recId);
    if (!rec) return;
    const emp = _findEmp(st, rec);
    const paidSoFar = _paidAmount(rec);
    const balance = _balanceAmount(rec);
    const suggested = balance > 0 ? balance : Math.max(0, _money(rec.net_pay||0) - paidSoFar);
    SSIApp.modal(`
      <h3 style="margin-bottom:14px;">💳 Record Payment — ${emp?.name||rec.emp_name||''}</h3>
      <div style="background:#f8fafc;border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        <div>Net Payable<br><b style="font-size:18px;color:#166534;">₹${_fmt(rec.net_pay)}</b></div>
        <div>Already Paid<br><b style="font-size:18px;color:#0369a1;">₹${_fmt(paidSoFar)}</b></div>
        <div>Balance<br><b style="font-size:18px;color:#c2410c;">₹${_fmt(balance)}</b></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label>Amount Paid Now ₹</label><input type="number" id="pay-amount" min="0" step="1" value="${suggested || rec.net_pay || 0}"></div>
        <div><label>Payment Date</label><input type="date" id="pay-date" value="${rec.payment_date || _todayISO()}"></div>
        <div><label>Payment Mode</label><select id="pay-mode"><option value="BANK" ${rec.payment_mode==='BANK'?'selected':''}>Bank Transfer</option><option value="CASH" ${rec.payment_mode==='CASH'?'selected':''}>Cash</option><option value="UPI" ${rec.payment_mode==='UPI'?'selected':''}>UPI</option><option value="CHEQUE" ${rec.payment_mode==='CHEQUE'?'selected':''}>Cheque</option></select></div>
        <div><label>Remarks</label><input id="pay-remarks" value="${rec.payment_remarks||rec.remarks||''}" placeholder="Payment reference / note"></div>
      </div>
      <div style="background:#eff6ff;border-radius:8px;padding:10px;margin-top:14px;font-size:13px;color:#1d4ed8;">
        Partial payment is allowed. Status becomes PAID only when paid amount is equal to or greater than net payable.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIPayroll.savePayment('${recId}')">💾 Save Payment</button>
      </div>`);
  }

  async function savePayment(recId) {
    const st  = SSIApp.getState();
    const idx = (st.payroll||[]).findIndex(p=>p.id===recId);
    if (idx<0) return;
    const rec = st.payroll[idx];
    const amountNow = Math.max(0, _money(parseFloat(document.getElementById('pay-amount')?.value)||0));
    if (amountNow <= 0) { SSIApp.toast('Enter amount paid'); return; }
    const prevPaid = _paidAmount(rec);
    const newPaid = _money(prevPaid + amountNow);
    const balance = Math.max(0, _money((rec.net_pay||0) - newPaid));
    if (!st.payment_history) st.payment_history = [];
    st.payment_history.push({
      id: SSIApp.uid(), payroll_id: rec.id, emp_id: rec.emp_id, period: rec.period,
      amount: amountNow, payment_date: document.getElementById('pay-date')?.value || _todayISO(),
      payment_mode: document.getElementById('pay-mode')?.value || '',
      remarks: document.getElementById('pay-remarks')?.value.trim() || '',
      created_by: SSIApp.state.currentUser?.username || '', created_at: new Date().toISOString()
    });
    st.payroll[idx] = {
      ...rec,
      paid_amount: newPaid,
      balance_amount: balance,
      payment_date: document.getElementById('pay-date')?.value || _todayISO(),
      payment_mode: document.getElementById('pay-mode')?.value || '',
      payment_remarks: document.getElementById('pay-remarks')?.value.trim() || '',
      status: balance <= 0 ? 'PAID' : 'PARTIAL',
      updated_at: new Date().toISOString()
    };
    await SSIApp.saveState(st);
    SSIApp.audit('PAYROLL_PAYMENT', `Payment ₹${amountNow} for ${rec.emp_id} period ${rec.period}`);
    SSIApp.toast(balance <= 0 ? '✅ Payment completed' : `✅ Partial payment saved. Balance ₹${_fmt(balance)}`);
    SSIApp.closeModal();
    applyFilter();
  }

  async function markPaid(recId) { openPayment(recId); }

  /* ── Post-payment Revision ───────────────────────────────── */
  function openRevision(recId) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTS','ACCOUNTANT')) return;
    const st  = SSIApp.getState();
    const rec = (st.payroll||[]).find(p=>p.id===recId);
    if (!rec) return;
    const emp = _findEmp(st, rec);
    SSIApp.modal(`
      <h3 style="margin-bottom:14px;">🔁 Payroll Revision — ${emp?.name||rec.emp_name||''}</h3>
      <div style="background:#f8fafc;border-radius:10px;padding:12px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:13px;">
        <div>Paid Amount<br><b>₹${_fmt(_paidAmount(rec))}</b></div>
        <div>Current Net<br><b>₹${_fmt(rec.net_pay)}</b></div>
        <div>Period<br><b>${_fmtPeriod(rec.period)}</b></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label>Revised Net Pay ₹</label><input type="number" id="rev-net" step="1" value="${_money(rec.net_pay||0)}" oninput="SSIPayroll.previewRevision('${recId}')"></div>
        <div><label>Adjustment Option</label><select id="rev-option"><option value="SAME_MONTH">Recover/Pay in same month</option><option value="NEXT_MONTH">Adjust in next month</option><option value="WAIVE">Waive difference</option></select></div>
      </div>
      <label style="display:block;margin-top:12px;">Reason</label><input id="rev-reason" placeholder="Attendance correction / deduction correction / other reason">
      <div id="rev-preview" style="background:#fff7ed;border-radius:8px;padding:12px;margin-top:14px;font-size:13px;color:#9a3412;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIPayroll.saveRevision('${recId}')">💾 Save Revision</button>
      </div>`);
    previewRevision(recId);
  }

  function previewRevision(recId) {
    const st  = SSIApp.getState();
    const rec = (st.payroll||[]).find(p=>p.id===recId);
    if (!rec) return;
    const revised = _money(parseFloat(document.getElementById('rev-net')?.value)||0);
    const paid = _paidAmount(rec);
    const diff = _money(revised - paid);
    const el = document.getElementById('rev-preview');
    if (!el) return;
    if (diff > 0) el.innerHTML = `Employee should receive extra <b>₹${_fmt(diff)}</b>.`;
    else if (diff < 0) el.innerHTML = `Employee was overpaid by <b>₹${_fmt(Math.abs(diff))}</b>. Recover same month or next month.`;
    else el.innerHTML = `No difference.`;
  }

  async function saveRevision(recId) {
    const st  = SSIApp.getState();
    const idx = (st.payroll||[]).findIndex(p=>p.id===recId);
    if (idx<0) return;
    const rec = st.payroll[idx];
    const revised = _money(parseFloat(document.getElementById('rev-net')?.value)||0);
    const paid = _paidAmount(rec);
    const diff = _money(revised - paid);
    const option = document.getElementById('rev-option')?.value || 'SAME_MONTH';
    const reason = document.getElementById('rev-reason')?.value.trim() || 'Payroll revision';
    if (!st.payroll_revisions) st.payroll_revisions = [];
    const rev = { id: SSIApp.uid(), payroll_id: rec.id, emp_id: rec.emp_id, period: rec.period,
      old_net_pay: _money(rec.net_pay), paid_amount: paid, revised_net_pay: revised, difference: diff,
      adjustment_option: option, reason, revised_by: SSIApp.state.currentUser?.username||'', revised_at: new Date().toISOString() };
    st.payroll_revisions.push(rev);
    const updated = { ...rec, revised_net_pay: revised, revision_difference: diff, revision_status: option, revision_reason: reason, updated_at: new Date().toISOString() };
    if (option === 'SAME_MONTH') {
      updated.net_pay = revised;
      updated.balance_amount = Math.max(0, _money(revised - paid));
      updated.status = updated.balance_amount <= 0 ? 'PAID' : 'PARTIAL';
    } else if (option === 'NEXT_MONTH' && diff < 0) {
      if (!st.next_month_adjustments) st.next_month_adjustments = [];
      st.next_month_adjustments.push({ id: SSIApp.uid(), emp_id: rec.emp_id, source_period: rec.period, amount: Math.abs(diff), type: 'RECOVERY', reason, created_at: new Date().toISOString() });
    } else if (option === 'NEXT_MONTH' && diff > 0) {
      if (!st.next_month_adjustments) st.next_month_adjustments = [];
      st.next_month_adjustments.push({ id: SSIApp.uid(), emp_id: rec.emp_id, source_period: rec.period, amount: diff, type: 'ARREAR', reason, created_at: new Date().toISOString() });
    }
    st.payroll[idx] = updated;
    await SSIApp.saveState(st);
    SSIApp.audit('PAYROLL_REVISION', `Revision for ${rec.emp_id} ${rec.period}: ₹${diff}`);
    SSIApp.closeModal();
    SSIApp.toast('✅ Payroll revision saved with audit log');
    applyFilter();
  }

  /* ── Print Salary Slip ───────────────────────────────────── */
  function printSlip(recId) {
    const st  = SSIApp.getState();
    const rec = (st.payroll||[]).find(p=>p.id===recId);
    if (!rec) return;
    const emp  = _findEmp(st, rec);
    const { name: _n, code: _c, type: _t, unit: _u } = _empDisplay(emp, rec);
    const unit = (st.units||[]).find(u => u.id === emp?.unit_id);
    const perDay = _r2((rec.monthly_salary||0)/(rec.working_days||30));

    const slip = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Salary Slip</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;max-width:700px;margin:20px auto;}
      h2{text-align:center;margin-bottom:4px;color:#922B21;}
      .sub{text-align:center;color:#64748b;margin-bottom:16px;font-size:12px;}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;}
      td,th{padding:7px 10px;border:1px solid #e2e8f0;font-size:13px;}
      th{background:#FDECEA;color:#922B21;font-weight:700;}
      .row-label{background:#f8fafc;font-weight:600;width:50%;}
      .total{background:#8B1A1A;color:#fff;font-size:15px;font-weight:800;}
      .footer{border-top:2px solid #8B1A1A;margin-top:24px;padding-top:12px;font-size:11px;color:#64748b;display:flex;justify-content:space-between;}
      @media print{body{margin:0;}}
    </style></head><body>
    <h2>SSI Group — Salary Slip</h2>
    <div class="sub">Unit: ${_u||'—'} &nbsp;|&nbsp; Month: <b>${_fmtPeriod(rec.period)}</b></div>
    <table>
      <tr><td class="row-label">Employee Name</td><td>${_n}</td><td class="row-label">Employee Code</td><td>${_c}</td></tr>
      <tr><td class="row-label">Designation</td><td>${emp?.designation||'—'}</td><td class="row-label">Department</td><td>${emp?.department||'—'}</td></tr>
      <tr><td class="row-label">Category</td><td>${emp?.type||'—'}</td><td class="row-label">Bank Account</td><td>${emp?.bank_ac||'—'}</td></tr>
    </table>
    <table>
      <tr><th colspan="2">📅 Attendance</th><th colspan="2">💰 Earnings</th></tr>
      <tr><td class="row-label">Working Days (Month)</td><td>${rec.working_days}</td><td class="row-label">Monthly Salary</td><td>₹${_fmt(rec.monthly_salary)}</td></tr>
      <tr><td class="row-label">Present Days</td><td>${rec.present_days}</td><td class="row-label">Per Day Rate</td><td>₹${_fmt(perDay)}</td></tr>
      <tr><td class="row-label">Half Days</td><td>${rec.half_days}</td><td class="row-label">Basic Earnings</td><td>₹${_fmt(_r2(rec.gross_pay - rec.ot_amount))}</td></tr>
      <tr><td class="row-label">Leaves Taken</td><td>${rec.leave_days}</td><td class="row-label">OT Hours</td><td>${_fmt(rec.ot_hours)} hrs</td></tr>
      <tr><td class="row-label">Paid Leaves</td><td>${rec.paid_leaves}</td><td class="row-label">OT Amount (₹${_fmt(rec.ot_rate||0)}/hr)</td><td>₹${_fmt(rec.ot_amount)}</td></tr>
      <tr><td class="row-label">Absent Days</td><td>${rec.absent_days}</td><td class="row-label">Gross Pay</td><td><b>₹${_fmt(rec.gross_pay)}</b></td></tr>
    </table>
    <table>
      <tr><th colspan="2">📉 Deductions</th></tr>
      <tr><td class="row-label">💰 Advance / Loan Recovery</td><td>₹${_fmt(rec.advance||0)} ${rec.deduction_note?'('+rec.deduction_note+')':''}</td></tr>
      <tr><td class="row-label">📌 EPF (Employer 12%)</td><td>₹${_fmt(rec.epf_amount||0)}</td></tr>
      <tr><td class="row-label">🏥 ESI (Employee 0.75%)</td><td>₹${_fmt(rec.esi_amount||0)}${(rec.gross_pay||0)>21000?' <span style="font-size:10px;color:#94a3b8;">(N/A: Gross > ₹21,000)</span>':''}</td></tr>
      <tr><td class="row-label"><b>Total Deductions</b></td><td><b>₹${_fmt(rec.deductions||0)}</b></td></tr>
    </table>
    <table>
      <tr><td class="row-label">Arrear</td><td style="text-align:right;">₹${_fmt(rec.arrear_amount||0)}</td></tr>
      <tr class="total"><td>NET PAYABLE</td><td style="text-align:right;font-size:18px;">₹${_fmt(rec.net_pay)}</td></tr>
      <tr><td class="row-label">Paid Amount</td><td style="text-align:right;">₹${_fmt(_paidAmount(rec))}</td></tr>
      <tr><td class="row-label">Balance</td><td style="text-align:right;">₹${_fmt(_balanceAmount(rec))}</td></tr>
    </table>
    ${rec.payment_mode ? `<p style="font-size:12px;color:#64748b;">Payment Mode: ${rec.payment_mode} ${rec.payment_date?'| Date: '+rec.payment_date:''}</p>` : ''}
    <div class="footer">
      <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
      <span>Status: ${rec.status}</span>
      <span>Authorised Signatory</span>
    </div>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(slip); w.document.close(); }
  }

  /* ── Delete payroll record (ADMIN only, DRAFT/PROCESSED only) ── */
  async function deletePayroll(recId) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st  = SSIApp.getState();
    const rec = (st.payroll||[]).find(p=>p.id===recId);
    if (!rec) return;
    if (rec.status === 'PAID') { SSIApp.toast('❌ Cannot delete a PAID payroll record'); return; }
    const emp = _findEmp(st, rec);
    const ok  = await SSIApp.confirm(`Delete payroll for ${emp?.name||rec.emp_name||'this employee'} (${_fmtPeriod(rec.period)})? This cannot be undone.`);
    if (!ok) return;
    st.payroll = st.payroll.filter(p=>p.id!==recId);
    await SSIApp.saveState(st);
    SSIApp.audit('PAYROLL_DELETE', `Deleted payroll: ${rec.emp_id} period ${rec.period}`);
    SSIApp.toast('🗑️ Payroll record deleted');
    applyFilter();
  }


  /* ── Bulk Deduction Panel ───────────────────────────────── */
  function openBulkDeduction() {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTS','ACCOUNTANT')) return;
    const st = SSIApp.getState();
    const periods = [...new Set((st.payroll||[]).map(p=>p.period).filter(Boolean))].sort().reverse();
    const period = document.getElementById('pr-filter-period')?.value || periods[0] || '';
    const list = (st.payroll||[]).filter(p => !period || p.period === period);

    SSIApp.modal(`
      <h3 style="margin-bottom:14px;">➖ Deduction Panel</h3>
      <div style="background:#fef3c7;border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;color:#92400e;">
        Add/update deduction without deleting payroll history. Paid records are skipped.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div><label>Payroll Month</label><select id="bulk-ded-period">${periods.map(p=>`<option value="${p}" ${p===period?'selected':''}>${_fmtPeriod(p)}</option>`).join('')}</select></div>
        <div><label>Deduction Type</label><select id="bulk-ded-type"><option value="advance">Advance / Loan</option><option value="other_deduction">Other Deduction</option></select></div>
        <div><label>Amount ₹</label><input id="bulk-ded-amount" type="number" step="1" min="0" value="0"></div>
        <div><label>Employee</label><select id="bulk-ded-emp"><option value="">All unpaid records in month</option>${list.map(p=>`<option value="${p.id}">${p.emp_name||p.emp_code||p.emp_id}</option>`).join('')}</select></div>
      </div>
      <label>Deduction Note</label><input id="bulk-ded-note" placeholder="Reason for deduction" style="margin-bottom:14px;">
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIPayroll.saveBulkDeduction()">💾 Apply Deduction</button>
      </div>
    `);
  }

  async function saveBulkDeduction() {
    const st = SSIApp.getState();
    const period = document.getElementById('bulk-ded-period')?.value || '';
    const type = document.getElementById('bulk-ded-type')?.value || 'other_deduction';
    const amount = Math.max(0, _money(parseFloat(document.getElementById('bulk-ded-amount')?.value)||0));
    const recId = document.getElementById('bulk-ded-emp')?.value || '';
    const note = document.getElementById('bulk-ded-note')?.value.trim() || '';
    if (!period) { SSIApp.toast('Select payroll month'); return; }
    if (amount <= 0) { SSIApp.toast('Enter deduction amount'); return; }

    let changed = 0;
    (st.payroll||[]).forEach(p => {
      if (p.status === 'PAID') return;
      if (recId && p.id !== recId) return;
      if (!recId && p.period !== period) return;
      p[type] = _money(amount);
      p.deduction_note = note || p.deduction_note || '';
      const totalD = _money((p.advance||0) + (p.other_deduction||0) + (p.epf_amount||0) + (p.esi_amount||0));
      p.deductions = totalD;
      p.net_pay = Math.max(0, _money((p.gross_pay||0) - totalD));
      p.status = p.status === 'DRAFT' ? 'PROCESSED' : p.status;
      p.updated_at = new Date().toISOString();
      changed++;
    });
    if (!changed) { SSIApp.toast('No unpaid payroll records matched'); return; }
    await SSIApp.saveState(st);
    SSIApp.audit('PAYROLL_DEDUCTION', `Applied deduction to ${changed} records for ${period}`);
    SSIApp.closeModal();
    SSIApp.toast(`✅ Deduction applied to ${changed} payroll record(s)`);
    applyFilter();
  }

  /* ── Admin-only Salary Revision / Arrear ─────────────────── */
  function openSalaryRevision() {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st = SSIApp.getState();
    const emps = (st.employees||[]).filter(e=>e.active!==false);
    const current = new Date().toISOString().slice(0,7);
    SSIApp.modal(`
      <h3 style="margin-bottom:14px;">📈 Salary Revision / Arrear</h3>
      <div style="background:#eff6ff;border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;color:#1d4ed8;">
        Frozen past months will not be changed. Arrear is calculated and added to current selected payroll month.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label>Employee</label><select id="salrev-emp" onchange="SSIPayroll.previewSalaryRevision()"><option value="">Select employee</option>${emps.map(e=>`<option value="${e.id}" data-sal="${e.monthly_salary||0}">${e.emp_code||''} - ${e.name} (₹${_fmt(e.monthly_salary||0)})</option>`).join('')}</select></div>
        <div><label>Pay Arrear In Month</label><input type="month" id="salrev-paymonth" value="${current}" onchange="SSIPayroll.previewSalaryRevision()"></div>
        <div><label>Old Salary ₹</label><input type="number" id="salrev-old" step="1" value="0" oninput="SSIPayroll.previewSalaryRevision()"></div>
        <div><label>New Salary ₹</label><input type="number" id="salrev-new" step="1" value="0" oninput="SSIPayroll.previewSalaryRevision()"></div>
        <div><label>Effective From</label><input type="month" id="salrev-from" value="${current}" onchange="SSIPayroll.previewSalaryRevision()"></div>
        <div><label>Reason</label><select id="salrev-reason"><option>Annual Increment</option><option>Promotion</option><option>Salary Correction</option><option>Special Revision</option></select></div>
      </div>
      <label style="display:block;margin-top:12px;">Remarks</label><input id="salrev-remarks" placeholder="Approval / note">
      <div id="salrev-preview" style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:14px;font-size:13px;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIPayroll.saveSalaryRevision()">💾 Save Revision & Arrear</button>
      </div>`);
  }

  function previewSalaryRevision() {
    const empSel = document.getElementById('salrev-emp');
    const oldInput = document.getElementById('salrev-old');
    const newInput = document.getElementById('salrev-new');
    if (empSel && oldInput && Number(oldInput.value||0) === 0) {
      oldInput.value = empSel.selectedOptions[0]?.dataset?.sal || 0;
    }
    const oldSal = _money(parseFloat(oldInput?.value)||0);
    const newSal = _money(parseFloat(newInput?.value)||0);
    const from = document.getElementById('salrev-from')?.value;
    const payMonth = document.getElementById('salrev-paymonth')?.value;
    const months = _monthsBetweenInclusive(from, payMonth).filter(m => m <= payMonth);
    const diff = Math.max(0, _money(newSal - oldSal));
    const arrear = _money(diff * months.length);
    const el = document.getElementById('salrev-preview');
    if (el) el.innerHTML = `Salary difference: <b>₹${_fmt(diff)}</b> × ${months.length} month(s) = <b style="color:#0369a1;">₹${_fmt(arrear)} arrear</b><br><span style="color:#64748b;">Months: ${months.join(', ') || '—'}</span>`;
  }

  async function saveSalaryRevision() {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st = SSIApp.getState();
    const empId = document.getElementById('salrev-emp')?.value;
    const emp = (st.employees||[]).find(e=>e.id===empId);
    if (!emp) { SSIApp.toast('Select employee'); return; }
    const oldSal = _money(parseFloat(document.getElementById('salrev-old')?.value)||0);
    const newSal = _money(parseFloat(document.getElementById('salrev-new')?.value)||0);
    const from = document.getElementById('salrev-from')?.value;
    const payMonth = document.getElementById('salrev-paymonth')?.value;
    if (!from || !payMonth || newSal <= oldSal) { SSIApp.toast('Enter valid salary revision'); return; }
    const months = _monthsBetweenInclusive(from, payMonth);
    const arrear = _money((newSal - oldSal) * months.length);
    if (!st.salary_revisions) st.salary_revisions = [];
    const sr = { id: SSIApp.uid(), emp_id: empId, emp_name: emp.name||'', old_salary: oldSal, new_salary: newSal, effective_from: from, pay_month: payMonth, arrear_months: months, arrear_amount: arrear, reason: document.getElementById('salrev-reason')?.value||'', remarks: document.getElementById('salrev-remarks')?.value.trim()||'', revised_by: SSIApp.state.currentUser?.username||'', revised_at: new Date().toISOString() };
    st.salary_revisions.push(sr);
    emp.monthly_salary = newSal;

    // Add arrear to selected pay month payroll record if present; otherwise keep pending in arrears register.
    const rec = (st.payroll||[]).find(p=>p.emp_id===empId && p.period===payMonth);
    if (rec) {
      rec.arrear_amount = _money((rec.arrear_amount||0) + arrear);
      rec.gross_pay = _money((rec.gross_pay||0) + arrear);
      rec.net_pay = Math.max(0, _money((rec.net_pay||0) + arrear));
      rec.balance_amount = _balanceAmount(rec);
      rec.updated_at = new Date().toISOString();
    } else {
      if (!st.pending_arrears) st.pending_arrears = [];
      st.pending_arrears.push({ id: SSIApp.uid(), emp_id: empId, pay_month: payMonth, amount: arrear, salary_revision_id: sr.id, created_at: new Date().toISOString() });
    }
    await SSIApp.saveState(st);
    SSIApp.audit('SALARY_REVISION', `Salary revision ${emp.name}: ₹${oldSal} to ₹${newSal}, arrear ₹${arrear}`);
    SSIApp.closeModal();
    SSIApp.toast('✅ Salary revision and arrear saved');
    applyFilter();
  }

  function openRevisionLog() {
    const st = SSIApp.getState();
    const payRevs = st.payroll_revisions || [];
    const salRevs = st.salary_revisions || [];
    const rows1 = payRevs.slice().reverse().map(r=>`<tr><td>${_fmtPeriod(r.period)}</td><td>${r.emp_id}</td><td>₹${_fmt(r.old_net_pay)}</td><td>₹${_fmt(r.revised_net_pay)}</td><td>₹${_fmt(r.difference)}</td><td>${r.adjustment_option}</td><td>${r.reason||''}</td><td>${(r.revised_at||'').slice(0,10)}</td></tr>`).join('') || `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px;">No payroll revisions yet.</td></tr>`;
    const rows2 = salRevs.slice().reverse().map(r=>`<tr><td>${r.emp_name}</td><td>₹${_fmt(r.old_salary)}</td><td>₹${_fmt(r.new_salary)}</td><td>${r.effective_from}</td><td>${r.pay_month}</td><td>₹${_fmt(r.arrear_amount)}</td><td>${r.reason||''}</td><td>${(r.revised_at||'').slice(0,10)}</td></tr>`).join('') || `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px;">No salary revisions yet.</td></tr>`;
    SSIApp.modal(`<h3 style="margin-bottom:14px;">🧾 Payroll / Salary Revision Logs</h3>
      <h4>Post-payment payroll revisions</h4><div style="overflow:auto;max-height:230px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th>Period</th><th>Emp</th><th>Old Net</th><th>Revised Net</th><th>Diff</th><th>Option</th><th>Reason</th><th>Date</th></tr></thead><tbody>${rows1}</tbody></table></div>
      <h4 style="margin-top:18px;">Salary revision / arrears</h4><div style="overflow:auto;max-height:230px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th>Employee</th><th>Old</th><th>New</th><th>Effective</th><th>Paid In</th><th>Arrear</th><th>Reason</th><th>Date</th></tr></thead><tbody>${rows2}</tbody></table></div>
      <div style="text-align:right;margin-top:16px;"><button class="btn btn-secondary" onclick="SSIApp.closeModal()">Close</button></div>`);
  }

  /* ── Export ──────────────────────────────────────────────── */
  function exportExcel() {
    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const period  = document.getElementById('pr-filter-period')?.value || '';
    let list      = (st.payroll||[]).filter(p => {
      const emp = _findEmp(st, p);
      if (!isAdmin && emp?.type==='STAFF') return false;
      if (period && p.period!==period) return false;
      return true;
    });

    const headers = ['Period','Emp Code','Name','Type','Unit','Monthly Sal','Days Present','Half Days','Leaves','Paid Leaves','OT Hrs','OT Amt','Arrear','Deductions','Gross Pay','Net Pay','Paid Amount','Balance','Status','Payment Mode','Payment Date','Remarks'];
    const rows = [headers];
    list.forEach(p => {
      const emp  = _findEmp(st, p);
      const unit = (st.units||[]).find(u=>u.id===emp?.unit_id);
      rows.push([
        p.period, emp?.emp_code||p.emp_code||'', emp?.name||p.emp_name||'', emp?.type||p.emp_type||'', unit?.name||p.unit_name||'',
        _money(p.monthly_salary), p.present_days, p.half_days, p.leave_days, (p.payable_days ?? p.paid_leaves),
        _r2(p.ot_hours), _money(p.ot_amount), _money(p.arrear_amount||0), _money(p.deductions), _money(p.gross_pay), _money(p.net_pay), _paidAmount(p), _balanceAmount(p),
        p.status, p.payment_mode||'', p.payment_date||'', p.remarks||''
      ]);
    });
    SSIApp.excelDownload(rows, 'Payroll', `SSI_Payroll_${period||'All'}`);
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function _money(n) {
    return Math.round(Number(n) || 0);
  }
  function _fmt(n) {
    // Whole rupees only for payroll display
    const rounded = _money(n);
    return rounded.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:0});
  }
  function _fmtQty(n) {
    const v = _r2(n);
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  }
  function _fmtPeriod(ym) {
    if (!ym) return '';
    const [y,m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m)-1]} ${y}`;
  }
  function _statusBadge(s) {
    const map = {
      DRAFT:     {bg:'#f3f4f6',c:'#6b7280',l:'📝 Draft'},
      PROCESSED: {bg:'#fef3c7',c:'#92400e',l:'🔄 Processed'},
      PAID:      {bg:'#dcfce7',c:'#166534',l:'✅ Paid'},
      PARTIAL:   {bg:'#fff7ed',c:'#c2410c',l:'💳 Partial'},
      FROZEN:    {bg:'#eff6ff',c:'#1d4ed8',l:'🔒 Frozen'},
    };
    const v = map[s]||{bg:'#f3f4f6',c:'#6b7280',l:s};
    return `<span style="background:${v.bg};color:${v.c};padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">${v.l}</span>`;
  }


  /* ── Re-link Orphaned Payroll Records ────────────────────── */
  function openRelinkModal() {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st   = SSIApp.getState();
    const emps = (st.employees||[]).filter(e=>e.active!==false);

    const orphanGroups = {};
    (st.payroll||[]).forEach(p => {
      if (_findEmp(st, p)) return;
      if (!orphanGroups[p.emp_id]) {
        orphanGroups[p.emp_id] = { salary: p.monthly_salary, count: 0, ids: [] };
      }
      orphanGroups[p.emp_id].count++;
      orphanGroups[p.emp_id].ids.push(p.id);
    });

    const orphanList = Object.entries(orphanGroups);
    if (!orphanList.length) {
      SSIApp.toast('✅ No orphaned records — all payroll records are properly linked!');
      return;
    }

    const empOptions = emps.map(e =>
      `<option value="${e.id}">${e.emp_code} – ${e.name} (${e.type})</option>`
    ).join('');

    const rows = orphanList.map(([oldId, info], i) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 8px;font-size:12px;color:#64748b;">${info.count} record(s)<br>Salary: ₹${_fmt(info.salary||0)}</td>
        <td style="padding:10px 8px;">
          <select id="relink-sel-${i}" data-oldid="${oldId}" data-recids="${info.ids.join(',')}"
            style="width:100%;padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;">
            <option value="">— Select Employee —</option>
            ${empOptions}
          </select>
        </td>
      </tr>`).join('');

    SSIApp.modal(`
      <div style="padding:4px;">
        <h3 style="margin-bottom:4px;font-size:17px;font-weight:700;">🔗 Re-link Payroll Records</h3>
        <p style="color:#64748b;font-size:13px;margin-bottom:16px;">
          ${orphanList.length} group(s) of payroll records have no linked employee 
          (employees were deleted &amp; re-imported with new IDs).<br>
          Match each group to the correct employee below.
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Payroll Records</th>
              <th style="padding:8px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Assign to Employee</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="SSIPayroll.saveRelink()">✅ Save Links</button>
        </div>
      </div>
    `);
  }

  async function saveRelink() {
    const st   = SSIApp.getState();
    const emps = st.employees || [];
    let linked = 0;

    document.querySelectorAll('[data-oldid]').forEach(sel => {
      const newEmpId = sel.value;
      if (!newEmpId) return;
      const emp  = emps.find(e => e.id === newEmpId);
      if (!emp) return;
      const unit = (st.units||[]).find(u => u.id === emp.unit_id);
      const recIds = (sel.dataset.recids || '').split(',').filter(Boolean);

      recIds.forEach(rid => {
        const rec = (st.payroll||[]).find(p => p.id === rid);
        if (!rec) return;
        rec.emp_id    = emp.id;
        rec.emp_name  = emp.name || '';
        rec.emp_code  = emp.emp_code || '';
        rec.emp_type  = emp.type || '';
        rec.unit_name = unit?.name || '';
        linked++;
      });
    });

    if (!linked) { SSIApp.toast('⚠️ No employees selected — nothing saved'); return; }

    await SSIApp.saveState(st);
    SSIApp.closeModal();
    SSIApp.toast(`✅ Re-linked ${linked} payroll record(s) successfully`);
    SSIApp.audit('PAYROLL_RELINK', `Re-linked ${linked} orphaned payroll records`);
    applyFilter();
  }

  return {
    render, refresh, applyFilter,
    openGenerateModal, runGenerate,
    openEdit, saveEdit, _calcNet, openBulkDeduction, saveBulkDeduction, deletePayroll, markPaid, openPayment, savePayment,
    openRevision, previewRevision, saveRevision, openSalaryRevision, previewSalaryRevision, saveSalaryRevision, openRevisionLog,
    printSlip, exportExcel,
    openRelinkModal, saveRelink
  };
})();
