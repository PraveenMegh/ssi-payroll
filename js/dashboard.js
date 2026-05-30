/* SSI Payroll Dashboard Module - Payroll Only (Enhanced UI) */
const SSIDashboard = (() => {

  function money(n) {
    return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  }

  function num(n) {
    return Math.round(Number(n) || 0).toLocaleString('en-IN');
  }

  function fmtPeriod(ym) {
    if (!ym) return 'Current Month';
    const [y,m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m,10)-1] || m} ${y}`;
  }

  function todayYM() {
    return new Date().toISOString().slice(0,7);
  }

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }

    const st = SSIApp.getState();
    const payroll = Array.isArray(st.payroll) ? st.payroll : [];
    const employees = (st.employees || []).filter(e => e.active !== false);
    const attendance = Array.isArray(st.attendance) ? st.attendance : [];
    const periods = [...new Set(payroll.map(p => p.period).filter(Boolean))].sort().reverse();
    const activePeriod = periods[0] || todayYM();
    const list = payroll.filter(p => p.period === activePeriod && p.active !== false);

    const gross = list.reduce((s,p)=>s+(Number(p.gross_pay)||0),0);
    const net = list.reduce((s,p)=>s+(Number(p.net_pay)||0),0);
    const otAmt = list.reduce((s,p)=>s+(Number(p.ot_amount)||0),0);
    const arrears = list.reduce((s,p)=>s+(Number(p.arrear_amount)||0),0);
    const deductions = list.reduce((s,p)=>s+(Number(p.deductions)||0),0);
    const amountPaid = list.reduce((s,p)=>s+(Number(p.paid_amount ?? (String(p.status||'').toUpperCase()==='PAID' ? p.net_pay : 0))||0),0);
    const pendingAmount = Math.max(0, net - amountPaid);
    const paid = list.filter(p=>String(p.status||'').toUpperCase()==='PAID').length;
    const draft = list.filter(p=>String(p.status||'').toUpperCase()!=='PAID').length;

    const monthAtt = attendance.filter(a => (a.date||'').startsWith(activePeriod) && a.active !== false);
    const presentDays = monthAtt.filter(a => a.status === 'P').length;
    const absentDays = monthAtt.filter(a => a.status === 'A').length;
    const halfDays = monthAtt.filter(a => a.status === 'H').length;
    const leaveDays = monthAtt.filter(a => a.status === 'L').length;
    const otHours = monthAtt.reduce((s,a)=>s+(Number(a.ot_hours)||0),0);
    const payableUnits = monthAtt.reduce((s,a)=>s+(Number(a.paid_days ?? (a.status==='P'?1:a.status==='H'?0.5:0))||0),0);

    const avgNet = list.length ? net / list.length : 0;
    const payrollCoverage = employees.length ? Math.round((list.length / employees.length) * 100) : 0;
    const deductionPct = gross ? Math.round((deductions / gross) * 100) : 0;
    const paidPct = list.length ? Math.round((paid / list.length) * 100) : 0;

    const recentPayroll = [...list]
      .sort((a,b)=>Number(b.updated_at||b.created_at||0)-Number(a.updated_at||a.created_at||0))
      .slice(0,6);

    area.innerHTML = `
      <style>
        .paydash-hero{background:linear-gradient(135deg,#7f1d1d,#b91c1c 55%,#ef4444);color:#fff;border-radius:22px;padding:22px;box-shadow:0 18px 35px rgba(127,29,29,.22);margin-bottom:18px;position:relative;overflow:hidden;}
        .paydash-hero:after{content:"";position:absolute;right:-70px;top:-70px;width:210px;height:210px;border-radius:50%;background:rgba(255,255,255,.12);} 
        .paydash-title{font-size:28px;font-weight:900;margin:0;letter-spacing:-.02em;}
        .paydash-sub{opacity:.9;font-size:13px;margin-top:6px;max-width:760px;}
        .paydash-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;position:relative;z-index:1;}
        .paydash-action{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.16);color:#fff;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;backdrop-filter:blur(8px);} 
        .paydash-action.primary{background:#fff;color:#991b1b;border-color:#fff;}
        .paydash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px;}
        .paydash-card{background:#fff;border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.08);border:1px solid #eef2f7;position:relative;overflow:hidden;}
        .paydash-card:before{content:"";position:absolute;right:-28px;top:-28px;width:84px;height:84px;border-radius:50%;background:var(--soft,#fee2e2);} 
        .paydash-icon{font-size:28px;position:relative;z-index:1;}
        .paydash-value{font-size:26px;font-weight:900;color:var(--color,#991b1b);margin-top:8px;position:relative;z-index:1;}
        .paydash-label{font-size:13px;font-weight:800;color:#334155;margin-top:2px;position:relative;z-index:1;}
        .paydash-subtext{font-size:12px;color:#64748b;margin-top:3px;position:relative;z-index:1;}
        .paydash-two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-bottom:16px;}
        .paydash-panel{background:#fff;border:1px solid #eef2f7;border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.06);} 
        .paydash-panel h3{margin:0 0 14px 0;color:#111827;font-size:17px;}
        .paydash-mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:10px;}
        .paydash-mini{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:13px;text-align:center;}
        .paydash-mini b{display:block;font-size:22px;color:var(--color,#991b1b);}
        .paydash-mini span{display:block;font-size:12px;color:#64748b;margin-top:2px;}
        .paydash-bar{height:10px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-top:8px;}
        .paydash-fill{height:100%;background:linear-gradient(90deg,#991b1b,#ef4444);border-radius:999px;width:0%;}
        .paydash-table{width:100%;border-collapse:collapse;font-size:13px;}
        .paydash-table th{background:#f8fafc;color:#475569;text-align:left;padding:10px;border-bottom:1px solid #e2e8f0;font-size:12px;}
        .paydash-table td{padding:10px;border-bottom:1px solid #f1f5f9;color:#334155;}
        .paydash-pill{display:inline-block;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;background:#fee2e2;color:#991b1b;}
        .paydash-pill.ok{background:#dcfce7;color:#166534;}
        .paydash-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:16px;padding:14px;font-size:13px;}
        @media(max-width:850px){.paydash-two{grid-template-columns:1fr}.paydash-title{font-size:23px}.paydash-card{padding:15px}.paydash-value{font-size:22px}}
      </style>

      <div class="paydash-hero">
        <div style="position:relative;z-index:1;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h2 class="paydash-title">💰 Payroll Control Center</h2>
            <div class="paydash-sub">Live payroll summary for <b>${fmtPeriod(activePeriod)}</b>. Salary follows 30-day rule, Sunday included, and OT is calculated hourly.</div>
          </div>
          <div style="background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);border-radius:16px;padding:12px 16px;min-width:190px;text-align:center;">
            <div style="font-size:12px;opacity:.9;">Net Payable</div>
            <div style="font-size:28px;font-weight:900;">${money(net)}</div>
            <div style="font-size:11px;opacity:.85;">Paid: ${money(amountPaid)} | Pending: ${money(pendingAmount)}</div>
          </div>
        </div>
        <div class="paydash-actions">
          <button class="paydash-action primary" onclick="SSIApp.navigate('payroll')">💰 Open Payroll</button>
          <button class="paydash-action" onclick="SSIApp.navigate('attendance')">🗓️ Attendance Panel</button>
          <button class="paydash-action" onclick="SSIApp.navigate('employees')">👥 Employee Master</button>
          ${SSIApp.hasRole('ADMIN') ? `<button class="paydash-action" onclick="SSIApp.navigate('users')">👤 Users</button>` : ''}
        </div>
      </div>

      <div class="paydash-grid">
        ${card('👥','Active Employees',num(employees.length),'Payroll employee master','#991b1b','#fee2e2')}
        ${card('📅','Payroll Month',fmtPeriod(activePeriod),`${payrollCoverage}% payroll coverage`,'#0369a1','#e0f2fe')}
        ${card('💵','Gross Pay',money(gross),'Before deductions','#166534','#dcfce7')}
        ${card('✅','Net Payable',money(net),'Final payable amount','#15803d','#dcfce7')}
        ${card('⏱️','OT Amount',money(otAmt),`${Math.round(otHours)} OT hrs`,'#92400e','#ffedd5')}
        ${card('📈','Arrears',money(arrears),'Increment / revision arrears','#0369a1','#e0f2fe')}
        ${card('➖','Deductions',money(deductions),`${deductionPct}% of gross pay`,'#b91c1c','#fee2e2')}
        ${card('💳','Amount Paid',money(amountPaid),`${paid}/${list.length || 0} employees paid`,'#166534','#dcfce7')}
        ${card('⏳','Pending Payment',money(pendingAmount),'Balance payable','#c2410c','#ffedd5')}
      </div>

      <div class="paydash-two">
        <div class="paydash-panel">
          <h3>🗓️ Attendance Snapshot</h3>
          <div class="paydash-mini-grid">
            ${mini('Present Records',presentDays,'#166534')}
            ${mini('Half Days',halfDays,'#92400e')}
            ${mini('Absent Records',absentDays,'#b91c1c')}
            ${mini('Leave Records',leaveDays,'#0369a1')}
            ${mini('Payable Units',Math.round(payableUnits),'#7c3aed')}
            ${mini('Total Records',monthAtt.length,'#334155')}
          </div>
        </div>

        <div class="paydash-panel">
          <h3>📌 Payroll Status</h3>
          ${progress('Payroll generated', payrollCoverage)}
          ${progress('Marked paid', paidPct)}
          <div class="paydash-mini-grid" style="margin-top:14px;">
            ${mini('Payroll Records',list.length,'#991b1b')}
            ${mini('Paid',paid,'#166534')}
            ${mini('Pending/Draft',draft,'#92400e')}
            ${mini('Amount Paid',money(amountPaid),'#166534')}
            ${mini('Pending ₹',money(pendingAmount),'#c2410c')}
            ${mini('Avg Net Pay',money(avgNet),'#0369a1')}
          </div>
        </div>
      </div>

      <div class="paydash-two">
        <div class="paydash-panel">
          <h3>🧾 Recent Payroll Records</h3>
          ${recentTable(recentPayroll)}
        </div>
        <div class="paydash-panel">
          <h3>⚙️ Quick Actions</h3>
          <div style="display:grid;gap:10px;">
            <button class="btn btn-primary" onclick="SSIApp.navigate('payroll')">Generate / Review Payroll</button>
            <button class="btn btn-secondary" onclick="SSIApp.navigate('attendance')">Mark Attendance</button>
            <button class="btn btn-secondary" onclick="SSIApp.navigate('employees')">Add / Edit Employee</button>
            <button class="btn btn-secondary" onclick="SSIPayroll && SSIPayroll.openBulkDeduction ? SSIPayroll.openBulkDeduction() : SSIApp.navigate('payroll')">Apply Deduction</button>
          </div>
          <div class="paydash-note" style="margin-top:14px;">
            <b>Payroll rules active:</b><br>
            Salary ÷ 30 days. Sunday is included. Full salary is payable if all Monday–Saturday working days are present. OT = Monthly Salary ÷ 30 ÷ 8 × OT hours. Values are rounded to whole rupees.
          </div>
        </div>
      </div>

      <div class="paydash-note">
        <b>Payroll-only system:</b> sales, clients, products, inventory and dispatch modules are hidden here and remain in the separate SSI Operations app. Payroll history is not deleted.
      </div>
    `;
  }

  function card(icon,label,value,sub,color,soft) {
    return `<div class="paydash-card" style="--color:${color};--soft:${soft};">
      <div class="paydash-icon">${icon}</div>
      <div class="paydash-value">${value}</div>
      <div class="paydash-label">${label}</div>
      <div class="paydash-subtext">${sub}</div>
    </div>`;
  }

  function mini(label,value,color) {
    return `<div class="paydash-mini" style="--color:${color};"><b>${value}</b><span>${label}</span></div>`;
  }

  function progress(label,pct) {
    const safe = Math.max(0, Math.min(100, Number(pct)||0));
    return `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;font-weight:800;"><span>${label}</span><span>${safe}%</span></div>
      <div class="paydash-bar"><div class="paydash-fill" style="width:${safe}%;"></div></div>
    </div>`;
  }

  function recentTable(rows) {
    if (!rows.length) return `<div class="empty-state" style="padding:26px;"><div class="icon">📭</div><p>No payroll generated for this month yet.</p></div>`;
    return `<div style="overflow:auto;">
      <table class="paydash-table">
        <thead><tr><th>Employee</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><b>${r.emp_name || r.employee_name || r.emp_id || '-'}</b><br><span style="font-size:11px;color:#94a3b8;">${r.emp_id || ''}</span></td>
          <td>${money(r.gross_pay)}</td>
          <td>${money(r.deductions)}</td>
          <td><b>${money(r.net_pay)}</b></td>
          <td>${money(r.paid_amount ?? (String(r.status||'').toUpperCase()==='PAID'?r.net_pay:0))}</td>
          <td>${money(Math.max(0,(Number(r.net_pay)||0)-(Number(r.paid_amount ?? (String(r.status||'').toUpperCase()==='PAID'?r.net_pay:0))||0)))}</td>
          <td><span class="paydash-pill ${String(r.status||'').toUpperCase()==='PAID'?'ok':''}">${r.status || 'DRAFT'}</span></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  return { render };
})();
