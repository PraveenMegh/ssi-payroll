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
   ============================================================ */
const SSIPayroll = (() => {

  const PAID_LEAVES_STAFF = 2;
  const EPF_RATE  = 0.12;    // 12% employer EPF on basic
  const ESI_RATE  = 0.0075;  // 0.75% employee ESI on gross
  const ESI_LIMIT = 21000;   // ESI not applicable above ₹21,000 gross

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
    // Try monthly_salary, then bank+cash total
    const empBySal = {};
    emps.forEach(e => {
      const sal1 = e.monthly_salary || 0;
      const sal2 = (e.bank_salary||0) + (e.cash_salary||0);
      const sal  = sal1 > 0 ? sal1 : sal2;
      if (sal <= 0) return; // skip ₹0 salary employees (can't match)
      if (!empBySal[sal]) empBySal[sal] = [];
      empBySal[sal].push(e);
    });

    // Find broken records: emp_id not in current employees
    const brokenIds = new Set(
      recs.filter(p => !empById[p.emp_id] && !p.emp_code && !p.emp_name)
          .map(p => p.emp_id)
    );

    if (!brokenIds.size) return; // Nothing to repair

    // For each broken emp_id, collect all payroll records to determine salary
    const brokenMap = {}; // emp_id → { salary, type }
    recs.forEach(p => {
      if (!brokenIds.has(p.emp_id)) return;
      if (!brokenMap[p.emp_id]) brokenMap[p.emp_id] = { salary: p.monthly_salary, recs: [] };
      brokenMap[p.emp_id].recs.push(p);
    });

    // Track which employees are already matched (avoid double-linking)
    const matchedEmpIds = new Set(recs.filter(p => empById[p.emp_id]).map(p => p.emp_id));

    for (const [brokenEmpId, info] of Object.entries(brokenMap)) {
      const sal = info.salary;
      const candidates = (empBySal[sal] || []).filter(e => !matchedEmpIds.has(e.id));

      if (candidates.length !== 1) continue; // Ambiguous or no match — skip

      const emp  = candidates[0];
      const unit = (st.units || []).find(u => u.id === emp.unit_id);
      matchedEmpIds.add(emp.id);

      // Patch all payroll records for this broken emp_id
      info.recs.forEach(p => {
        p.emp_id    = emp.id;        // Fix the link
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
    // Auto-repair broken employee links (silent, saves only if needed)
    _repairPayrollLinks().then(() => {
      _doRefresh(area);
    });
  }

  function _doRefresh(area) {
    const st    = SSIApp.getState();
    const today = new Date().toISOString().slice(0,7);
    const isAdmin = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');  // ACCOUNTS: payroll workers only

    // Payroll records grouped by period
    const payrolls = st.payroll || [];
    // Unique periods
    const periods = [...new Set(payrolls.map(p=>p.period))].sort().reverse();

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">💰 Payroll</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="SSIPayroll.exportExcel()">📤 Export</button>
          <button class="btn btn-primary" onclick="SSIPayroll.openGenerateModal()">⚙️ Generate Payroll</button>
        </div>
      </div>

      <!-- Orphan warning banner -->
      <div id="pr-orphan-banner" style="display:none;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:#92400e;"></div>

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
            <th style="text-align:center;">Paid L</th>
            <th style="text-align:right;">OT Hrs</th>
            <th style="text-align:right;">OT Amt</th>
            <th style="text-align:right;">Deduct.</th>
            <th style="text-align:right;">Gross</th>
            <th style="text-align:right;">Net Pay</th>
            <th>Status</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="pr-tbody"><tr><td colspan="16" style="text-align:center;padding:40px;color:#94a3b8;">Select a month and generate payroll to begin.</td></tr></tbody>
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
      // ACCOUNTANT and ACCOUNTS see workers only
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

    // Summary
    const totalNet    = list.reduce((s,p)=>s+p.net_pay,0);
    const totalGross  = list.reduce((s,p)=>s+p.gross_pay,0);
    const totalOT     = list.reduce((s,p)=>s+p.ot_amount,0);
    const totalDeduct = list.reduce((s,p)=>s+p.deductions,0);
    const paidCount   = list.filter(p=>p.status==='PAID').length;

    const summaryEl = document.getElementById('pr-summary');
    if (summaryEl) summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;">
        <div style="background:#FDECEA;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#922B21;">${list.length}</div><div style="font-size:12px;color:#922B21;">Records</div></div>
        <div style="background:#dcfce7;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#166534;">₹${_fmt(totalGross)}</div><div style="font-size:12px;color:#166534;">Gross Pay</div></div>
        <div style="background:#fef3c7;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#92400e;">₹${_fmt(totalOT)}</div><div style="font-size:12px;color:#92400e;">OT Amount</div></div>
        <div style="background:#fee2e2;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#991b1b;">₹${_fmt(totalDeduct)}</div><div style="font-size:12px;color:#991b1b;">Deductions</div></div>
        <div style="background:#f0fdf4;padding:14px 16px;border-radius:10px;border:2px solid #166534;"><div style="font-size:22px;font-weight:800;color:#166534;">₹${_fmt(totalNet)}</div><div style="font-size:12px;color:#166534;">Net Payable</div></div>
        <div style="background:#f5f3ff;padding:14px 16px;border-radius:10px;"><div style="font-size:22px;font-weight:800;color:#5b21b6;">${paidCount}/${list.length}</div><div style="font-size:12px;color:#5b21b6;">Paid</div></div>
      </div>`;

    const tbody = document.getElementById('pr-tbody');
    if (!tbody) return;
    // Show warning if any visible records have no employee name (orphaned)
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

    if (!list.length) { tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;padding:40px;color:#94a3b8;">No payroll records found.</td></tr>`; return; }

    tbody.innerHTML = list.map(p => {
      const emp  = _findEmp(st, p);
      const { name: dName, code: dCode, type: dType, unit: dUnit } = _empDisplay(emp, p);
      const st_badge = _statusBadge(p.status);
      return `<tr>
        <td style="white-space:nowrap;">${_fmtPeriod(p.period)}</td>
        <td><b>${dName}</b><br><span style="font-size:11px;color:#64748b;">${dCode}</span></td>
        <td><span style="background:${dType==='STAFF'?'#FDECEA':'#dcfce7'};color:${dType==='STAFF'?'#922B21':'#166534'};padding:2px 7px;border-radius:10px;font-size:11px;">${dType}</span></td>
        <td>${dUnit}</td>
        <td style="text-align:right;">₹${_fmt(p.monthly_salary)}</td>
        <td style="text-align:center;">${p.present_days}</td>
        <td style="text-align:center;">${p.half_days}</td>
        <td style="text-align:center;">${p.leave_days}</td>
        <td style="text-align:center;color:#3730a3;font-weight:600;">${p.paid_leaves}</td>
        <td style="text-align:right;">${p.ot_hours}</td>
        <td style="text-align:right;color:#f59e0b;font-weight:600;">${p.ot_amount>0?'₹'+_fmt(p.ot_amount):'—'}</td>
        <td style="text-align:right;color:#991b1b;">${p.deductions>0?'₹'+_fmt(p.deductions):'—'}</td>
        <td style="text-align:right;font-weight:600;">₹${_fmt(p.gross_pay)}</td>
        <td style="text-align:right;font-weight:800;font-size:15px;color:#166534;">₹${_fmt(p.net_pay)}</td>
        <td>${st_badge}</td>
        <td style="white-space:nowrap;">
          ${p.status!=='PAID' ? `<button class="btn btn-secondary btn-sm" onclick="SSIPayroll.openEdit('${p.id}')" title="Edit deductions/remarks">✏️</button>` : ''}
                    ${(p.status!=='PAID'&&SSIApp.hasRole('ADMIN')) ? `<button class="btn btn-danger btn-sm" onclick="SSIPayroll.deletePayroll('${p.id}')" title="Delete record">🗑️</button>` : ''}
          ${p.status!=='PAID' ? `<button class="btn btn-primary btn-sm" onclick="SSIPayroll.markPaid('${p.id}')" title="Mark as Paid" style="font-size:11px;">✅ Paid</button>` : ''}
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
          <b>ℹ️ OT Rate</b><br>Auto = Monthly ÷ days ÷ 8 hrs<br>e.g. ₹15,000 salary in 31-day month = ₹60.48/hr</div>
      </div>
      <div style="background:#fef3c7;border-radius:8px;padding:12px;font-size:13px;margin-bottom:16px;">
        <b>ℹ️ Rules applied:</b><br>
        • Per day salary = Monthly ÷ actual days in selected month (28/29/30/31)<br>
        • OT rate = (Monthly Salary ÷ days ÷ 8) per hour — auto-calculated<br>
        • Staff: up to ${PAID_LEAVES_STAFF} leaves/month counted as Present<br>
        • Workers: overtime eligible (Staff: no OT)<br>
        • EPF = 12% of basic earnings (employer), ESI = 0.75% if Gross ≤ ₹21,000<br>
        • Half day = 0.5 day pay<br>
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
    // OT rate is auto-calculated per employee (monthly / daysInMonth / 8)
    if (!month) { SSIApp.toast('Select month'); return; }

    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');  // ACCOUNTS: workers only
    if (!st.payroll) st.payroll = [];

    let emps = (st.employees||[]).filter(e=>e.active!==false);
    if (!isAdmin) emps = emps.filter(e=>e.type==='WORKER');  // Accountant/Accounts: workers only
    if (typeF)    emps = emps.filter(e=>e.type===typeF);
    if (unitF)    emps = emps.filter(e=>e.unit_id===unitF);

    if (!emps.length) { SSIApp.toast('No employees match the filter'); return; }

    const [yr, mo]    = month.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const days        = Array.from({length:daysInMonth},(_,i)=>{
      const d = String(i+1).padStart(2,'0');
      return `${yr}-${String(mo).padStart(2,'0')}-${d}`;
    });

    // Build attendance lookup for this month
    const attRecs = (st.attendance||[]).filter(a=>a.date&&a.date.startsWith(month));
    const attMap  = {};
    attRecs.forEach(a => { attMap[`${a.emp_id}|${a.date}`] = a; });

    let generated = 0, skipped = 0;

    emps.forEach(emp => {
      // Check if PAID already → skip
      const existPaid = st.payroll.find(p=>p.emp_id===emp.id&&p.period===month&&p.status==='PAID');
      if (existPaid) { skipped++; return; }

      let present=0, half=0, leaves=0, absent=0, woff=0, otHours=0;
      days.forEach(d => {
        const rec = attMap[`${emp.id}|${d}`];
        const s   = rec?.status || 'A';
        if (s==='P')           { present++; if(rec?.ot_hours) otHours+=Number(rec.ot_hours); }
        else if (s==='A')      absent++;
        else if (s==='H')      { half++; if(rec?.ot_hours) otHours+=Number(rec.ot_hours); }
        else if (s==='L')      leaves++;
        else if (s==='WO'||s==='HD') woff++;
      });

      // Paid leaves for STAFF (max 2)
      const paidLeaves = emp.type==='STAFF' ? Math.min(leaves, PAID_LEAVES_STAFF) : 0;

      // Effective working days for salary calc
      const effectiveDays = present + (half * 0.5) + paidLeaves;
      const perDay        = Math.round(((emp.monthly_salary||0) / daysInMonth) * 100) / 100;
      const otRate        = Math.round(((emp.monthly_salary||0) / daysInMonth / 8) * 100) / 100;
      const grossBase     = Math.round(perDay * effectiveDays * 100) / 100;
      const otAmount      = emp.type==='WORKER' ? Math.round(otHours * otRate * 100) / 100 : 0;
      const grossPay      = Math.round((grossBase + otAmount) * 100) / 100;

      // Existing deductions — keep if re-generating non-paid
      const existing      = st.payroll.find(p=>p.emp_id===emp.id&&p.period===month);
      const advance       = existing?.advance || 0;
      const epfAmount     = Math.round(grossBase * EPF_RATE * 100) / 100;
      const esiAmount     = grossPay <= ESI_LIMIT ? Math.round(grossPay * ESI_RATE * 100) / 100 : 0;
      const totalDeduct   = Math.round((advance + epfAmount + esiAmount) * 100) / 100;
      const deductions    = totalDeduct;  // for backward compat field
      const netPay        = Math.max(0, Math.round((grossPay - totalDeduct) * 100) / 100);

      const rec = {
        id:             existing?.id || SSIApp.uid(),
        emp_id:         emp.id,
        emp_name:       emp.name||'',
        emp_code:       emp.emp_code||'',
        emp_type:       emp.type||'',
        unit_name:      (SSIApp.getState().units||[]).find(u=>u.id===emp.unit_id)?.name||'',
        period:         month,
        monthly_salary: emp.monthly_salary||0,
        working_days:   daysInMonth,
        present_days:   present,
        half_days:      half,
        leave_days:     leaves,
        paid_leaves:    paidLeaves,
        absent_days:    absent,
        week_offs:      woff,
        ot_hours:       otHours,
        ot_rate:        otRate,
        ot_amount:      otAmount,
        gross_pay:      grossPay,
        advance:        advance,
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

    // Set filter to the generated month
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
          <input type="number" id="edit-advance" value="${rec.advance||0}" min="0" oninput="SSIPayroll._calcNet()">
        </div>
        <div>
          <label>📌 EPF (12% of Basic) <span style="font-size:10px;color:#64748b;">auto</span></label>
          <input type="number" id="edit-epf" value="${rec.epf_amount||0}" min="0" step="0.01" oninput="SSIPayroll._calcNet()">
        </div>
        <div>
          <label>🏥 ESI (0.75% if ≤₹21K) <span style="font-size:10px;color:#64748b;">auto</span></label>
          <input type="number" id="edit-esi" value="${rec.esi_amount||0}" min="0" step="0.01" oninput="SSIPayroll._calcNet()">
        </div>
        <div>
          <label>📝 Deduction Note</label>
          <input id="edit-deduct-note" value="${rec.deduction_note||''}" placeholder="e.g. Advance recovery">
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
        <span id="edit-net-preview" data-gross="${rec.gross_pay}" style="font-size:20px;font-weight:800;color:#922B21;">₹${_fmt(rec.net_pay||rec.gross_pay)}</span>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-secondary" onclick="SSIApp.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SSIPayroll.saveEdit('${recId}')">💾 Save</button>
      </div>`);
  }

  function _calcNet() {
    const adv = parseFloat(document.getElementById('edit-advance')?.value)||0;
    const epf = parseFloat(document.getElementById('edit-epf')?.value)||0;
    const esi = parseFloat(document.getElementById('edit-esi')?.value)||0;
    const gross = parseFloat(document.getElementById('edit-net-preview')?.dataset?.gross || 0);
    const n = Math.max(0, gross - adv - epf - esi);
    const el = document.getElementById('edit-net-preview');
    if (el) { el.textContent = '₹' + n.toLocaleString('en-IN',{maximumFractionDigits:2}); }
  }

  async function saveEdit(recId) {
    const st  = SSIApp.getState();
    const idx = (st.payroll||[]).findIndex(p=>p.id===recId);
    if (idx<0) return;
    const rec     = st.payroll[idx];
    const advance = Math.max(0, parseFloat(document.getElementById('edit-advance')?.value)||0);
    const epf     = Math.max(0, parseFloat(document.getElementById('edit-epf')?.value)||0);
    const esi     = Math.max(0, parseFloat(document.getElementById('edit-esi')?.value)||0);
    const totalD  = Math.round((advance + epf + esi)*100)/100;
    const netPay  = Math.max(0, Math.round((rec.gross_pay - totalD)*100)/100);

    st.payroll[idx] = {
      ...rec,
      advance,
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

  /* ── Mark as Paid ────────────────────────────────────────── */
  async function markPaid(recId) {
    const st  = SSIApp.getState();
    const idx = (st.payroll||[]).findIndex(p=>p.id===recId);
    if (idx<0) return;
    const ok  = await SSIApp.confirm(`Mark this payroll as PAID?\nPayment date: ${new Date().toLocaleDateString('en-IN')}\nThis cannot be undone.`);
    if (!ok) return;
    st.payroll[idx] = { ...st.payroll[idx], status:'PAID', payment_date: new Date().toISOString().slice(0,10) };
    await SSIApp.saveState(st);
    SSIApp.audit('PAYROLL_PAID', `Marked paid: ${st.payroll[idx].emp_id} period ${st.payroll[idx].period}`);
    SSIApp.toast('✅ Marked as Paid');
    applyFilter();
  }

  /* ── Print Salary Slip ───────────────────────────────────── */
  function printSlip(recId) {
    const st  = SSIApp.getState();
    const rec = (st.payroll||[]).find(p=>p.id===recId);
    if (!rec) return;
    const emp  = _findEmp(st, rec);
    const { name: _n, code: _c, type: _t, unit: _u } = _empDisplay(emp, rec);
    const perDay = ((rec.monthly_salary||0)/(rec.working_days||30)).toFixed(2);

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
    <div class="sub">Unit: ${unit?.name||'—'} &nbsp;|&nbsp; Month: <b>${_fmtPeriod(rec.period)}</b></div>
    <table>
      <tr><td class="row-label">Employee Name</td><td>${_n}</td><td class="row-label">Employee Code</td><td>${_c}</td></tr>
      <tr><td class="row-label">Designation</td><td>${emp?.designation||'—'}</td><td class="row-label">Department</td><td>${emp?.department||'—'}</td></tr>
      <tr><td class="row-label">Category</td><td>${emp?.type||'—'}</td><td class="row-label">Bank Account</td><td>${emp?.bank_ac||'—'}</td></tr>
    </table>
    <table>
      <tr><th colspan="2">📅 Attendance</th><th colspan="2">💰 Earnings</th></tr>
      <tr><td class="row-label">Working Days (Month)</td><td>${rec.working_days}</td><td class="row-label">Monthly Salary</td><td>₹${_fmt(rec.monthly_salary)}</td></tr>
      <tr><td class="row-label">Present Days</td><td>${rec.present_days}</td><td class="row-label">Per Day Rate</td><td>₹${perDay}</td></tr>
      <tr><td class="row-label">Half Days</td><td>${rec.half_days}</td><td class="row-label">Basic Earnings</td><td>₹${_fmt(rec.gross_pay - rec.ot_amount)}</td></tr>
      <tr><td class="row-label">Leaves Taken</td><td>${rec.leave_days}</td><td class="row-label">OT Hours</td><td>${rec.ot_hours} hrs</td></tr>
      <tr><td class="row-label">Paid Leaves</td><td>${rec.paid_leaves}</td><td class="row-label">OT Amount (₹${(rec.ot_rate||0).toFixed(2)}/hr)</td><td>₹${_fmt(rec.ot_amount)}</td></tr>
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
      <tr class="total"><td>NET PAY</td><td style="text-align:right;font-size:18px;">₹${_fmt(rec.net_pay)}</td></tr>
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

    const headers = ['Period','Emp Code','Name','Type','Unit','Monthly Sal','Days Present','Half Days','Leaves','Paid Leaves','OT Hrs','OT Amt','Deductions','Gross Pay','Net Pay','Status','Payment Mode','Payment Date','Remarks'];
    const rows = [headers];
    list.forEach(p => {
      const emp  = _findEmp(st, p);
      const unit = (st.units||[]).find(u=>u.id===emp?.unit_id);
      rows.push([
        p.period, emp?.emp_code||p.emp_code||'', emp?.name||p.emp_name||'', emp?.type||p.emp_type||'', unit?.name||p.unit_name||'',
        p.monthly_salary, p.present_days, p.half_days, p.leave_days, p.paid_leaves,
        p.ot_hours, p.ot_amount, p.deductions, p.gross_pay, p.net_pay,
        p.status, p.payment_mode||'', p.payment_date||'', p.remarks||''
      ]);
    });
    SSIApp.excelDownload(rows, 'Payroll', `SSI_Payroll_${period||'All'}`);
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function _fmt(n) {
    return (n||0).toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2});
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
    };
    const v = map[s]||{bg:'#f3f4f6',c:'#6b7280',l:s};
    return `<span style="background:${v.bg};color:${v.c};padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">${v.l}</span>`;
  }


  /* ── Re-link Orphaned Payroll Records ───────────────────────
     When employees are deleted+reimported, payroll emp_ids break.
     This modal lets admin manually map each orphaned emp_id to
     the correct current employee.                              */
  function openRelinkModal() {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st   = SSIApp.getState();
    const emps = (st.employees||[]).filter(e=>e.active!==false);

    // Find unique orphaned emp_ids (not found by any lookup tier)
    const orphanGroups = {};
    (st.payroll||[]).forEach(p => {
      if (_findEmp(st, p)) return; // already linked — skip
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
        <td style="padding:10px 8px;font-size:12px;color:#64748b;">${info.count} record(s)<br>Salary: ₹${(info.salary||0).toLocaleString('en-IN')}</td>
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

    // Collect all select elements with data-oldid
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
    openEdit, saveEdit, _calcNet, deletePayroll, markPaid,
    printSlip, exportExcel,
    openRelinkModal, saveRelink
  };
})();
