/* SSI Payroll Dashboard Module - Payroll Only */
const SSIDashboard = (() => {

  function money(n) {
    return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  }

  function fmtPeriod(ym) {
    if (!ym) return '';
    const [y,m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m)-1]} ${y}`;
  }

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }

    const st = SSIApp.getState();
    const payroll = st.payroll || [];
    const employees = (st.employees || []).filter(e => e.active !== false);
    const attendance = st.attendance || [];
    const periods = [...new Set(payroll.map(p => p.period).filter(Boolean))].sort().reverse();
    const activePeriod = periods[0] || new Date().toISOString().slice(0,7);
    const list = payroll.filter(p => p.period === activePeriod);

    const gross = list.reduce((s,p)=>s+(Number(p.gross_pay)||0),0);
    const net = list.reduce((s,p)=>s+(Number(p.net_pay)||0),0);
    const otAmt = list.reduce((s,p)=>s+(Number(p.ot_amount)||0),0);
    const deductions = list.reduce((s,p)=>s+(Number(p.deductions)||0),0);
    const paid = list.filter(p=>p.status==='PAID').length;

    const monthAtt = attendance.filter(a => (a.date||'').startsWith(activePeriod) && a.active !== false);
    const presentDays = monthAtt.filter(a => a.status === 'P').length;
    const absentDays = monthAtt.filter(a => a.status === 'A').length;
    const otHours = monthAtt.reduce((s,a)=>s+(Number(a.ot_hours)||0),0);

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">📊 Payroll Dashboard</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="SSIApp.navigate('attendance')">🗓️ Attendance Panel</button>
          <button class="btn btn-primary" onclick="SSIApp.navigate('payroll')">💰 Payroll Panel</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
          ${card('👥','Active Employees',employees.length,'Payroll employee master','#922B21')}
          ${card('📅','Payroll Month',fmtPeriod(activePeriod),'Latest generated month','#166534')}
          ${card('💰','Gross Pay',money(gross),'Current month','#0369a1')}
          ${card('✅','Net Payable',money(net),'After deductions','#166534')}
          ${card('⏱️','OT Amount',money(otAmt),`${otHours.toFixed(1)} OT hrs`,'#92400e')}
          ${card('➖','Deductions',money(deductions),'Advance / EPF / ESI / Other','#991b1b')}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
        <div class="card" style="padding:16px;">
          <h3 style="margin-bottom:12px;">🗓️ Attendance Snapshot</h3>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${mini('Present',presentDays,'#166534')}
            ${mini('Absent',absentDays,'#991b1b')}
            ${mini('Records',monthAtt.length,'#0369a1')}
          </div>
          <button class="btn btn-secondary" style="margin-top:14px;" onclick="SSIApp.navigate('attendance')">Open Attendance</button>
        </div>

        <div class="card" style="padding:16px;">
          <h3 style="margin-bottom:12px;">💰 Payroll Snapshot</h3>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${mini('Records',list.length,'#922B21')}
            ${mini('Paid',`${paid}/${list.length}`,'#166534')}
            ${mini('Draft',list.filter(p=>p.status==='DRAFT').length,'#92400e')}
          </div>
          <button class="btn btn-primary" style="margin-top:14px;" onclick="SSIApp.navigate('payroll')">Open Payroll</button>
        </div>
      </div>

      <div class="card" style="margin-top:16px;padding:16px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;">
        <b>Payroll-only system:</b> Sales, clients, products, inventory and dispatch data are hidden here. They remain in the separate SSI Operations app.
      </div>
    `;
  }

  function card(icon,label,value,sub,color) {
    return `<div style="background:#fff;padding:18px;border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,.06);border-left:4px solid ${color};">
      <div style="font-size:28px;">${icon}</div>
      <div style="font-size:26px;font-weight:800;color:${color};margin-top:8px;">${value}</div>
      <div style="font-size:13px;font-weight:700;color:#334155;">${label}</div>
      <div style="font-size:12px;color:#64748b;">${sub}</div>
    </div>`;
  }

  function mini(label,value,color) {
    return `<div style="background:#f8fafc;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:${color};">${value}</div>
      <div style="font-size:12px;color:#64748b;">${label}</div>
    </div>`;
  }

  return { render };
})();
