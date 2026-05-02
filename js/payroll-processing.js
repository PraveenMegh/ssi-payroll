// Payroll Processing Module - Salary Calculation & Disbursement

// ========================================
// ADVANCE MANAGEMENT
// ========================================

async function loadAdvanceManagement(content, user) {
    const advances = await API.getAll('advances');
    const employees = await API.getAll('employees');
    
    // Calculate stats
    const activeAdvances = advances.filter(a => a.status === 'Deducting');
    const totalAdvanced = advances.reduce((sum, a) => sum + a.advance_amount, 0);
    const totalRecovered = advances.reduce((sum, a) => sum + (a.deducted_so_far || 0), 0);
    const totalBalance = advances.reduce((sum, a) => sum + (a.balance || a.advance_amount - (a.deducted_so_far || 0)), 0);
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Advance Management</h1>
                <p class="text-gray-600">Track employee advances and auto-recovery</p>
            </div>
            <button onclick="showAddAdvanceModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-plus mr-2"></i>Issue Advance
            </button>
        </div>
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Active Advances</p>
                        <p class="text-3xl font-bold text-blue-600 mt-2">${activeAdvances.length}</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-hand-holding-usd text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Advanced</p>
                        <p class="text-3xl font-bold text-purple-600 mt-2">${Utils.formatCurrency(totalAdvanced, 'INR')}</p>
                    </div>
                    <div class="bg-purple-100 p-3 rounded-full">
                        <i class="fas fa-money-bill-wave text-2xl text-purple-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Recovered</p>
                        <p class="text-3xl font-bold text-green-600 mt-2">${Utils.formatCurrency(totalRecovered, 'INR')}</p>
                    </div>
                    <div class="bg-green-100 p-3 rounded-full">
                        <i class="fas fa-check-circle text-2xl text-green-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Balance</p>
                        <p class="text-3xl font-bold text-red-600 mt-2">${Utils.formatCurrency(totalBalance, 'INR')}</p>
                    </div>
                    <div class="bg-red-100 p-3 rounded-full">
                        <i class="fas fa-exclamation-circle text-2xl text-red-600"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Filter Tabs -->
        <div class="bg-white rounded-lg shadow mb-6">
            <div class="flex border-b">
                <button onclick="filterAdvancesByStatus('all')" class="advance-filter-tab px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-600" data-status="all">
                    All Advances
                </button>
                <button onclick="filterAdvancesByStatus('Pending')" class="advance-filter-tab px-6 py-3 font-medium text-gray-600 hover:text-blue-600" data-status="Pending">
                    Pending
                </button>
                <button onclick="filterAdvancesByStatus('Deducting')" class="advance-filter-tab px-6 py-3 font-medium text-gray-600 hover:text-blue-600" data-status="Deducting">
                    Deducting
                </button>
                <button onclick="filterAdvancesByStatus('Completed')" class="advance-filter-tab px-6 py-3 font-medium text-gray-600 hover:text-blue-600" data-status="Completed">
                    Completed
                </button>
            </div>
        </div>
        
        <!-- Advances List -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full" id="advancesTable">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Emp ID</th>
                            <th class="text-left py-3 px-4">Employee Name</th>
                            <th class="text-left py-3 px-4">Issue Date</th>
                            <th class="text-left py-3 px-4">Advance Amount</th>
                            <th class="text-left py-3 px-4">Monthly Deduction</th>
                            <th class="text-left py-3 px-4">Deducted</th>
                            <th class="text-left py-3 px-4">Balance</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${advances.length === 0 ? `
                            <tr>
                                <td colspan="9" class="py-8 text-center text-gray-500">
                                    <i class="fas fa-hand-holding-usd text-4xl mb-2"></i>
                                    <p>No advances issued yet</p>
                                </td>
                            </tr>
                        ` : advances.map(adv => {
                            const employee = employees.find(e => e.id === adv.employee_id);
                            if (!employee) return '';
                            
                            const balance = adv.balance || (adv.advance_amount - (adv.deducted_so_far || 0));
                            const statusColors = {
                                'Pending': 'bg-yellow-100 text-yellow-800',
                                'Deducting': 'bg-blue-100 text-blue-800',
                                'Completed': 'bg-green-100 text-green-800'
                            };
                            
                            return `
                                <tr class="border-b hover:bg-gray-50" data-status="${adv.status}">
                                    <td class="py-3 px-4 font-bold">${employee.emp_id}</td>
                                    <td class="py-3 px-4">${employee.full_name}</td>
                                    <td class="py-3 px-4">${Utils.formatDate(adv.issue_date)}</td>
                                    <td class="py-3 px-4 font-bold">${Utils.formatCurrency(adv.advance_amount, 'INR')}</td>
                                    <td class="py-3 px-4">${Utils.formatCurrency(adv.monthly_deduction, 'INR')}</td>
                                    <td class="py-3 px-4 text-green-600">${Utils.formatCurrency(adv.deducted_so_far || 0, 'INR')}</td>
                                    <td class="py-3 px-4 font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}">
                                        ${Utils.formatCurrency(balance, 'INR')}
                                    </td>
                                    <td class="py-3 px-4">
                                        <span class="px-3 py-1 rounded-full text-sm ${statusColors[adv.status]}">
                                            ${adv.status}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <button onclick="viewAdvance('${adv.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="View">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        ${adv.status !== 'Completed' ? `
                                            <button onclick="editAdvance('${adv.id}')" class="text-green-600 hover:text-green-800" title="Edit">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    window.allAdvances = advances;
}

function filterAdvancesByStatus(status) {
    const rows = document.querySelectorAll('#advancesTable tbody tr');
    rows.forEach(row => {
        if (status === 'all') {
            row.style.display = '';
        } else {
            row.style.display = row.dataset.status === status ? '' : 'none';
        }
    });
    
    // Update tab styles
    document.querySelectorAll('.advance-filter-tab').forEach(tab => {
        tab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        tab.classList.add('text-gray-600');
    });
    const activeTab = document.querySelector(`[data-status="${status}"]`);
    activeTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    activeTab.classList.remove('text-gray-600');
}

async function showAddAdvanceModal() {
    const employees = await API.getAll('employees');
    const activeEmployees = employees.filter(e => e.is_active);
    
    const formHtml = `
        <form id="advanceForm" class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                Monthly deduction will be automatically deducted from salary during processing</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Employee *</label>
                    <select name="employee_id" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Employee</option>
                        ${activeEmployees.map(emp => `
                            <option value="${emp.id}">
                                ${emp.emp_id} - ${emp.full_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Issue Date *</label>
                    <input type="date" name="issue_date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Advance Amount *</label>
                    <input type="number" name="advance_amount" id="advanceAmount" required min="1" step="0.01" onchange="calculateAdvanceMonths()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Monthly Deduction *</label>
                    <input type="number" name="monthly_deduction" id="monthlyDeduction" required min="1" step="0.01" onchange="calculateAdvanceMonths()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="md:col-span-2">
                    <p class="text-sm text-gray-600" id="advanceEstimate">Recovery estimate will appear here</p>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Reason/Notes</label>
                    <textarea name="reason" rows="2" placeholder="Reason for advance" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Issue Advance
                </button>
            </div>
        </form>
    `;
    
    showModal('Issue Advance', formHtml, 'max-w-2xl');
    
    document.getElementById('advanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const advanceAmount = parseFloat(formData.get('advance_amount'));
        const monthlyDeduction = parseFloat(formData.get('monthly_deduction'));
        
        const advanceData = {
            id: Utils.generateId('adv'),
            employee_id: formData.get('employee_id'),
            issue_date: formData.get('issue_date'),
            advance_amount: advanceAmount,
            monthly_deduction: monthlyDeduction,
            deducted_so_far: 0,
            balance: advanceAmount,
            status: 'Pending',
            reason: formData.get('reason') || '',
            approved_by: Auth.getCurrentUser().full_name,
            completion_date: null
        };
        
        try {
            await API.create('advances', advanceData);
            Utils.showNotification('Advance issued successfully', 'success');
            closeModal();
            loadPage('payroll-advances');
        } catch (error) {
            Utils.showNotification('Error issuing advance', 'error');
        }
    });
}

function calculateAdvanceMonths() {
    const amount = parseFloat(document.getElementById('advanceAmount').value) || 0;
    const deduction = parseFloat(document.getElementById('monthlyDeduction').value) || 0;
    
    if (amount > 0 && deduction > 0) {
        const months = Math.ceil(amount / deduction);
        document.getElementById('advanceEstimate').innerHTML = `
            <i class="fas fa-calculator mr-2"></i>
            <strong>Recovery Estimate:</strong> ${months} months 
            (₹${deduction.toFixed(2)} × ${months} = ₹${(deduction * months).toFixed(2)})
        `;
    }
}

async function viewAdvance(advanceId) {
    const advance = await API.getById('advances', advanceId);
    const employee = await API.getById('employees', advance.employee_id);
    
    const balance = advance.balance || (advance.advance_amount - (advance.deducted_so_far || 0));
    const progress = ((advance.deducted_so_far || 0) / advance.advance_amount) * 100;
    
    const detailsHtml = `
        <div class="space-y-4">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-2xl font-bold">${employee.full_name}</h3>
                    <p class="text-gray-600">${employee.emp_id} - ${employee.designation}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500">Status</p>
                    <span class="px-4 py-2 rounded-full text-sm font-bold ${
                        advance.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        advance.status === 'Deducting' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                    }">
                        ${advance.status}
                    </span>
                </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="border-t pt-4">
                <h4 class="font-bold text-gray-800 mb-3">Recovery Progress</h4>
                <div class="relative pt-1">
                    <div class="flex mb-2 items-center justify-between">
                        <div>
                            <span class="text-xs font-semibold inline-block text-blue-600">
                                ${progress.toFixed(1)}% Recovered
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="text-xs font-semibold inline-block text-blue-600">
                                ₹${(advance.deducted_so_far || 0).toFixed(2)} / ₹${advance.advance_amount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div class="overflow-hidden h-4 mb-4 text-xs flex rounded bg-blue-200">
                        <div style="width:${progress}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600"></div>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                    <p class="text-sm text-gray-600">Advance Amount</p>
                    <p class="font-bold text-lg text-purple-600">${Utils.formatCurrency(advance.advance_amount, 'INR')}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Monthly Deduction</p>
                    <p class="font-bold text-lg">${Utils.formatCurrency(advance.monthly_deduction, 'INR')}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Deducted So Far</p>
                    <p class="font-bold text-lg text-green-600">${Utils.formatCurrency(advance.deducted_so_far || 0, 'INR')}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Balance</p>
                    <p class="font-bold text-lg text-red-600">${Utils.formatCurrency(balance, 'INR')}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Issue Date</p>
                    <p class="font-medium">${Utils.formatDate(advance.issue_date)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Approved By</p>
                    <p class="font-medium">${advance.approved_by}</p>
                </div>
            </div>
            
            ${advance.reason ? `
                <div class="border-t pt-4">
                    <p class="text-sm text-gray-600">Reason/Notes</p>
                    <p class="font-medium">${advance.reason}</p>
                </div>
            ` : ''}
            
            ${advance.completion_date ? `
                <div class="border-t pt-4">
                    <p class="text-sm text-gray-600">Completion Date</p>
                    <p class="font-medium text-green-600">${Utils.formatDate(advance.completion_date)}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    showModal('Advance Details', detailsHtml, 'max-w-2xl');
}

// ========================================
// SALARY PROCESSING
// ========================================

async function loadSalaryProcessing(content, user) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Salary Processing</h1>
                <p class="text-gray-600">Calculate, review, and disburse monthly salaries</p>
            </div>
            <button onclick="showProcessSalaryModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-calculator mr-2"></i>Process New Month
            </button>
        </div>
        
        <!-- Month/Year Selector -->
        <div class="bg-white rounded-lg shadow p-4 mb-6">
            <div class="flex items-center space-x-4">
                <label class="font-medium text-gray-700">View Salaries For:</label>
                <select id="salaryMonth" onchange="loadSalaryRecords()" class="px-4 py-2 border rounded-lg">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                        <option value="${m}" ${m === currentMonth ? 'selected' : ''}>
                            ${new Date(2024, m-1).toLocaleString('default', { month: 'long' })}
                        </option>
                    `).join('')}
                </select>
                <select id="salaryYear" onchange="loadSalaryRecords()" class="px-4 py-2 border rounded-lg">
                    ${[2023, 2024, 2025, 2026].map(y => `
                        <option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>
                    `).join('')}
                </select>
                <button onclick="loadSalaryRecords()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-sync mr-2"></i>Refresh
                </button>
            </div>
        </div>
        
        <!-- Salary Records Container -->
        <div id="salaryRecordsContainer">
            <!-- Will be loaded dynamically -->
        </div>
    `;
    
    await loadSalaryRecords();
}

async function loadSalaryRecords() {
    const month = parseInt(document.getElementById('salaryMonth').value);
    const year = parseInt(document.getElementById('salaryYear').value);
    
    const salaryRecords = await API.getAll('salary_structure');
    const employees = await API.getAll('employees');
    
    // Filter for selected month
    const monthSalaries = salaryRecords.filter(s => {
        const salDate = new Date(s.month_year);
        return salDate.getMonth() + 1 === month && salDate.getFullYear() === year;
    });
    
    const container = document.getElementById('salaryRecordsContainer');
    
    if (monthSalaries.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow p-12 text-center">
                <i class="fas fa-calculator text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-xl font-bold text-gray-800 mb-2">No Salaries Processed Yet</h3>
                <p class="text-gray-600 mb-6">Click "Process New Month" to calculate salaries for this month</p>
                <button onclick="showProcessSalaryModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-calculator mr-2"></i>Process Salaries
                </button>
            </div>
        `;
        return;
    }
    
    // Calculate totals
    const totalGross = monthSalaries.reduce((sum, s) => sum + s.gross_earned, 0);
    const totalDeductions = monthSalaries.reduce((sum, s) => sum + s.total_deductions, 0);
    const totalNet = monthSalaries.reduce((sum, s) => sum + s.net_payable, 0);
    const disbursedCount = monthSalaries.filter(s => s.is_disbursed).length;
    
    container.innerHTML = `
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Employees</p>
                        <p class="text-3xl font-bold text-gray-800 mt-2">${monthSalaries.length}</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-users text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Gross</p>
                        <p class="text-2xl font-bold text-purple-600 mt-2">${Utils.formatCurrency(totalGross, 'INR')}</p>
                    </div>
                    <div class="bg-purple-100 p-3 rounded-full">
                        <i class="fas fa-coins text-2xl text-purple-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Deductions</p>
                        <p class="text-2xl font-bold text-red-600 mt-2">${Utils.formatCurrency(totalDeductions, 'INR')}</p>
                    </div>
                    <div class="bg-red-100 p-3 rounded-full">
                        <i class="fas fa-minus-circle text-2xl text-red-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Net Payable</p>
                        <p class="text-2xl font-bold text-green-600 mt-2">${Utils.formatCurrency(totalNet, 'INR')}</p>
                    </div>
                    <div class="bg-green-100 p-3 rounded-full">
                        <i class="fas fa-wallet text-2xl text-green-600"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Disbursement Status -->
        <div class="bg-white rounded-lg shadow p-4 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-600">Disbursement Status</p>
                    <p class="font-bold text-lg">
                        ${disbursedCount} of ${monthSalaries.length} salaries disbursed
                    </p>
                </div>
                ${disbursedCount < monthSalaries.length ? `
                    <button onclick="disbursePendingSalaries()" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                        <i class="fas fa-money-check-alt mr-2"></i>Disburse Pending
                    </button>
                ` : `
                    <span class="text-green-600 font-bold">
                        <i class="fas fa-check-circle mr-2"></i>All Salaries Disbursed
                    </span>
                `}
            </div>
        </div>
        
        <!-- Salary Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Emp ID</th>
                            <th class="text-left py-3 px-4">Employee</th>
                            <th class="text-left py-3 px-4">Basic</th>
                            <th class="text-left py-3 px-4">HRA</th>
                            <th class="text-left py-3 px-4">Overtime</th>
                            <th class="text-left py-3 px-4">Gross</th>
                            <th class="text-left py-3 px-4">Deductions</th>
                            <th class="text-left py-3 px-4">Net Pay</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthSalaries.map(sal => {
                            const employee = employees.find(e => e.id === sal.employee_id);
                            if (!employee) return '';
                            
                            return `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="py-3 px-4 font-bold">${employee.emp_id}</td>
                                    <td class="py-3 px-4">${employee.full_name}</td>
                                    <td class="py-3 px-4">${Utils.formatCurrency(sal.earned_basic, 'INR')}</td>
                                    <td class="py-3 px-4">${Utils.formatCurrency(sal.earned_hra, 'INR')}</td>
                                    <td class="py-3 px-4 ${sal.overtime_amount > 0 ? 'text-purple-600 font-bold' : ''}">${Utils.formatCurrency(sal.overtime_amount, 'INR')}</td>
                                    <td class="py-3 px-4 font-bold text-green-600">${Utils.formatCurrency(sal.gross_earned, 'INR')}</td>
                                    <td class="py-3 px-4 text-red-600">${Utils.formatCurrency(sal.total_deductions, 'INR')}</td>
                                    <td class="py-3 px-4 font-bold text-xl text-blue-600">${Utils.formatCurrency(sal.net_payable, 'INR')}</td>
                                    <td class="py-3 px-4">
                                        ${sal.is_disbursed ? 
                                            '<span class="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">Disbursed</span>' :
                                            '<span class="px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">Pending</span>'
                                        }
                                    </td>
                                    <td class="py-3 px-4">
                                        <button onclick="viewPayslip('${sal.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="View Payslip">
                                            <i class="fas fa-file-invoice"></i>
                                        </button>
                                        ${!sal.is_disbursed ? `
                                            <button onclick="editSalary('${sal.id}')" class="text-green-600 hover:text-green-800 mr-2" title="Edit">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="disburseSingleSalary('${sal.id}')" class="text-purple-600 hover:text-purple-800" title="Disburse">
                                                <i class="fas fa-money-check-alt"></i>
                                            </button>
                                        ` : `
                                            <button onclick="printPayslip('${sal.id}')" class="text-purple-600 hover:text-purple-800" title="Print">
                                                <i class="fas fa-print"></i>
                                            </button>
                                        `}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function showProcessSalaryModal() {
    const employees = await API.getAll('employees');
    const activeEmployees = employees.filter(e => e.is_active);
    
    const formHtml = `
        <form id="processSalaryForm" class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                This will calculate salaries for all active employees based on attendance, advances, and leaves.</p>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Month/Year *</label>
                <input type="month" name="month_year" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p class="text-sm text-yellow-800">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <strong>This will process salaries for ${activeEmployees.length} active employees</strong>
                </p>
                <p class="text-sm text-yellow-800 mt-2">
                    Make sure all attendance and advance records are up to date.
                </p>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-calculator mr-2"></i>Process Salaries
                </button>
            </div>
        </form>
    `;
    
    showModal('Process Monthly Salaries', formHtml);
    
    document.getElementById('processSalaryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const monthYear = formData.get('month_year') + '-01';
        
        try {
            await processSalariesForMonth(monthYear);
            Utils.showNotification('Salaries processed successfully', 'success');
            closeModal();
            loadPage('payroll-process');
        } catch (error) {
            Utils.showNotification('Error processing salaries', 'error');
        }
    });
}

async function processSalariesForMonth(monthYear) {
    const employees = await API.getAll('employees');
    const activeEmployees = employees.filter(e => e.is_active);
    const attendance = await API.getAll('attendance');
    const advances = await API.getAll('advances');
    
    for (const employee of activeEmployees) {
        // Find attendance for this month
        const empAttendance = attendance.find(a => 
            a.employee_id === employee.id && 
            a.month_year === monthYear
        );
        
        if (!empAttendance) {
            console.warn(`No attendance found for ${employee.full_name}`);
            continue;
        }
        
        // Calculate salary components
        const payableDays = empAttendance.payable_days;
        const earnedBasic = (employee.basic_salary / 30) * payableDays;
        const earnedHRA = ((employee.hra || 0) / 30) * payableDays;
        
        // Calculate overtime (workers only)
        let overtimeAmount = 0;
        if (employee.overtime_eligible && empAttendance.overtime_hours > 0) {
            const dailySalary = (employee.basic_salary + (employee.hra || 0)) / 30;
            const hourlyRate = dailySalary / DAILY_WORK_HOURS;
            overtimeAmount = hourlyRate * empAttendance.overtime_hours;
        }
        
        const grossEarned = earnedBasic + earnedHRA + overtimeAmount;
        
        // Calculate deductions
        let esiDeduction = 0;
        if (employee.is_esi_applicable) {
            esiDeduction = grossEarned * ESI_RATE;
        }
        
        let epfDeduction = 0;
        if (employee.is_epf_applicable) {
            epfDeduction = earnedBasic * EPF_RATE;
        }
        
        // Leave deduction
        let leaveDeduction = 0;
        const unpaidLeaves = empAttendance.unpaid_leaves;
        if (unpaidLeaves > 0) {
            if (employee.employee_type === 'Worker') {
                // Workers: deduct all unpaid leaves
                leaveDeduction = (employee.basic_salary / 30) * unpaidLeaves;
            } else if (employee.employee_type === 'Staff') {
                // Staff: first 2 leaves free, rest deducted
                const deductibleLeaves = Math.max(0, unpaidLeaves - 2);
                leaveDeduction = (employee.basic_salary / 30) * deductibleLeaves;
            }
        }
        
        // Advance recovery
        let advanceRecovery = 0;
        const activeAdvance = advances.find(a => 
            a.employee_id === employee.id && 
            (a.status === 'Pending' || a.status === 'Deducting')
        );
        
        if (activeAdvance) {
            advanceRecovery = Math.min(
                activeAdvance.monthly_deduction,
                activeAdvance.balance || (activeAdvance.advance_amount - (activeAdvance.deducted_so_far || 0))
            );
            
            // Update advance record
            const newDeducted = (activeAdvance.deducted_so_far || 0) + advanceRecovery;
            const newBalance = activeAdvance.advance_amount - newDeducted;
            
            await API.patch('advances', activeAdvance.id, {
                deducted_so_far: newDeducted,
                balance: newBalance,
                status: newBalance <= 0 ? 'Completed' : 'Deducting',
                completion_date: newBalance <= 0 ? new Date().toISOString().split('T')[0] : null
            });
        }
        
        const totalDeductions = esiDeduction + epfDeduction + leaveDeduction + advanceRecovery;
        const netPayable = grossEarned - totalDeductions;
        
        // Create salary record
        const salaryData = {
            id: Utils.generateId('sal'),
            employee_id: employee.id,
            month_year: monthYear,
            basic_salary: employee.basic_salary,
            hra: employee.hra || 0,
            earned_basic: earnedBasic,
            earned_hra: earnedHRA,
            overtime_hours: empAttendance.overtime_hours || 0,
            overtime_amount: overtimeAmount,
            gross_earned: grossEarned,
            esi_deduction: esiDeduction,
            epf_deduction: epfDeduction,
            leave_deduction: leaveDeduction,
            advance_recovery: advanceRecovery,
            other_deductions: 0,
            total_deductions: totalDeductions,
            net_payable: netPayable,
            payable_days: payableDays,
            is_disbursed: false,
            disbursement_date: null,
            payment_method: '',
            processed_by: Auth.getCurrentUser().full_name,
            processed_date: new Date().toISOString().split('T')[0]
        };
        
        await API.create('salary_structure', salaryData);
    }
}

async function viewPayslip(salaryId) {
    const salary = await API.getById('salary_structure', salaryId);
    const employee = await API.getById('employees', salary.employee_id);
    
    const payslipHtml = `
        <div class="payslip-container bg-white p-8" id="payslipContent">
            <!-- Header -->
            <div class="text-center mb-6 border-b-2 border-gray-800 pb-4">
                <img src="https://page.gensparksite.com/v1/base64_upload/9df1f51ca725382bf845fb19357a7ef5" alt="SSI Logo" class="mx-auto mb-3" style="height: 80px; width: auto; background: white; padding: 6px; border-radius: 6px;">
                <h1 class="text-3xl font-bold text-gray-800">SHREE SAI INDUSTRIES</h1>
                <p class="text-sm text-gray-600">Modinagar, UP</p>
                <p class="text-lg font-bold text-blue-600 mt-2">SALARY SLIP</p>
                <p class="text-sm text-gray-600">${Utils.formatDate(salary.month_year, 'MMMM YYYY')}</p>
            </div>
            
            <!-- Employee Details -->
            <div class="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded">
                <div>
                    <p class="text-sm text-gray-600">Employee ID</p>
                    <p class="font-bold">${employee.emp_id}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Employee Name</p>
                    <p class="font-bold">${employee.full_name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Designation</p>
                    <p class="font-medium">${employee.designation}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Unit</p>
                    <p class="font-medium">${employee.unit}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Bank Account</p>
                    <p class="font-medium">${employee.bank_account || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Payable Days</p>
                    <p class="font-bold text-blue-600">${salary.payable_days} / 30</p>
                </div>
            </div>
            
            <!-- Earnings and Deductions -->
            <div class="grid grid-cols-2 gap-6 mb-6">
                <!-- Earnings -->
                <div>
                    <h3 class="font-bold text-gray-800 mb-3 border-b pb-2">EARNINGS</h3>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-sm">Basic Salary</span>
                            <span class="font-medium">${Utils.formatCurrency(salary.earned_basic, 'INR')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-sm">HRA</span>
                            <span class="font-medium">${Utils.formatCurrency(salary.earned_hra, 'INR')}</span>
                        </div>
                        ${salary.overtime_amount > 0 ? `
                            <div class="flex justify-between text-purple-600">
                                <span class="text-sm">Overtime (${salary.overtime_hours} hrs)</span>
                                <span class="font-medium">${Utils.formatCurrency(salary.overtime_amount, 'INR')}</span>
                            </div>
                        ` : ''}
                        <div class="flex justify-between font-bold text-lg border-t pt-2 text-green-600">
                            <span>Gross Earned</span>
                            <span>${Utils.formatCurrency(salary.gross_earned, 'INR')}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Deductions -->
                <div>
                    <h3 class="font-bold text-gray-800 mb-3 border-b pb-2">DEDUCTIONS</h3>
                    <div class="space-y-2">
                        ${salary.esi_deduction > 0 ? `
                            <div class="flex justify-between">
                                <span class="text-sm">ESI (0.75%)</span>
                                <span class="font-medium">${Utils.formatCurrency(salary.esi_deduction, 'INR')}</span>
                            </div>
                        ` : ''}
                        ${salary.epf_deduction > 0 ? `
                            <div class="flex justify-between">
                                <span class="text-sm">EPF (12%)</span>
                                <span class="font-medium">${Utils.formatCurrency(salary.epf_deduction, 'INR')}</span>
                            </div>
                        ` : ''}
                        ${salary.leave_deduction > 0 ? `
                            <div class="flex justify-between text-red-600">
                                <span class="text-sm">Leave Deduction</span>
                                <span class="font-medium">${Utils.formatCurrency(salary.leave_deduction, 'INR')}</span>
                            </div>
                        ` : ''}
                        ${salary.advance_recovery > 0 ? `
                            <div class="flex justify-between text-orange-600">
                                <span class="text-sm">Advance Recovery</span>
                                <span class="font-medium">${Utils.formatCurrency(salary.advance_recovery, 'INR')}</span>
                            </div>
                        ` : ''}
                        ${salary.other_deductions > 0 ? `
                            <div class="flex justify-between">
                                <span class="text-sm">Other Deductions</span>
                                <span class="font-medium">${Utils.formatCurrency(salary.other_deductions, 'INR')}</span>
                            </div>
                        ` : ''}
                        <div class="flex justify-between font-bold text-lg border-t pt-2 text-red-600">
                            <span>Total Deductions</span>
                            <span>${Utils.formatCurrency(salary.total_deductions, 'INR')}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Net Pay -->
            <div class="bg-blue-600 text-white p-4 rounded-lg text-center">
                <p class="text-sm font-medium mb-1">NET PAYABLE</p>
                <p class="text-4xl font-bold">${Utils.formatCurrency(salary.net_payable, 'INR')}</p>
            </div>
            
            <!-- Footer -->
            <div class="mt-6 pt-4 border-t text-sm text-gray-600">
                <div class="flex justify-between">
                    <div>
                        <p>Processed By: ${salary.processed_by}</p>
                        <p>Processed Date: ${Utils.formatDate(salary.processed_date)}</p>
                    </div>
                    ${salary.is_disbursed ? `
                        <div class="text-right">
                            <p class="text-green-600 font-bold">DISBURSED</p>
                            <p>Date: ${Utils.formatDate(salary.disbursement_date)}</p>
                            <p>Method: ${salary.payment_method}</p>
                        </div>
                    ` : `
                        <div class="text-right">
                            <p class="text-yellow-600 font-bold">PENDING DISBURSEMENT</p>
                        </div>
                    `}
                </div>
            </div>
            
            <div class="mt-6 text-center text-xs text-gray-500">
                <p>This is a computer-generated payslip and does not require a signature</p>
            </div>
        </div>
        
        <div class="flex justify-end space-x-4 mt-6 no-print">
            <button onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                Close
            </button>
            <button onclick="printPayslip('${salaryId}')" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                <i class="fas fa-print mr-2"></i>Print Payslip
            </button>
        </div>
    `;
    
    showModal('Payslip - ' + employee.full_name, payslipHtml, 'max-w-4xl');
}

function printPayslip(salaryId) {
    const printContent = document.getElementById('payslipContent').innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Payslip</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .payslip-container { max-width: 800px; margin: 0 auto; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .text-sm { font-size: 14px; }
                .text-xs { font-size: 12px; }
                .mb-6 { margin-bottom: 24px; }
                .mt-6 { margin-top: 24px; }
                .p-4 { padding: 16px; }
                .border-t { border-top: 2px solid #000; }
                .border-b-2 { border-bottom: 2px solid #000; }
                .bg-gray-50 { background-color: #f9fafb; }
                .bg-blue-600 { background-color: #2563eb; color: white; }
                .rounded { border-radius: 8px; }
                .grid { display: grid; }
                .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
                .gap-4 { gap: 16px; }
                .gap-6 { gap: 24px; }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .space-y-2 > * + * { margin-top: 8px; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>${printContent}</body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

async function disburseSingleSalary(salaryId) {
    const formHtml = `
        <form id="disburseForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Disbursement Date *</label>
                <input type="date" name="disbursement_date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                <select name="payment_method" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Method</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                </select>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                    <i class="fas fa-check mr-2"></i>Confirm Disbursement
                </button>
            </div>
        </form>
    `;
    
    showModal('Disburse Salary', formHtml);
    
    document.getElementById('disburseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await API.patch('salary_structure', salaryId, {
                is_disbursed: true,
                disbursement_date: formData.get('disbursement_date'),
                payment_method: formData.get('payment_method')
            });
            
            Utils.showNotification('Salary disbursed successfully', 'success');
            closeModal();
            loadSalaryRecords();
        } catch (error) {
            Utils.showNotification('Error disbursing salary', 'error');
        }
    });
}

async function editSalary(salaryId) {
    const salary = await API.getById('salary_structure', salaryId);
    const employee = await API.getById('employees', salary.employee_id);
    
    const formHtml = `
        <form id="editSalaryForm" class="space-y-4">
            <div class="bg-yellow-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-yellow-800"><i class="fas fa-exclamation-triangle mr-2"></i>
                Manually adjust salary components if needed before disbursement</p>
            </div>
            
            <div class="mb-4">
                <h3 class="font-bold text-lg">${employee.full_name} (${employee.emp_id})</h3>
                <p class="text-gray-600">${Utils.formatDate(salary.month_year, 'MMMM YYYY')}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Earned Basic</label>
                    <input type="number" name="earned_basic" value="${salary.earned_basic}" step="0.01" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Earned HRA</label>
                    <input type="number" name="earned_hra" value="${salary.earned_hra}" step="0.01" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Overtime Amount</label>
                    <input type="number" name="overtime_amount" value="${salary.overtime_amount}" step="0.01" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Other Deductions</label>
                    <input type="number" name="other_deductions" value="${salary.other_deductions}" step="0.01" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="text-sm text-gray-600">Current Net Payable: <span class="font-bold text-lg text-blue-600">${Utils.formatCurrency(salary.net_payable, 'INR')}</span></p>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-save mr-2"></i>Update Salary
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit Salary', formHtml, 'max-w-3xl');
    
    document.getElementById('editSalaryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const earnedBasic = parseFloat(formData.get('earned_basic'));
        const earnedHRA = parseFloat(formData.get('earned_hra'));
        const overtimeAmount = parseFloat(formData.get('overtime_amount'));
        const otherDeductions = parseFloat(formData.get('other_deductions'));
        
        const grossEarned = earnedBasic + earnedHRA + overtimeAmount;
        const totalDeductions = salary.esi_deduction + salary.epf_deduction + salary.leave_deduction + salary.advance_recovery + otherDeductions;
        const netPayable = grossEarned - totalDeductions;
        
        try {
            await API.patch('salary_structure', salaryId, {
                earned_basic: earnedBasic,
                earned_hra: earnedHRA,
                overtime_amount: overtimeAmount,
                other_deductions: otherDeductions,
                gross_earned: grossEarned,
                total_deductions: totalDeductions,
                net_payable: netPayable
            });
            
            Utils.showNotification('Salary updated successfully', 'success');
            closeModal();
            loadSalaryRecords();
        } catch (error) {
            Utils.showNotification('Error updating salary', 'error');
        }
    });
}

async function disbursePendingSalaries() {
    if (!confirm('Disburse all pending salaries for this month?')) return;
    
    const month = parseInt(document.getElementById('salaryMonth').value);
    const year = parseInt(document.getElementById('salaryYear').value);
    
    const salaries = await API.getAll('salary_structure');
    const monthSalaries = salaries.filter(s => {
        const salDate = new Date(s.month_year);
        return salDate.getMonth() + 1 === month && salDate.getFullYear() === year && !s.is_disbursed;
    });
    
    const disbursementDate = new Date().toISOString().split('T')[0];
    
    try {
        for (const salary of monthSalaries) {
            await API.patch('salary_structure', salary.id, {
                is_disbursed: true,
                disbursement_date: disbursementDate,
                payment_method: 'Bank Transfer' // Default
            });
        }
        
        Utils.showNotification(`${monthSalaries.length} salaries disbursed successfully`, 'success');
        loadSalaryRecords();
    } catch (error) {
        Utils.showNotification('Error disbursing salaries', 'error');
    }
}

async function editAdvance(advanceId) {
    const advance = await API.getById('advances', advanceId);
    const employee = await API.getById('employees', advance.employee_id);
    
    const formHtml = `
        <form id="editAdvanceForm" class="space-y-4">
            <div class="mb-4">
                <h3 class="font-bold text-lg">${employee.full_name} (${employee.emp_id})</h3>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Monthly Deduction *</label>
                    <input type="number" name="monthly_deduction" value="${advance.monthly_deduction}" required min="1" step="0.01" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <select name="status" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="Pending" ${advance.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Deducting" ${advance.status === 'Deducting' ? 'selected' : ''}>Deducting</option>
                        <option value="Completed" ${advance.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Reason/Notes</label>
                    <textarea name="reason" rows="2" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">${advance.reason || ''}</textarea>
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-save mr-2"></i>Update Advance
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit Advance', formHtml);
    
    document.getElementById('editAdvanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await API.patch('advances', advanceId, {
                monthly_deduction: parseFloat(formData.get('monthly_deduction')),
                status: formData.get('status'),
                reason: formData.get('reason') || ''
            });
            
            Utils.showNotification('Advance updated successfully', 'success');
            closeModal();
            loadPage('payroll-advances');
        } catch (error) {
            Utils.showNotification('Error updating advance', 'error');
        }
    });
}

// Bulk upload functions
async function showBulkEmployeeUpload() {
    const formHtml = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                Upload a CSV file with employee data. Download the template below for format.</p>
            </div>
            
            <div class="mb-4">
                <button onclick="downloadEmployeeTemplate()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    <i class="fas fa-download mr-2"></i>Download CSV Template
                </button>
            </div>
            
            <form id="bulkEmployeeForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select CSV File *</label>
                    <input type="file" name="csvFile" accept=".csv" required class="w-full px-4 py-2 border rounded-lg">
                </div>
                
                <div class="flex justify-end space-x-4 mt-6">
                    <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-upload mr-2"></i>Upload Employees
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal('Bulk Employee Upload', formHtml);
    
    document.getElementById('bulkEmployeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        Utils.showNotification('Bulk upload feature - CSV processing would happen here', 'info');
        closeModal();
    });
}

function downloadEmployeeTemplate() {
    const csvContent = `full_name,employee_type,unit,designation,date_of_joining,phone,email,address,basic_salary,hra,is_esi_applicable,esi_number,is_epf_applicable,epf_number,overtime_eligible,bank_account,bank_ifsc
Rajesh Kumar,Staff,Modinagar,Manager,2024-01-15,9876543210,rajesh@example.com,"123 Main St, Delhi",25000,5000,true,ESI123456,true,EPF789012,false,1234567890,SBIN0001234
Priya Sharma,Worker,Patla,Worker,2024-02-01,9876543211,priya@example.com,"456 Worker Colony",15000,0,true,ESI123457,false,,true,9876543210,HDFC0002345`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_template.csv';
    a.click();
}

async function showBulkAttendanceUpload() {
    const formHtml = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                Upload attendance data for multiple employees. Download the template below.</p>
            </div>
            
            <div class="mb-4">
                <button onclick="downloadAttendanceTemplate()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    <i class="fas fa-download mr-2"></i>Download CSV Template
                </button>
            </div>
            
            <form id="bulkAttendanceForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select CSV File *</label>
                    <input type="file" name="csvFile" accept=".csv" required class="w-full px-4 py-2 border rounded-lg">
                </div>
                
                <div class="flex justify-end space-x-4 mt-6">
                    <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-upload mr-2"></i>Upload Attendance
                    </button>
                </div>
            </form>
        </div>
    `;
    
    showModal('Bulk Attendance Upload', formHtml);
    
    document.getElementById('bulkAttendanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        Utils.showNotification('Bulk upload feature - CSV processing would happen here', 'info');
        closeModal();
    });
}

function downloadAttendanceTemplate() {
    const csvContent = `emp_id,month_year,days_present,days_absent,paid_leaves,unpaid_leaves,overtime_hours
SSIA004,2024-12,25,3,2,0,0
SSIB001,2024-12,24,4,0,2,8.5`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_template.csv';
    a.click();
}

async function editAttendance(attId) {
    const att = await API.getById('attendance', attId);
    const employees = await API.getAll('employees');
    const employee = employees.find(e => e.id === att.employee_id);
    
    const formHtml = `
        <form id="editAttendanceForm" class="space-y-4">
            <div class="mb-4">
                <h3 class="font-bold text-lg">${employee.full_name} (${employee.emp_id})</h3>
                <p class="text-gray-600">${Utils.formatDate(att.month_year, 'MMMM YYYY')}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Days Present *</label>
                    <input type="number" name="days_present" value="${att.days_present}" required min="0" max="31" onchange="calculateEditPayableDays()" id="editDaysPresent" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Days Absent *</label>
                    <input type="number" name="days_absent" value="${att.days_absent}" required min="0" max="31" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Paid Leaves</label>
                    <input type="number" name="paid_leaves" value="${att.paid_leaves}" min="0" onchange="calculateEditPayableDays()" id="editPaidLeaves" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Unpaid Leaves</label>
                    <input type="number" name="unpaid_leaves" value="${att.unpaid_leaves}" min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Overtime Hours</label>
                    <input type="number" name="overtime_hours" value="${att.overtime_hours || 0}" min="0" step="0.5" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Payable Days (Auto)</label>
                    <input type="number" name="payable_days" value="${att.payable_days}" readonly id="editPayableDays" class="w-full px-4 py-2 border rounded-lg bg-gray-100 font-bold">
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-save mr-2"></i>Update Attendance
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit Attendance', formHtml);
    
    document.getElementById('editAttendanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await API.patch('attendance', attId, {
                days_present: parseInt(formData.get('days_present')),
                days_absent: parseInt(formData.get('days_absent')),
                paid_leaves: parseInt(formData.get('paid_leaves')),
                unpaid_leaves: parseInt(formData.get('unpaid_leaves')),
                overtime_hours: parseFloat(formData.get('overtime_hours')) || 0,
                payable_days: parseInt(formData.get('payable_days'))
            });
            
            Utils.showNotification('Attendance updated successfully', 'success');
            closeModal();
            loadPage('payroll-attendance');
        } catch (error) {
            Utils.showNotification('Error updating attendance', 'error');
        }
    });
}

function calculateEditPayableDays() {
    const present = parseInt(document.getElementById('editDaysPresent').value) || 0;
    const paidLeaves = parseInt(document.getElementById('editPaidLeaves').value) || 0;
    document.getElementById('editPayableDays').value = present + paidLeaves;
}

async function deleteAttendance(attId) {
    if (!confirm('Delete this attendance record?')) return;
    
    try {
        await API.delete('attendance', attId);
        Utils.showNotification('Attendance deleted', 'success');
        loadPage('payroll-attendance');
    } catch (error) {
        Utils.showNotification('Error deleting attendance', 'error');
    }
}
