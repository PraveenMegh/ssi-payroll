/* SSI Reports Module — includes Demand Analysis + Payroll Report */
const SSIReports = (() => {

  /* ── Tab list — payroll tab shown only to ADMIN / ACCOUNTANT ── */
  function _tabs() {
    const isPayrollUser = SSIApp.hasRole('ADMIN','ACCOUNTANT');
    const tabs = [
      { id:'monthly',     label:'📅 Monthly Sales'    },
      { id:'demand',      label:'📊 Demand Analysis'  },
      { id:'inventory',   label:'🏭 Inventory'        },
      { id:'salesperson', label:'👤 Salesperson'      },
    ];
    if (isPayrollUser) tabs.push({ id:'payroll', label:'💰 Payroll' });
    return tabs;
  }

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    const tabs = _tabs();
    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">📈 Reports & Analytics</h2>
      </div>

      <!-- Report Tabs -->
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;">
        ${tabs.map((t,i)=>
          `<button id="rpt-tab-${t.id}" onclick="SSIReports.showReport('${t.id}')"
            style="padding:12px 20px;border:none;background:none;font-size:13px;font-weight:${i===0?'700':'600'};color:${i===0?'#C0392B':'#64748b'};border-bottom:3px solid ${i===0?'#C0392B':'transparent'};cursor:pointer;margin-bottom:-2px;white-space:nowrap;">
            ${t.label}
          </button>`
        ).join('')}
      </div>

      <div id="report-area"></div>`;

    // ACCOUNTANT lands on payroll tab directly
    showReport(SSIApp.hasRole('ADMIN') ? 'monthly' : 'payroll');
  }

  function showReport(type) {
    _tabs().forEach(t => {
      const btn = document.getElementById(`rpt-tab-${t.id}`);
      if (!btn) return;
      const active = t.id === type;
      btn.style.color          = active ? '#C0392B' : '#64748b';
      btn.style.borderBottomColor = active ? '#C0392B' : 'transparent';
      btn.style.fontWeight     = active ? '700' : '600';
    });

    const area = document.getElementById('report-area');
    if (!area) return;

    if      (type === 'monthly')     renderMonthly(area);
    else if (type === 'demand')      renderDemand(area);
    else if (type === 'inventory')   renderInventoryReport(area);
    else if (type === 'salesperson') renderSalesperson(area);
    else if (type === 'payroll')     renderPayroll(area);
  }

  // ─── Payroll Report ────────────────────────────────────────
  function renderPayroll(area) {
    const st       = SSIApp.getState();
    const isAdmin  = SSIApp.hasRole('ADMIN');
    const today    = new Date().toISOString().slice(0,7);

    // Periods available
    const periods  = [...new Set((st.payroll||[]).map(p=>p.period))].sort().reverse();

    area.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <h3 style="font-size:16px;font-weight:700;color:#111827;">💰 Payroll Report</h3>
        <button class="btn btn-secondary btn-sm" onclick="SSIReports.exportPayrollReport()">📤 Export</button>
      </div>

      <!-- Filters -->
      <div class="card" style="padding:16px;margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
          <div>
            <label>Month</label>
            <select id="rpt-pr-period" onchange="SSIReports.refreshPayroll()">
              <option value="">All Months</option>
              ${periods.map(p=>`<option value="${p}" ${p===today?'selected':''}>${_fmtPeriod(p)}</option>`).join('')}
            </select>
          </div>
          ${isAdmin ? `
          <div>
            <label>Employee Type</label>
            <select id="rpt-pr-type" onchange="SSIReports.refreshPayroll()">
              <option value="">All</option>
              <option value="STAFF">👔 Staff</option>
              <option value="WORKER">👷 Workers</option>
            </select>
          </div>` : `<input type="hidden" id="rpt-pr-type" value="WORKER">`}
          <div>
            <label>Unit</label>
            <select id="rpt-pr-unit" onchange="SSIReports.refreshPayroll()">
              <option value="">All Units</option>
              ${(st.units||[]).filter(u=>u.active).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select id="rpt-pr-status" onchange="SSIReports.refreshPayroll()">
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="PROCESSED">Processed</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div id="rpt-pr-summary" style="margin-bottom:16px;"></div>

      <!-- Chart -->
      <div id="rpt-pr-chart" style="margin-bottom:16px;"></div>

      <!-- Table -->
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Period</th>
            <th>Employee</th>
            <th>Type</th>
            <th>Unit</th>
            <th style="text-align:right;">Monthly Sal.</th>
            <th style="text-align:center;">Present</th>
            <th style="text-align:center;">Paid L</th>
            <th style="text-align:right;">OT Amt</th>
            <th style="text-align:right;">Deduct.</th>
            <th style="text-align:right;">Gross</th>
            <th style="text-align:right;">Net Pay</th>
            <th>Status</th>
          </tr></thead>
          <tbody id="rpt-pr-tbody">
            <tr><td colspan="12" style="text-align:center;padding:40px;color:#94a3b8;">Select filters above to view payroll report.</td></tr>
          </tbody>
        </table>
        <div id="rpt-pr-footer" style="padding:10px 16px;font-size:13px;color:#64748b;text-align:right;"></div>
      </div>`;

    // Auto-load current month if it exists
    if (periods.includes(today)) {
      document.getElementById('rpt-pr-period').value = today;
    }
    refreshPayroll();
  }

  function refreshPayroll() {
    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const period  = document.getElementById('rpt-pr-period')?.value  || '';
    const typeF   = document.getElementById('rpt-pr-type')?.value    || '';
    const unitF   = document.getElementById('rpt-pr-unit')?.value    || '';
    const statusF = document.getElementById('rpt-pr-status')?.value  || '';

    let list = (st.payroll||[]).filter(p => {
      const emp = (st.employees||[]).find(e=>e.id===p.emp_id);
      if (!isAdmin && emp?.type === 'STAFF') return false;   // ACCOUNTANT: workers only
      if (period  && p.period       !== period)  return false;
      if (typeF   && emp?.type      !== typeF)   return false;
      if (unitF   && emp?.unit_id   !== unitF)   return false;
      if (statusF && p.status       !== statusF) return false;
      return true;
    }).sort((a,b) => {
      if (b.period !== a.period) return b.period.localeCompare(a.period);
      const ea = (st.employees||[]).find(e=>e.id===a.emp_id);
      const eb = (st.employees||[]).find(e=>e.id===b.emp_id);
      return (ea?.name||'').localeCompare(eb?.name||'');
    });

    // ── Summary cards ──
    const totalGross  = list.reduce((s,p)=>s+p.gross_pay,0);
    const totalNet    = list.reduce((s,p)=>s+p.net_pay,0);
    const totalOT     = list.reduce((s,p)=>s+p.ot_amount,0);
    const totalDeduct = list.reduce((s,p)=>s+p.deductions,0);
    const paidCount   = list.filter(p=>p.status==='PAID').length;
    const pendingAmt  = list.filter(p=>p.status!=='PAID').reduce((s,p)=>s+p.net_pay,0);
    const staffCount  = list.filter(p=>(st.employees||[]).find(e=>e.id===p.emp_id)?.type==='STAFF').length;
    const workerCount = list.filter(p=>(st.employees||[]).find(e=>e.id===p.emp_id)?.type==='WORKER').length;

    const summaryEl = document.getElementById('rpt-pr-summary');
    if (summaryEl) summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;">
        <div style="background:#FDECEA;padding:14px;border-radius:10px;">
          <div style="font-size:22px;font-weight:800;color:#922B21;">${list.length}</div>
          <div style="font-size:12px;color:#922B21;">Records${isAdmin&&list.length?` (${staffCount} Staff · ${workerCount} Workers)`:''}</div>
        </div>
        <div style="background:#dcfce7;padding:14px;border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:#166534;">₹${_fmt(totalGross)}</div>
          <div style="font-size:12px;color:#166534;">Gross Pay</div>
        </div>
        <div style="background:#fef3c7;padding:14px;border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:#92400e;">₹${_fmt(totalOT)}</div>
          <div style="font-size:12px;color:#92400e;">OT Amount</div>
        </div>
        <div style="background:#fee2e2;padding:14px;border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:#991b1b;">₹${_fmt(totalDeduct)}</div>
          <div style="font-size:12px;color:#991b1b;">Deductions</div>
        </div>
        <div style="background:#f0fdf4;padding:14px;border-radius:10px;border:2px solid #166534;">
          <div style="font-size:20px;font-weight:800;color:#166534;">₹${_fmt(totalNet)}</div>
          <div style="font-size:12px;color:#166534;">Net Payable</div>
        </div>
        <div style="background:#fef9c3;padding:14px;border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:#713f12;">₹${_fmt(pendingAmt)}</div>
          <div style="font-size:12px;color:#713f12;">Pending Payment</div>
        </div>
        <div style="background:#f5f3ff;padding:14px;border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:#5b21b6;">${paidCount}/${list.length}</div>
          <div style="font-size:12px;color:#5b21b6;">Paid</div>
        </div>
      </div>`;

    // ── Bar chart — net pay per employee (top 10) ──
    const chartEl = document.getElementById('rpt-pr-chart');
    if (chartEl && list.length) {
      const top10   = [...list].sort((a,b)=>b.net_pay-a.net_pay).slice(0,10);
      const maxNet  = Math.max(...top10.map(p=>p.net_pay), 1);
      chartEl.innerHTML = `
        <div class="card" style="margin-bottom:0;">
          <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:16px;">🏆 Net Pay — Top Employees</div>
          <div style="display:flex;align-items:flex-end;gap:6px;height:160px;overflow-x:auto;">
            ${top10.map(p => {
              const emp  = (st.employees||[]).find(e=>e.id===p.emp_id);
              const h    = Math.round((p.net_pay/maxNet)*140);
              const col  = emp?.type==='STAFF' ? '#C0392B' : '#16a34a';
              return `<div style="flex:1;min-width:50px;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="font-size:10px;color:#64748b;font-weight:600;">₹${_fmtK(p.net_pay)}</div>
                <div style="width:100%;height:${Math.max(h,4)}px;background:${col};border-radius:4px 4px 0 0;" title="${emp?.name}: ₹${_fmt(p.net_pay)}"></div>
                <div style="font-size:10px;color:#64748b;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px;" title="${emp?.name||''}">${emp?.name?.split(' ')[0]||'?'}</div>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:16px;margin-top:10px;font-size:12px;">
            <span><span style="display:inline-block;width:12px;height:12px;background:#C0392B;border-radius:2px;margin-right:4px;"></span>Staff</span>
            <span><span style="display:inline-block;width:12px;height:12px;background:#16a34a;border-radius:2px;margin-right:4px;"></span>Worker</span>
          </div>
        </div>`;
    } else if (chartEl) {
      chartEl.innerHTML = '';
    }

    // ── Table rows ──
    const tbody = document.getElementById('rpt-pr-tbody');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:40px;color:#94a3b8;">No payroll records found for selected filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const emp  = (st.employees||[]).find(e=>e.id===p.emp_id);
      const unit = (st.units||[]).find(u=>u.id===emp?.unit_id);
      return `<tr>
        <td style="white-space:nowrap;">${_fmtPeriod(p.period)}</td>
        <td><b>${emp?.name||'?'}</b><br><span style="font-size:11px;color:#64748b;">${emp?.emp_code||''}</span></td>
        <td><span style="background:${emp?.type==='STAFF'?'#FDECEA':'#dcfce7'};color:${emp?.type==='STAFF'?'#922B21':'#166534'};padding:2px 7px;border-radius:10px;font-size:11px;">${emp?.type||''}</span></td>
        <td>${unit?.name||'—'}</td>
        <td style="text-align:right;">₹${_fmt(p.monthly_salary)}</td>
        <td style="text-align:center;">${p.present_days}${p.half_days?`<span style="font-size:11px;color:#92400e;"> +${p.half_days}H</span>`:''}</td>
        <td style="text-align:center;color:#3730a3;font-weight:600;">${p.paid_leaves||0}</td>
        <td style="text-align:right;color:#f59e0b;font-weight:600;">${p.ot_amount>0?'₹'+_fmt(p.ot_amount):'—'}</td>
        <td style="text-align:right;color:#991b1b;">${p.deductions>0?'₹'+_fmt(p.deductions):'—'}</td>
        <td style="text-align:right;font-weight:600;">₹${_fmt(p.gross_pay)}</td>
        <td style="text-align:right;font-weight:800;font-size:14px;color:#166534;">₹${_fmt(p.net_pay)}</td>
        <td>${_statusBadge(p.status)}</td>
      </tr>`;
    }).join('');

    // Footer totals
    const footerEl = document.getElementById('rpt-pr-footer');
    if (footerEl) footerEl.innerHTML = `
      <span style="margin-right:20px;">Records: <b>${list.length}</b></span>
      <span style="margin-right:20px;">Gross: <b>₹${_fmt(totalGross)}</b></span>
      <span style="margin-right:20px;">OT: <b>₹${_fmt(totalOT)}</b></span>
      <span style="margin-right:20px;">Deductions: <b>₹${_fmt(totalDeduct)}</b></span>
      <span style="color:#166534;font-weight:800;">Net Payable: ₹${_fmt(totalNet)}</span>`;
  }

  function exportPayrollReport() {
    const st      = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const period  = document.getElementById('rpt-pr-period')?.value || '';

    let list = (st.payroll||[]).filter(p => {
      const emp = (st.employees||[]).find(e=>e.id===p.emp_id);
      if (!isAdmin && emp?.type==='STAFF') return false;
      if (period && p.period !== period) return false;
      return true;
    });

    const rows = [['Period','Emp Code','Name','Type','Unit','Monthly Sal','Present','Half Days','Paid Leaves','OT Hrs','OT Amt','Deductions','Gross Pay','Net Pay','Status','Payment Mode','Payment Date']];
    list.forEach(p => {
      const emp  = (st.employees||[]).find(e=>e.id===p.emp_id);
      const unit = (st.units||[]).find(u=>u.id===emp?.unit_id);
      rows.push([
        p.period, emp?.emp_code||'', emp?.name||'', emp?.type||'', unit?.name||'',
        p.monthly_salary, p.present_days, p.half_days, p.paid_leaves,
        p.ot_hours, p.ot_amount, p.deductions, p.gross_pay, p.net_pay,
        p.status, p.payment_mode||'', p.payment_date||''
      ]);
    });
    SSIApp.excelDownload(rows, 'Payroll', `SSI_Payroll_Report_${period||'All'}`);
    SSIApp.toast('Payroll report exported ✅');
  }

  // ─── Monthly Sales Report ──────────────────────────────────
  function renderMonthly(area) {
    const st = SSIApp.getState();
    const now = new Date();
    const year = now.getFullYear();

    const months = Array.from({length:12}, (_,i) => {
      const date = new Date(year, i, 1);
      return date.toLocaleString('en-IN', {month:'short', year:'numeric'});
    });

    const monthly = months.map((m, i) => {
      const orders = st.orders.filter(o => {
        const d = new Date(o.created_at);
        return d.getMonth()===i && d.getFullYear()===year;
      });
      const dispatched = orders.filter(o=>o.status==='DISPATCHED');
      const totalOrders  = orders.length;
      const totalKg      = dispatched.reduce((s,o)=>s+(o.total_qty||0), 0);
      const totalRevenue = dispatched.reduce((s,o)=>s+(o.total_value||0), 0);
      const urgentCount  = orders.filter(o=>o.urgent).length;
      return { m, totalOrders, totalKg, totalRevenue, urgentCount };
    });

    const maxRev = Math.max(...monthly.map(m=>m.totalRevenue), 1);

    area.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <h3 style="font-size:16px;font-weight:700;color:#111827;">Monthly Sales — ${year}</h3>
        <button class="btn btn-secondary btn-sm" onclick="SSIReports.exportMonthly()">📤 Export</button>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div style="font-size:14px;font-weight:600;color:#64748b;margin-bottom:16px;">Revenue Trend (₹)</div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:180px;">
          ${monthly.map(m=>{
            const h = Math.round((m.totalRevenue/maxRev)*160);
            const curMonth = new Date().getMonth();
            const idx = months.indexOf(m.m);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="font-size:10px;color:#64748b;font-weight:600;">${m.totalRevenue>0?'₹'+(m.totalRevenue/1000).toFixed(0)+'k':''}</div>
              <div style="width:100%;height:${Math.max(h,2)}px;background:${idx===curMonth?'#C0392B':'#F1948A'};border-radius:4px 4px 0 0;transition:height .3s;" title="${m.m}: ₹${m.totalRevenue.toFixed(2)}"></div>
              <div style="font-size:10px;color:#64748b;transform:rotate(-30deg);white-space:nowrap;">${m.m}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div style="overflow-x:auto;">
          <table>
            <thead><tr>
              <th>Month</th><th>Total Orders</th><th>Dispatched KG</th>
              <th>Revenue (₹)</th><th>Urgent Orders</th>
            </tr></thead>
            <tbody>
              ${monthly.map(m=>`<tr>
                <td style="font-weight:600;">${m.m}</td>
                <td style="text-align:center;">${m.totalOrders}</td>
                <td style="text-align:right;">${SSIApp.qtyFmt(m.totalKg)} KG</td>
                <td style="text-align:right;font-weight:600;">${SSIApp.moneyFmt(m.totalRevenue)}</td>
                <td style="text-align:center;">${m.urgentCount>0?`<span class="badge badge-urgent">${m.urgentCount}</span>`:'—'}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f8fafc;font-weight:700;">
                <td>TOTAL</td>
                <td style="text-align:center;">${monthly.reduce((s,m)=>s+m.totalOrders,0)}</td>
                <td style="text-align:right;">${SSIApp.qtyFmt(monthly.reduce((s,m)=>s+m.totalKg,0))} KG</td>
                <td style="text-align:right;">${SSIApp.moneyFmt(monthly.reduce((s,m)=>s+m.totalRevenue,0))}</td>
                <td style="text-align:center;">${monthly.reduce((s,m)=>s+m.urgentCount,0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  }

  // ─── Demand Analysis ───────────────────────────────────────
  function renderDemand(area) {
    const st = SSIApp.getState();

    const productDemand = {};
    st.orders.filter(o=>o.status==='DISPATCHED').forEach(o => {
      (o.items||[]).forEach(item => {
        if (!productDemand[item.product_id]) {
          productDemand[item.product_id] = { qty:0, value:0, orders:0, clients:new Set() };
        }
        productDemand[item.product_id].qty    += item.total_qty   || 0;
        productDemand[item.product_id].value  += item.line_total  || 0;
        productDemand[item.product_id].orders += 1;
        if (o.client_id) productDemand[item.product_id].clients.add(o.client_id);
      });
    });

    const now = new Date();
    const last6 = Array.from({length:6}, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      return { month: d.toLocaleString('en-IN',{month:'short',year:'numeric'}), m: d.getMonth(), y: d.getFullYear() };
    });

    const sortedProducts = Object.entries(productDemand)
      .map(([pid, data]) => {
        const prod = st.products.find(p=>p.id===pid);
        return { prod, ...data, clients: data.clients.size };
      })
      .filter(x=>x.prod)
      .sort((a,b) => b.qty - a.qty);

    const maxQty = Math.max(...sortedProducts.map(p=>p.qty), 1);

    const clientDemand = {};
    st.orders.filter(o=>o.status==='DISPATCHED').forEach(o => {
      if (!clientDemand[o.client_id]) clientDemand[o.client_id] = { qty:0, value:0, orders:0 };
      clientDemand[o.client_id].qty   += o.total_qty   || 0;
      clientDemand[o.client_id].value += o.total_value || 0;
      clientDemand[o.client_id].orders++;
    });
    const sortedClients = Object.entries(clientDemand)
      .map(([cid, data]) => { const c = st.clients.find(x=>x.id===cid); return { c, ...data }; })
      .filter(x=>x.c)
      .sort((a,b) => b.value - a.value)
      .slice(0, 10);

    area.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <h3 style="font-size:16px;font-weight:700;color:#111827;">📊 Demand Analysis</h3>
        <button class="btn btn-secondary btn-sm" onclick="SSIReports.exportDemand()">📤 Export</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:20px;">
        ${[
          {icon:'📦',label:'Products Sold',val:sortedProducts.length,color:'#C0392B'},
          {icon:'⚖️',label:'Total KG Dispatched',val:SSIApp.qtyFmt(sortedProducts.reduce((s,p)=>s+p.qty,0)),color:'#16a34a'},
          {icon:'💰',label:'Total Revenue',val:SSIApp.moneyFmt(sortedProducts.reduce((s,p)=>s+p.value,0)),color:'#C0392B'},
          {icon:'👥',label:'Active Clients',val:sortedClients.length,color:'#7c3aed'},
        ].map(c=>`<div class="stat-card">
          <div style="font-size:28px;margin-bottom:8px;">${c.icon}</div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${c.val}</div>
          <div style="font-size:13px;color:#64748b;">${c.label}</div>
        </div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <div class="card">
          <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:16px;">🏆 Top Products by KG Demand</div>
          ${sortedProducts.slice(0,8).map(p=>{
            const pct = Math.round((p.qty/maxQty)*100);
            return `<div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:13px;font-weight:600;">${p.prod.name}</span>
                <span style="font-size:12px;color:#64748b;">${SSIApp.qtyFmt(p.qty)} KG</span>
              </div>
              <div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#C0392B,#F1948A);border-radius:5px;transition:width .5s;"></div>
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${p.orders} orders • ${p.clients} clients • ${SSIApp.moneyFmt(p.value)}</div>
            </div>`;
          }).join('') || '<p style="color:#94a3b8;">No dispatched orders yet</p>'}
        </div>

        <div class="card">
          <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:16px;">🌟 Top Clients by Revenue</div>
          ${sortedClients.map((item,i)=>
            `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <div style="width:28px;height:28px;background:${['#fbbf24','#94a3b8','#d97706','#C0392B','#7c3aed'][i]||'#e2e8f0'};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${i+1}</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;">${item.c.name}</div>
                ${item.c.gst_no?`<div style="font-size:11px;color:#16a34a;">GST: ${item.c.gst_no}</div>`:''}
              </div>
              <div style="text-align:right;">
                <div style="font-size:13px;font-weight:700;">${SSIApp.moneyFmt(item.value)}</div>
                <div style="font-size:11px;color:#94a3b8;">${item.orders} orders • ${SSIApp.qtyFmt(item.qty)} KG</div>
              </div>
            </div>`
          ).join('') || '<p style="color:#94a3b8;">No client data yet</p>'}
        </div>
      </div>

      <div class="card">
        <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:16px;">📅 Monthly Product Demand (Last 6 Months)</div>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr>
              <th>Product</th>
              ${last6.map(l=>`<th style="text-align:center;">${l.month}</th>`).join('')}
              <th style="text-align:center;">Total</th>
              <th>Trend</th>
            </tr></thead>
            <tbody>
              ${sortedProducts.slice(0,10).map(p=>{
                const monthly = last6.map(l => {
                  return st.orders.filter(o => {
                    const d = new Date(o.created_at);
                    return o.status==='DISPATCHED' && d.getMonth()===l.m && d.getFullYear()===l.y;
                  }).reduce((s,o) => {
                    const item = (o.items||[]).find(i=>i.product_id===p.prod.id);
                    return s+(item?.total_qty||0);
                  }, 0);
                });
                const lastTwo = monthly.slice(-2);
                const trend = lastTwo[1] > lastTwo[0] ? '📈' : lastTwo[1] < lastTwo[0] ? '📉' : '➡️';
                return `<tr>
                  <td><strong>${p.prod.name}</strong><br><span style="font-size:11px;color:#94a3b8;">${p.prod.sku}</span></td>
                  ${monthly.map(q=>`<td style="text-align:center;font-weight:${q>0?'600':'400'};color:${q>0?'#111827':'#d1d5db'};">${q>0?SSIApp.qtyFmt(q):'—'}</td>`).join('')}
                  <td style="text-align:center;font-weight:700;">${SSIApp.qtyFmt(p.qty)}</td>
                  <td style="text-align:center;font-size:18px;">${trend}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="9" style="text-align:center;color:#94a3b8;">No data</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ─── Inventory Report ──────────────────────────────────────
  function renderInventoryReport(area) {
    const st = SSIApp.getState();
    area.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <h3 style="font-size:16px;font-weight:700;">🏭 Inventory Stock Report</h3>
        <button class="btn btn-secondary btn-sm" onclick="SSIReports.exportInventoryReport()">📤 Export</button>
      </div>
      <div class="card">
        <div style="overflow-x:auto;">
          <table>
            <thead><tr>
              <th>SKU</th><th>Product</th><th>UoM</th>
              ${st.units.filter(u=>u.active).map(u=>`<th style="text-align:center;">${u.name}</th>`).join('')}
              <th style="text-align:center;">Total</th>
              <th>Reorder</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${st.products.filter(p=>p.active).map(p => {
                const unitStocks = st.units.filter(u=>u.active).map(u=>SSIApp.getStock(p.id,u.id));
                const total = unitStocks.reduce((a,b)=>a+b,0);
                const isLow = p.reorder_level>0 && total<=p.reorder_level;
                return `<tr>
                  <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">${p.sku}</code></td>
                  <td><strong>${p.name}</strong>${p.description?`<br><span style="font-size:12px;color:#94a3b8;">${p.description}</span>`:''}</td>
                  <td style="text-align:center;"><span style="background:#FDECEA;color:#922B21;padding:2px 8px;border-radius:12px;font-size:12px;">${p.uom||'KG'}</span></td>
                  ${unitStocks.map(q=>`<td style="text-align:center;font-weight:600;color:${q<=0?'#dc2626':q<=(p.reorder_level||0)?'#d97706':'#16a34a'};">${SSIApp.qtyFmt(q)}</td>`).join('')}
                  <td style="text-align:center;font-weight:800;">${SSIApp.qtyFmt(total)}</td>
                  <td style="text-align:center;color:#64748b;">${p.reorder_level||'—'}</td>
                  <td><span class="badge ${isLow?'badge-low':'badge-ok'}">${isLow?'⚠️ LOW STOCK':'✅ OK'}</span></td>
                </tr>`;
              }).join('') || '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">No products added</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ─── Salesperson Report ────────────────────────────────────
  function renderSalesperson(area) {
    const st = SSIApp.getState();
    const salespeople = st.users.filter(u=>u.role==='SALES'&&u.active);

    const salesData = salespeople.map(sp => {
      const orders = st.orders.filter(o=>o.created_by===sp.id);
      const dispatched = orders.filter(o=>o.status==='DISPATCHED');
      const pending    = orders.filter(o=>o.status==='SUBMITTED');
      const draft      = orders.filter(o=>o.status==='DRAFT');
      const totalKg    = dispatched.reduce((s,o)=>s+(o.total_qty||0),0);
      const totalRev   = dispatched.reduce((s,o)=>s+(o.total_value||0),0);
      return { sp, total:orders.length, dispatched:dispatched.length, pending:pending.length, draft:draft.length, totalKg, totalRev };
    });

    area.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <h3 style="font-size:16px;font-weight:700;">👤 Salesperson Performance</h3>
        <button class="btn btn-secondary btn-sm" onclick="SSIReports.exportSalesperson()">📤 Export</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
        ${salesData.map(d=>`
          <div class="card">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div style="width:44px;height:44px;background:#C0392B;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;">${d.sp.name[0]}</div>
              <div>
                <div style="font-weight:700;">${d.sp.name}</div>
                <div style="font-size:12px;color:#94a3b8;">@${d.sp.username}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div style="background:#f8fafc;padding:8px 12px;border-radius:8px;"><div style="font-size:11px;color:#64748b;">Total Orders</div><div style="font-weight:700;">${d.total}</div></div>
              <div style="background:#dcfce7;padding:8px 12px;border-radius:8px;"><div style="font-size:11px;color:#64748b;">Dispatched</div><div style="font-weight:700;color:#16a34a;">${d.dispatched}</div></div>
              <div style="background:#fef3c7;padding:8px 12px;border-radius:8px;"><div style="font-size:11px;color:#64748b;">Pending</div><div style="font-weight:700;color:#d97706;">${d.pending}</div></div>
              <div style="background:#f1f5f9;padding:8px 12px;border-radius:8px;"><div style="font-size:11px;color:#64748b;">Draft</div><div style="font-weight:700;color:#64748b;">${d.draft}</div></div>
            </div>
            <div style="margin-top:12px;padding:12px;background:#eff6ff;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:#64748b;">Revenue Generated</div>
              <div style="font-size:18px;font-weight:800;color:#C0392B;">${SSIApp.moneyFmt(d.totalRev)}</div>
              <div style="font-size:12px;color:#64748b;">${SSIApp.qtyFmt(d.totalKg)} KG dispatched</div>
            </div>
          </div>`).join('') || '<p style="color:#94a3b8;">No salespeople found</p>'}
      </div>`;
  }

  // ─── Exports ───────────────────────────────────────────────
  function exportMonthly() {
    const st = SSIApp.getState();
    const now = new Date();
    const year = now.getFullYear();
    const rows = [['Month','Total Orders','Dispatched KG','Revenue (INR)','Urgent Orders']];
    Array.from({length:12},(_,i)=>{
      const mName = new Date(year,i,1).toLocaleString('en-IN',{month:'short',year:'numeric'});
      const orders = st.orders.filter(o=>{ const d=new Date(o.created_at); return d.getMonth()===i&&d.getFullYear()===year; });
      const disp = orders.filter(o=>o.status==='DISPATCHED');
      rows.push([mName, orders.length, disp.reduce((s,o)=>s+(o.total_qty||0),0), disp.reduce((s,o)=>s+(o.total_value||0),0), orders.filter(o=>o.urgent).length]);
    });
    SSIApp.excelDownload(rows,'Monthly','SSI_Monthly_Report');
    SSIApp.toast('Monthly report exported ✅');
  }

  function exportDemand() {
    const st = SSIApp.getState();
    const rows = [['Product','SKU','Total KG Ordered','Total Revenue (INR)','No. of Orders','No. of Clients']];
    const productDemand = {};
    st.orders.filter(o=>o.status==='DISPATCHED').forEach(o => {
      (o.items||[]).forEach(item => {
        if (!productDemand[item.product_id]) productDemand[item.product_id] = {qty:0,value:0,orders:0,clients:new Set()};
        productDemand[item.product_id].qty   += item.total_qty||0;
        productDemand[item.product_id].value += item.line_total||0;
        productDemand[item.product_id].orders++;
        if (o.client_id) productDemand[item.product_id].clients.add(o.client_id);
      });
    });
    Object.entries(productDemand).forEach(([pid,data])=>{
      const prod = st.products.find(p=>p.id===pid);
      if (prod) rows.push([prod.name, prod.sku, data.qty, data.value, data.orders, data.clients.size]);
    });
    SSIApp.excelDownload(rows,'Demand','SSI_Demand_Analysis');
    SSIApp.toast('Demand analysis exported ✅');
  }

  function exportInventoryReport() {
    const st = SSIApp.getState();
    const unitNames = st.units.filter(u=>u.active).map(u=>u.name);
    const rows = [['SKU','Product','UoM',...unitNames,'Total','Reorder Level','Status']];
    st.products.filter(p=>p.active).forEach(p=>{
      const stocks = st.units.filter(u=>u.active).map(u=>SSIApp.getStock(p.id,u.id));
      const total = stocks.reduce((a,b)=>a+b,0);
      const isLow = p.reorder_level>0 && total<=p.reorder_level;
      rows.push([p.sku, p.name, p.uom||'KG', ...stocks, total, p.reorder_level||0, isLow?'LOW STOCK':'OK']);
    });
    SSIApp.excelDownload(rows,'Inventory','SSI_Inventory_Report');
    SSIApp.toast('Inventory report exported ✅');
  }

  function exportSalesperson() {
    const st = SSIApp.getState();
    const rows = [['Name','Username','Total Orders','Dispatched','Pending','Draft','Total KG','Revenue (INR)']];
    st.users.filter(u=>u.role==='SALES').forEach(sp=>{
      const orders = st.orders.filter(o=>o.created_by===sp.id);
      const disp = orders.filter(o=>o.status==='DISPATCHED');
      rows.push([sp.name,sp.username,orders.length,disp.length,orders.filter(o=>o.status==='SUBMITTED').length,orders.filter(o=>o.status==='DRAFT').length,disp.reduce((s,o)=>s+(o.total_qty||0),0),disp.reduce((s,o)=>s+(o.total_value||0),0)]);
    });
    SSIApp.excelDownload(rows,'Salesperson','SSI_Salesperson_Report');
    SSIApp.toast('Salesperson report exported ✅');
  }

  // ─── Helpers ──────────────────────────────────────────────
  function _fmt(n)  { return (n||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2}); }
  function _fmtK(n) { return n>=100000?((n/100000).toFixed(1)+'L'):n>=1000?((n/1000).toFixed(0)+'k'):n; }
  function _fmtPeriod(ym) {
    if (!ym) return '';
    const [y,m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m)-1]} ${y}`;
  }
  function _statusBadge(s) {
    const map = { DRAFT:{bg:'#f3f4f6',c:'#6b7280',l:'📝 Draft'}, PROCESSED:{bg:'#fef3c7',c:'#92400e',l:'🔄 Processed'}, PAID:{bg:'#dcfce7',c:'#166534',l:'✅ Paid'} };
    const v = map[s]||{bg:'#f3f4f6',c:'#6b7280',l:s};
    return `<span style="background:${v.bg};color:${v.c};padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">${v.l}</span>`;
  }

  return {
    render, showReport,
    refreshPayroll, exportPayrollReport,
    exportMonthly, exportDemand, exportInventoryReport, exportSalesperson
  };
})();
