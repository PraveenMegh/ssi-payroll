/* ============================================================
   SSI Employees Module — Employee Master (v3 SAFE + EPF/ESI Modes)
   employees.js
   Access: ADMIN (full), ACCOUNTANT (limited), ACCOUNTS (workers only)

   Stage 1 Batch 2: confirmation popups + soft delete + restore
   New: EPF/ESI Deduction Mode
        - STANDARD            → employee share only (12% EPF on Basic, 0.75% ESI on Bank if ≤21K)
        - BOTH_FROM_EMPLOYEE  → both shares from employee (24% EPF on Basic, 4% ESI on Bank if ≤21K)
        - NONE                → no EPF/ESI
   ============================================================ */
const SSIEmployees = (() => {

  const EMP_TYPES = [
    { value:'STAFF',  label:'👔 Staff'  },
    { value:'WORKER', label:'👷 Worker' },
  ];

  const ESI_LIMIT = 21000;

  // EPF/ESI rates by mode
  const RATES = {
    STANDARD:           { epf: 0.12, esi: 0.0075, label: '✅ Standard (employee share only)'        },
    BOTH_FROM_EMPLOYEE: { epf: 0.24, esi: 0.04,   label: '⚠️ Both shares from Employee (24% EPF, 4% ESI)' },
    NONE:               { epf: 0,    esi: 0,      label: '❌ Not applicable'                          }
  };

  // Map legacy `epf_esi` (true/false) → mode
  function modeOf(emp) {
    if (!emp) return 'STANDARD';
    if (emp.epf_esi_mode) return emp.epf_esi_mode;
    return emp.epf_esi === false ? 'NONE' : 'STANDARD';
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
    const st   = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');
    const emps = isAccountsOnly ? (st.employees || []).filter(e => e.type === 'WORKER') : (st.employees || []);

    area.innerHTML = `
      <div class="page-header">
        <h2 class="page-title">👥 Employee Master</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-secondary btn-sm" onclick="SSIEmployees.downloadTemplate()">⬇️ Template</button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            📥 Import Excel/CSV
            <input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="SSIEmployees.importFile(this)">
          </label>
          <button class="btn btn-secondary btn-sm" onclick="SSIEmployees.exportExcel()">📤 Export</button>
          ${isAdmin ? `
            <button class="btn btn-danger btn-sm" id="emp-delete-selected-btn" style="display:none;" onclick="SSIEmployees.deleteSelected()">
              🗑️ Delete Selected (<span id="emp-sel-count">0</span>)
            </button>
            <button class="btn btn-danger btn-sm" onclick="SSIEmployees.deleteAll()" title="Mark ALL employees inactive">
              ⚠️ Delete All
            </button>
            <button class="btn btn-primary" onclick="SSIEmployees.openForm()">+ Add Employee</button>
          ` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom:16px;padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
          <div>
            <label>Filter by Type</label>
            <select id="emp-filter-type" onchange="SSIEmployees.applyFilter()">
              <option value="">All Types</option>
              ${EMP_TYPES.map(t=>`<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Filter by Unit</label>
            <select id="emp-filter-unit" onchange="SSIEmployees.applyFilter()">
              <option value="">All Units</option>
              ${(st.units||[]).filter(u=>u.active).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Search Name / Code</label>
            <input type="text" id="emp-filter-search" placeholder="Search…" oninput="SSIEmployees.applyFilter()">
          </div>
          <div>
            <label>Status</label>
            <select id="emp-filter-status" onchange="SSIEmployees.applyFilter()">
              <option value="active" selected>Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="">All (incl. inactive)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card" style="overflow-x:auto;">
        <table id="emp-table">
          <thead><tr>
            ${isAdmin ? `<th style="width:36px;text-align:center;"><input type="checkbox" id="emp-chk-all" title="Select All" onchange="SSIEmployees.toggleSelectAll(this.checked)"></th>` : ''}
            <th>Code</th><th>Name</th><th>Type</th><th>Department</th>
            <th>Designation</th><th>Unit</th><th>Join Date</th><th>Phone</th>
            ${isAdmin ? '<th style="text-align:right;color:#6d28d9;">🏦 Bank Sal.</th><th style="text-align:right;color:#059669;">💵 Cash Sal.</th><th style="text-align:right;">Total CTC</th><th style="text-align:center;">EPF/ESI Mode</th>' : ''}
            <th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="emp-tbody">${buildRows(emps, st, isAdmin, isAccountsOnly)}</tbody>
        </table>
        <div style="padding:8px 16px;font-size:13px;color:#64748b;">Total: <b id="emp-count">${emps.filter(e=>e.active!==false).length}</b> active employees</div>
      </div>`;
  }

  function buildRows(emps, st, isAdmin, isAccountsOnly) {
    if (isAccountsOnly) emps = emps.filter(e => e.type === 'WORKER');
    const typeFilter   = document.getElementById('emp-filter-type')?.value   || '';
    const unitFilter   = document.getElementById('emp-filter-unit')?.value   || '';
    const search       = (document.getElementById('emp-filter-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('emp-filter-status')?.value;
    const effectiveStatus = (statusFilter === undefined || statusFilter === null) ? 'active' : statusFilter;

    let list = emps.filter(e => {
      if (typeFilter   && e.type    !== typeFilter)   return false;
      if (unitFilter   && e.unit_id !== unitFilter)   return false;
      if (effectiveStatus === 'active'   && e.active === false) return false;
      if (effectiveStatus === 'inactive' && e.active !== false) return false;
      if (search && !`${e.emp_code} ${e.name}`.toLowerCase().includes(search)) return false;
      return true;
    });

    if (!list.length) return `<tr><td colspan="${isAdmin?14:10}" style="text-align:center;padding:40px;color:#94a3b8;">No employees found.</td></tr>`;

    return list.map(e => {
      const unit = (st.units||[]).find(u=>u.id===e.unit_id);
      const active = e.active !== false;
      const m = modeOf(e);
      const modeBadge = m === 'STANDARD'
          ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">Standard</span>`
        : m === 'BOTH_FROM_EMPLOYEE'
          ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">Both (Emp)</span>`
        :   `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">None</span>`;

      return `<tr data-emp-id="${e.id}">
        ${isAdmin ? `<td style="text-align:center;"><input type="checkbox" class="emp-row-chk" value="${e.id}" onchange="SSIEmployees._onRowCheck()"></td>` : ''}
        <td><code style="font-size:12px;">${e.emp_code||'—'}</code></td>
        <td><b>${e.name}</b></td>
        <td><span class="badge" style="background:${e.type==='STAFF'?'#FDECEA':'#dcfce7'};color:${e.type==='STAFF'?'#922B21':'#166534'};">${e.type==='STAFF'?'👔 Staff':'👷 Worker'}</span></td>
        <td>${e.department||'—'}</td>
        <td>${e.designation||'—'}</td>
        <td>${unit?.name||'—'}</td>
        <td>${e.join_date||'—'}</td>
        <td>${e.phone||'—'}</td>
        ${isAdmin ? `
          <td style="text-align:right;color:#6d28d9;font-weight:600;">₹${(e.bank_salary||0).toLocaleString('en-IN')}</td>
          <td style="text-align:right;color:#059669;font-weight:600;">₹${(e.cash_salary||0).toLocaleString('en-IN')}</td>
          <td style="text-align:right;font-weight:700;border-left:2px solid #e2e8f0;">₹${(e.monthly_salary||0).toLocaleString('en-IN')}</td>
          <td style="text-align:center;">${modeBadge}</td>
        ` : ''}
        <td><span style="background:${active?'#dcfce7':'#fee2e2'};color:${active?'#166534':'#991b1b'};padding:2px 8px;border-radius:12px;font-size:12px;">${active?'Active':'Inactive'}</span></td>
        ${isAdmin ? `
        <td style="white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="SSIEmployees.openForm('${e.id}')" title="Edit">✏️</button>
          <button class="btn btn-secondary btn-sm" onclick="SSIEmployees.toggleActive('${e.id}')" title="${active?'Deactivate':'Activate'}">${active?'🔴':'🟢'}</button>
          ${active
            ? `<button class="btn btn-danger btn-sm" onclick="SSIEmployees.deleteEmployee('${e.id}')" title="Soft delete">🗑️</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="SSIEmployees.restore('${e.id}')" title="Restore">♻️</button>`}
        </td>` : '<td></td>'}
      </tr>`;
    }).join('');
  }

  function applyFilter() {
    const st = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const isAccountsOnly = SSIApp.hasRole('ACCOUNTS');
    const tbody = document.getElementById('emp-tbody');
    if (!tbody) return;
    const empList = isAccountsOnly
      ? (st.employees||[]).filter(e => e.type === 'WORKER')
      : (st.employees||[]);
    tbody.innerHTML = buildRows(empList, st, isAdmin, isAccountsOnly);
    const count = document.getElementById('emp-count');
    if (count) count.textContent = empList.filter(e=>e.active!==false).length;
  }

  /* ── Add / Edit form modal ────────────────────────────────── */
  function openForm(empId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st  = SSIApp.getState();
    const emp = empId ? (st.employees||[]).find(e=>e.id===empId) : null;
    const m   = modeOf(emp);

    const html = `
      <div id="emp-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;overflow-y:auto;">
        <div style="background:#fff;border-radius:.75rem;padding:1.5rem;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;">
          <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;">${emp?'Edit':'New'} Employee</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label>Employee Code *</label>
              <input id="ef-code" value="${emp?.emp_code||''}" placeholder="EMP-001">
            </div>
            <div>
              <label>Full Name *</label>
              <input id="ef-name" value="${emp?.name||''}" placeholder="Full name">
            </div>
            <div>
              <label>Type *</label>
              <select id="ef-type">
                ${EMP_TYPES.map(t=>`<option value="${t.value}" ${emp?.type===t.value?'selected':''}>${t.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Unit *</label>
              <select id="ef-unit">
                <option value="">Select Unit</option>
                ${(st.units||[]).filter(u=>u.active).map(u=>`<option value="${u.id}" ${emp?.unit_id===u.id?'selected':''}>${u.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Department</label>
              <input id="ef-dept" value="${emp?.department||''}" placeholder="Production / Admin…">
            </div>
            <div>
              <label>Designation</label>
              <input id="ef-desig" value="${emp?.designation||''}" placeholder="Supervisor / Operator…">
            </div>
            <div>
              <label>Join Date</label>
              <input type="date" id="ef-join" value="${emp?.join_date||''}">
            </div>
            <div>
              <label>Phone</label>
              <input id="ef-phone" value="${emp?.phone||''}" placeholder="Mobile number">
            </div>
            <div>
              <label>Father / Husband / Wife Name</label>
              <input id="ef-relation" value="${emp?.relation_name||''}" placeholder="Relation's full name">
            </div>
          </div>

          <!-- ── Salary Breakdown ──────────────────── -->
          <div style="margin-top:16px;padding:16px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;">
            <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:14px;">💰 Salary Breakdown</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label>🏦 Bank Salary (₹)</label>
                <input type="number" id="ef-bank-salary"
                  value="${emp ? (emp.bank_salary != null ? emp.bank_salary : (emp.monthly_salary||0)) : ''}"
                  placeholder="Salary credited to bank" min="0"
                  style="border-color:#818cf8;"
                  oninput="SSIEmployees._calcTotal()">
              </div>
              <div>
                <label>💵 Cash Salary (₹) <span style="font-size:11px;color:#059669;">(No EPF/ESI)</span></label>
                <input type="number" id="ef-cash-salary"
                  value="${emp?.cash_salary||''}"
                  placeholder="Paid in cash (no deductions)" min="0"
                  style="border-color:#6ee7b7;"
                  oninput="SSIEmployees._calcTotal()">
              </div>
            </div>

            <!-- EPF/ESI MODE -->
            <div style="margin-top:12px;padding:10px 14px;background:#ede9fe;border-radius:8px;">
              <div style="font-weight:700;font-size:13px;color:#5b21b6;margin-bottom:8px;">EPF &amp; ESI Deduction Mode</div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:#166534;">
                  <input type="radio" name="ef-epf-mode" value="STANDARD" ${m==='STANDARD'?'checked':''} onchange="SSIEmployees._calcTotal()">
                  ✅ Standard — employee share only (12% EPF on Basic, 0.75% ESI on Bank if ≤ ₹21,000)
                </label>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:#92400e;">
                  <input type="radio" name="ef-epf-mode" value="BOTH_FROM_EMPLOYEE" ${m==='BOTH_FROM_EMPLOYEE'?'checked':''} onchange="SSIEmployees._calcTotal()">
                  ⚠️ Both shares from Employee (24% EPF on Basic, 4% ESI on Bank if ≤ ₹21,000)
                </label>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:#991b1b;">
                  <input type="radio" name="ef-epf-mode" value="NONE" ${m==='NONE'?'checked':''} onchange="SSIEmployees._calcTotal()">
                  ❌ Not applicable
                </label>
              </div>
            </div>

            <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#64748b;margin-bottom:4px;">Basic (50% of Bank)</div>
                <div id="ef-basic-display" style="font-size:16px;font-weight:700;color:#5b21b6;">₹0</div>
                <div style="font-size:10px;color:#7c3aed;margin-top:2px;">EPF basis</div>
              </div>
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#64748b;margin-bottom:4px;">HRA (Balance 50%)</div>
                <div id="ef-hra-display" style="font-size:16px;font-weight:700;color:#059669;">₹0</div>
                <div style="font-size:10px;color:#059669;margin-top:2px;">No EPF on HRA</div>
              </div>
              <div style="background:#1e293b;border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">Total CTC</div>
                <div id="ef-total-salary-display" style="font-size:16px;font-weight:800;color:#f0fdf4;">₹0</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Bank + Cash</div>
              </div>
            </div>

            <div id="ef-deduction-preview" style="margin-top:8px;padding:8px 12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;display:none;">
              <b>Estimated Deductions (<span id="ef-mode-label">Standard</span>):</b>
              &nbsp; EPF = <b id="ef-epf-amt">₹0</b>
              &nbsp;|&nbsp; ESI = <b id="ef-esi-amt">₹0</b>
              &nbsp;|&nbsp; Take-home ≈ <b id="ef-takehome">₹0</b>
            </div>
          </div>

          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div>
              <label>Bank Account No.</label>
              <input id="ef-bank-ac" value="${emp?.bank_ac||''}" placeholder="Account number">
            </div>
            <div>
              <label>Bank IFSC</label>
              <input id="ef-bank-ifsc" value="${emp?.bank_ifsc||''}" placeholder="IFSC code">
            </div>
            <div>
              <label>Bank Name</label>
              <input id="ef-bank-name" value="${emp?.bank_name||''}" placeholder="Bank name">
            </div>
          </div>
          <div style="margin-top:12px;">
            <label>Notes / Remarks</label>
            <textarea id="ef-notes" rows="2" style="width:100%;" placeholder="Any notes…">${emp?.notes||''}</textarea>
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
            <button class="btn btn-secondary" onclick="document.getElementById('emp-modal-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="SSIEmployees.saveEmployee('${empId||''}')">💾 Save</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Initial calc
    setTimeout(_calcTotal, 0);
  }

  function _selectedMode() {
    const el = document.querySelector('input[name="ef-epf-mode"]:checked');
    return (el && el.value) || 'STANDARD';
  }

  function _calcTotal() {
    const bank    = parseFloat(document.getElementById('ef-bank-salary')?.value) || 0;
    const cash    = parseFloat(document.getElementById('ef-cash-salary')?.value) || 0;
    const total   = bank + cash;
    const basic   = Math.round(bank * 0.5);
    const hra     = bank - basic;
    const mode    = _selectedMode();
    const rate    = RATES[mode] || RATES.STANDARD;

    const fmt = v => '₹' + Math.round(v).toLocaleString('en-IN');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ef-total-salary-display', fmt(total));
    set('ef-basic-display',        fmt(basic));
    set('ef-hra-display',          fmt(hra));

    const prevEl   = document.getElementById('ef-deduction-preview');
    const labelEl  = document.getElementById('ef-mode-label');

    if (prevEl) {
      if (mode === 'NONE' || bank <= 0) {
        prevEl.style.display = 'none';
        return;
      }
      const epf = Math.round(basic * rate.epf);
      const esi = bank <= ESI_LIMIT ? Math.round(bank * rate.esi) : 0;
      const takehome = total - epf - esi;
      set('ef-epf-amt', `${fmt(epf)} (${(rate.epf*100).toFixed(rate.epf*100%1?2:0)}%)`);
      set('ef-esi-amt', bank <= ESI_LIMIT ? `${fmt(esi)} (${(rate.esi*100).toFixed(2)}%)` : '₹0 (>₹21K limit)');
      set('ef-takehome', fmt(takehome));
      if (labelEl) labelEl.textContent = mode === 'BOTH_FROM_EMPLOYEE' ? 'Both shares from Employee' : (mode==='STANDARD' ? 'Standard' : 'Custom');
      prevEl.style.display = 'block';
    }
  }

  async function saveEmployee(empId) {
    const code   = document.getElementById('ef-code')?.value.trim();
    const name   = document.getElementById('ef-name')?.value.trim();
    const type   = document.getElementById('ef-type')?.value;
    const unitId = document.getElementById('ef-unit')?.value;
    const bankSalary = parseFloat(document.getElementById('ef-bank-salary')?.value) || 0;
    const cashSalary = parseFloat(document.getElementById('ef-cash-salary')?.value) || 0;
    const salary     = bankSalary + cashSalary;
    const mode       = _selectedMode();

    if (!code || !name || !type || !unitId) {
      SSIApp.toast('Fill all required fields (Code, Name, Type, Unit)'); return;
    }
    if (salary <= 0) {
      SSIApp.toast('Please enter at least Bank Salary or Cash Salary'); return;
    }

    const st = SSIApp.getState();
    if (!st.employees) st.employees = [];

    const dupCode = st.employees.find(e => e.emp_code === code && e.id !== empId);
    if (dupCode) { SSIApp.toast(`Employee code "${code}" already exists!`); return; }

    const entry = {
      id:             empId || SSIApp.uid(),
      emp_code:       code,
      name,
      type,
      unit_id:        unitId,
      department:     document.getElementById('ef-dept')?.value.trim()||'',
      designation:    document.getElementById('ef-desig')?.value.trim()||'',
      join_date:      document.getElementById('ef-join')?.value||'',
      phone:          document.getElementById('ef-phone')?.value.trim()||'',
      relation_name:  document.getElementById('ef-relation')?.value.trim()||'',
      monthly_salary: salary,
      bank_salary:    bankSalary,
      cash_salary:    cashSalary,
      basic_salary:   Math.round(bankSalary * 0.5),
      hra:            Math.round(bankSalary * 0.5),
      epf_esi_mode:   mode,                           // NEW
      epf_esi:        mode !== 'NONE',                // legacy compat
      bank_ac:        document.getElementById('ef-bank-ac')?.value.trim()||'',
      bank_ifsc:      document.getElementById('ef-bank-ifsc')?.value.trim()||'',
      bank_name:      document.getElementById('ef-bank-name')?.value.trim()||'',
      notes:          document.getElementById('ef-notes')?.value.trim()||'',
      active:         true,
      updated_at:     new Date().toISOString(),
    };

    if (!empId) {
      entry.created_by = SSIApp.state.currentUser?.id||'';
      entry.created_at = entry.updated_at;
      st.employees.push(entry);
    } else {
      const idx = st.employees.findIndex(e=>e.id===empId);
      if (idx>=0) st.employees[idx] = { ...st.employees[idx], ...entry };
    }

    await SSIApp.saveState(st);
    SSIApp.audit('EMPLOYEE_SAVE', `${empId?'Updated':'Added'} employee ${name} (${code})`);
    SSIApp.toast(`✅ Employee ${name} saved`);
    document.getElementById('emp-modal-overlay')?.remove();
    refresh(document.getElementById('page-area'));
  }

  async function toggleActive(empId) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st  = SSIApp.getState();
    const idx = (st.employees||[]).findIndex(e=>e.id===empId);
    if (idx < 0) return;
    st.employees[idx].active = !st.employees[idx].active;
    await SSIApp.saveState(st);
    SSIApp.toast(`Employee ${st.employees[idx].active ? 'activated' : 'deactivated'}`);
    refresh(document.getElementById('page-area'));
  }

  /* ── Template download ───────────────────────────────────── */
  function downloadTemplate() {
    const rows = [
      ['emp_code','name','type','unit_name','department','designation','join_date','phone','relation_name','bank_salary','cash_salary','epf_esi_mode','bank_ac','bank_ifsc','bank_name','notes'],
      ['EMP-001','Ramesh Kumar','WORKER','Modinagar','Production','Machine Operator','2024-01-01','9876543210','Ram Kumar (Father)','10000','2000','STANDARD','','','',''],
      ['EMP-002','Suresh Sharma','STAFF','Modinagar','Admin','Supervisor','2024-01-01','9876543211','Geeta Sharma (Wife)','20000','5000','BOTH_FROM_EMPLOYEE','123456789','SBIN0001234','SBI',''],
      ['EMP-003','Cash Worker','WORKER','Patla','Production','Helper','2024-02-01','9876543212','—','0','8000','NONE','','','',''],
    ];
    SSIApp.excelDownload(rows, 'Employees_Template', 'SSI_Employee_Import_Template');
  }

  /* ── Import Excel / CSV ───────────────────────────────────── */
  async function importFile(input) {
    if (!input.files.length) return;
    const file = input.files[0];
    const name = file.name.toLowerCase();
    try {
      let rows = [];
      if (name.endsWith('.csv')) {
        const text = await file.text();
        rows = text.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
      } else {
        if (typeof XLSX === 'undefined') { SSIApp.toast('❌ Excel library not loaded. Please refresh the page.'); return; }
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type:'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows     = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      }

      while (rows.length > 1 && rows[rows.length-1].every(c => c === '' || c == null)) {
        rows.pop();
      }

      if (rows.length < 2) { SSIApp.toast('❌ No data rows found in file'); return; }

      const header = rows[0].map(h => String(h||'').toLowerCase().trim());
      const idx = {
        code:     header.indexOf('emp_code'),
        name:     header.indexOf('name'),
        type:     header.indexOf('type'),
        unit:     header.indexOf('unit_name'),
        dept:     header.indexOf('department'),
        desig:    header.indexOf('designation'),
        join:     header.indexOf('join_date'),
        phone:    header.indexOf('phone'),
        relation: header.indexOf('relation_name'),
        salary:     header.indexOf('monthly_salary'),
        bankSalary: header.indexOf('bank_salary'),
        cashSalary: header.indexOf('cash_salary'),
        epfMode:    header.indexOf('epf_esi_mode'),
        epfEsi:     header.indexOf('epf/esi applicable'),
        bankAc:   header.indexOf('bank_ac'),
        bankIfsc: header.indexOf('bank_ifsc'),
        bankName: header.indexOf('bank_name'),
        notes:    header.indexOf('notes'),
      };

      if (idx.code<0 || idx.name<0) {
        SSIApp.toast('❌ Missing columns: emp_code and name are required in header row'); return;
      }

      function cellStr(r, i) {
        if (i < 0 || i >= r.length) return '';
        const v = r[i];
        if (v == null || v === '') return '';
        if (v instanceof Date) {
          const y  = v.getFullYear();
          const m  = String(v.getMonth()+1).padStart(2,'0');
          const d  = String(v.getDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        return String(v).trim();
      }

      function cellNum(r, i) {
        if (i < 0 || i >= r.length) return 0;
        const v = r[i];
        if (v == null || v === '') return 0;
        return parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
      }

      function parseMode(r) {
        if (idx.epfMode >= 0) {
          const v = cellStr(r, idx.epfMode).toUpperCase().replace(/\s+/g,'_');
          if (v === 'STANDARD' || v === 'BOTH_FROM_EMPLOYEE' || v === 'NONE') return v;
          if (v === 'BOTH' || v === 'BOTH_EMPLOYEE') return 'BOTH_FROM_EMPLOYEE';
          if (v === 'NO' || v === 'N')  return 'NONE';
          if (v === 'YES'|| v === 'Y')  return 'STANDARD';
        }
        if (idx.epfEsi >= 0) {
          const v = cellStr(r, idx.epfEsi).toLowerCase();
          if (v.startsWith('n')) return 'NONE';
          return 'STANDARD';
        }
        return 'STANDARD';
      }

      const st = SSIApp.getState();
      if (!st.employees) st.employees = [];
      let added=0, updated=0, skipped=0;
      const skipReasons = [];

      for (let i=1; i<rows.length; i++) {
        const r = rows[i];
        if (r.every(c => c === '' || c == null)) continue;

        const code    = cellStr(r, idx.code);
        const empName = cellStr(r, idx.name);
        if (!code && !empName) continue;
        if (!code)    { skipped++; skipReasons.push(`Row ${i+1}: missing emp_code`);    continue; }
        if (!empName) { skipped++; skipReasons.push(`Row ${i+1}: missing name`);         continue; }

        const unitName = cellStr(r, idx.unit).toLowerCase();
        const unit     = (st.units||[]).find(u => u.name.toLowerCase() === unitName);
        if (unitName && !unit) {
          console.warn(`[SSI Import] Row ${i+1} (${code}): unit "${unitName}" not found in system — leaving blank`);
        }

        const type     = cellStr(r, idx.type).toUpperCase().includes('STAFF') ? 'STAFF' : 'WORKER';
        const existing = st.employees.findIndex(e => e.emp_code === code);

        let preservedId = null;
        if (existing < 0) {
          const payrollRef = (st.payroll||[]).find(p => p.emp_code === code);
          if (payrollRef) preservedId = payrollRef.emp_id;
        }

        const mode = parseMode(r);
        const bank = idx.bankSalary>=0 ? cellNum(r, idx.bankSalary) : 0;
        const cash = idx.cashSalary>=0 ? cellNum(r, idx.cashSalary) : 0;

        const entry = {
          id:             existing>=0 ? st.employees[existing].id : (preservedId || SSIApp.uid()),
          emp_code:       code,
          name:           empName,
          type,
          unit_id:        unit?.id || '',
          department:     cellStr(r, idx.dept),
          designation:    cellStr(r, idx.desig),
          join_date:      cellStr(r, idx.join),
          phone:          cellStr(r, idx.phone),
          relation_name:  cellStr(r, idx.relation),
          bank_salary:    bank,
          cash_salary:    cash,
          epf_esi_mode:   mode,
          epf_esi:        mode !== 'NONE',
          basic_salary:   Math.round(bank * 0.5),
          hra:            Math.round(bank * 0.5),
          monthly_salary: (() => {
            if (bank || cash) return bank + cash;
            return idx.salary>=0 ? cellNum(r, idx.salary) : 0;
          })(),
          bank_ac:        cellStr(r, idx.bankAc),
          bank_ifsc:      cellStr(r, idx.bankIfsc),
          bank_name:      cellStr(r, idx.bankName),
          notes:          cellStr(r, idx.notes),
          active:         true,
          created_at:     existing>=0 ? (st.employees[existing].created_at || new Date().toISOString()) : new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        };

        if (existing>=0) { st.employees[existing] = entry; updated++; }
        else             { st.employees.push(entry); added++; }
      }

      await SSIApp.saveState(st);

      let msg = `✅ Import done — ${added} added, ${updated} updated`;
      if (skipped>0) msg += `, ${skipped} skipped`;
      SSIApp.toast(msg, 'success');

      if (skipReasons.length > 0) {
        console.warn('[SSI Import] Skipped rows:', skipReasons);
        SSIApp.toast(`⚠️ ${skipped} row(s) skipped — check console for details`, 'warning');
      }

      refresh(document.getElementById('page-area'));
    } catch(err) {
      console.error('[SSI Import] Error:', err);
      SSIApp.toast(`❌ Import failed: ${err.message}`);
    }
    input.value = '';
  }

  /* ── Bulk / Delete-All helpers ──────────────────────────── */
  function _onRowCheck() {
    const checked = document.querySelectorAll('.emp-row-chk:checked');
    const all     = document.querySelectorAll('.emp-row-chk');
    const selBtn  = document.getElementById('emp-delete-selected-btn');
    const selCount = document.getElementById('emp-sel-count');
    const allChk  = document.getElementById('emp-chk-all');
    if (selBtn)   selBtn.style.display  = checked.length > 0 ? 'inline-flex' : 'none';
    if (selCount) selCount.textContent  = checked.length;
    if (allChk)   allChk.indeterminate  = checked.length > 0 && checked.length < all.length;
    if (allChk)   allChk.checked        = all.length > 0 && checked.length === all.length;
  }

  function toggleSelectAll(checked) {
    document.querySelectorAll('.emp-row-chk').forEach(cb => { cb.checked = checked; });
    _onRowCheck();
  }

  /* ── Soft delete: selected rows ─────────────────────────── */
  async function deleteSelected() {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const ids = [...document.querySelectorAll('.emp-row-chk:checked')].map(cb => cb.value);
    if (!ids.length) { SSIApp.toast('No employees selected'); return; }
    const st = SSIApp.getState();
    const names = ids.map(id => {
      const e = (st.employees||[]).find(e=>e.id===id);
      return e ? `• ${e.emp_code} – ${e.name}` : id;
    });

    const ok1 = await SSIApp.confirm(
      `⚠️ Bulk Delete ${ids.length} Employees?\n\n${names.slice(0,5).join('\n')}${names.length>5?`\n…and ${names.length-5} more`:''}\n\n` +
      `These employees will be marked INACTIVE.\n` +
      `Past attendance and payroll will be preserved.\n\nProceed to step 2 of 2?`
    );
    if (!ok1) return;

    const ok2 = await SSIApp.confirm(
      `🚨 FINAL CONFIRMATION\n\nYou are about to mark ${ids.length} employees inactive.\n\nClick OK to confirm, Cancel to abort.`
    );
    if (!ok2) return;

    const nowIso = new Date().toISOString();
    const actor  = SSIApp.state.currentUser?.username || 'unknown';
    let count = 0;
    (st.employees||[]).forEach(e => {
      if (ids.includes(e.id)) {
        e.active     = false;
        e.deleted_at = nowIso;
        e.deleted_by = actor;
        count++;
      }
    });

    await SSIApp.saveState(st);
    SSIApp.audit('EMPLOYEE_BULK_SOFT_DELETE', `Soft-deleted ${count} employees: ${ids.slice(0,20).join(', ')}${ids.length>20?'…':''}`);
    SSIApp.toast(`🗑️ ${count} employee(s) marked inactive`);
    refresh(document.getElementById('page-area'));
  }

  /* ── Soft delete: ALL employees (two-step + type-to-confirm) ── */
  async function deleteAll() {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st = SSIApp.getState();
    const total = (st.employees||[]).filter(e => e.active !== false).length;
    if (!total) { SSIApp.toast('No active employees to mark inactive', 'info'); return; }

    const step1 = await SSIApp.confirm(
      `⚠️ DELETE ALL EMPLOYEES\n\nThis will mark ALL ${total} active employee record(s) as INACTIVE.\n\n` +
      `Past attendance and payroll will be preserved.\nYou can restore any of them later from the Inactive list.\n\n` +
      `Click OK to proceed to final confirmation.`
    );
    if (!step1) return;

    const confirmed = await _confirmTyped(`Type DELETE ALL to confirm marking all ${total} employees inactive:`, 'DELETE ALL');
    if (!confirmed) return;

    const nowIso = new Date().toISOString();
    const actor  = SSIApp.state.currentUser?.username || 'unknown';
    let count = 0;
    (st.employees||[]).forEach(e => {
      if (e.active !== false) {
        e.active     = false;
        e.deleted_at = nowIso;
        e.deleted_by = actor;
        count++;
      }
    });

    await SSIApp.saveState(st);
    SSIApp.audit('EMPLOYEE_SOFT_DELETE_ALL', `Soft-deleted ALL ${count} employees`);
    SSIApp.toast(`🗑️ All ${count} employees marked inactive`, 'success');
    refresh(document.getElementById('page-area'));
  }

  function _confirmTyped(message, expectedText) {
    return new Promise(resolve => {
      const html = `
        <div class="modal-header" style="background:#7f1d1d;color:#fff;">
          <h3 style="margin:0;font-size:16px;">⚠️ Final Confirmation Required</h3>
          <button onclick="SSIApp.closeModal()" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div class="modal-body" style="padding:24px;">
          <p style="margin:0 0 16px;color:#7f1d1d;font-weight:600;">${message}</p>
          <input id="confirm-type-input" type="text" placeholder='Type: ${expectedText}'
            style="border:2px solid #dc2626;border-radius:8px;padding:10px 14px;width:100%;box-sizing:border-box;font-size:15px;letter-spacing:1px;"
            oninput="document.getElementById('confirm-type-btn').disabled = this.value.trim() !== '${expectedText}';">
        </div>
        <div class="modal-footer" style="justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="SSIApp.closeModal(); window._empDelResolve(false)">Cancel</button>
          <button id="confirm-type-btn" class="btn btn-danger" disabled
            onclick="SSIApp.closeModal(); window._empDelResolve(true)">
            🗑️ Mark All Inactive
          </button>
        </div>`;
      window._empDelResolve = resolve;
      SSIApp.showModal(html);
    });
  }

  /* ── Soft delete: single row ────────────────────────────── */
  async function deleteEmployee(id) {
    if (!SSIApp.hasRole('ADMIN')) { SSIApp.toast('🔒 Admin only'); return; }
    const st  = SSIApp.getState();
    const emp = (st.employees||[]).find(e=>e.id===id);
    if (!emp) return;

    const ok = await SSIApp.confirm(
      `⚠️ Confirm Delete Employee\n\n` +
      `Code: ${emp.emp_code || '—'}\n` +
      `Name: ${emp.name || '—'}\n` +
      `Type: ${emp.type || '—'}\n\n` +
      `The employee will be marked INACTIVE and hidden from active lists.\n` +
      `Past attendance and payroll history will be preserved.\n\nProceed?`
    );
    if (!ok) return;

    emp.active     = false;
    emp.deleted_at = new Date().toISOString();
    emp.deleted_by = SSIApp.state.currentUser?.username || 'unknown';
    await SSIApp.saveState(st);
    SSIApp.audit('EMPLOYEE_SOFT_DELETE', `Soft-deleted employee: ${emp.emp_code || ''} ${emp.name || ''}`);
    SSIApp.toast('🗑️ Employee marked inactive');
    refresh(document.getElementById('page-area'));
  }

  /* ── Restore a soft-deleted employee ────────────────────── */
  async function restore(id) {
    if (!SSIApp.hasRole('ADMIN')) return;
    const st  = SSIApp.getState();
    const emp = (st.employees||[]).find(e=>e.id===id);
    if (!emp) return;
    emp.active = true;
    emp.restored_at = new Date().toISOString();
    emp.restored_by = SSIApp.state.currentUser?.username || 'unknown';
    delete emp.deleted_at;
    delete emp.deleted_by;
    await SSIApp.saveState(st);
    SSIApp.audit('EMPLOYEE_RESTORE', `Restored employee: ${emp.emp_code || ''} ${emp.name || ''}`);
    SSIApp.toast('♻️ Employee restored');
    refresh(document.getElementById('page-area'));
  }

  /* ── Export ──────────────────────────────────────────────── */
  function exportExcel() {
    const st = SSIApp.getState();
    const isAdmin = SSIApp.hasRole('ADMIN');
    const headers = ['Code','Name','Type','Unit','Department','Designation','Join Date','Phone','Father/Spouse Name','Status',
      ...(isAdmin ? ['Bank Salary','Cash Salary','Total CTC','Basic (50%)','HRA (50%)','EPF/ESI Mode','Bank AC','Bank IFSC','Bank Name'] : [])];
    const rows = [headers];
    (st.employees||[]).forEach(e => {
      const unit = (st.units||[]).find(u=>u.id===e.unit_id);
      const m    = modeOf(e);
      rows.push([
        e.emp_code, e.name, e.type, unit?.name||'', e.department, e.designation,
        e.join_date, e.phone, e.relation_name||'', e.active!==false?'Active':'Inactive',
        ...(isAdmin ? [e.bank_salary||0, e.cash_salary||0, e.monthly_salary||0,
          e.basic_salary||Math.round((e.bank_salary||0)*0.5),
          e.hra||Math.round((e.bank_salary||0)*0.5),
          m,
          e.bank_ac, e.bank_ifsc, e.bank_name] : [])
      ]);
    });
    SSIApp.excelDownload(rows, 'Employees', 'SSI_Employee_Export');
  }

  return { render, refresh, applyFilter, openForm, saveEmployee, _calcTotal, toggleActive, deleteEmployee, deleteSelected, deleteAll, toggleSelectAll, _onRowCheck, downloadTemplate, importFile, exportExcel, restore };
})();
