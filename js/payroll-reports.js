// Payroll Reports Module

async function loadPayrollReports(content, user) {
    content.innerHTML = `
        <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Payroll Reports</h1>
            <p class="text-gray-600">ESI, EPF, salary register, and analytics</p>
        </div>
        
        <!-- Report Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <!-- ESI Report -->
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer" onclick="showESIReport()">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-hospital text-2xl text-blue-600"></i>
                    </div>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
                <h3 class="font-bold text-lg text-gray-800 mb-2">ESI Report</h3>
                <p class="text-sm text-gray-600">Monthly ESI contribution report (Employee: 0.75%, Employer: 3.25%)</p>
            </div>
            
            <!-- EPF Report -->
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer" onclick="showEPFReport()">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-green-100 p-3 rounded-full">
                        <i class="fas fa-piggy-bank text-2xl text-green-600"></i>
                    </div>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
                <h3 class="font-bold text-lg text-gray-800 mb-2">EPF Report</h3>
                <p class="text-sm text-gray-600">Monthly EPF contribution report (Employee: 12%, Employer: 12%)</p>
            </div>
            
            <!-- Salary Register -->
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer" onclick="showSalaryRegister()">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-purple-100 p-3 rounded-full">
                        <i class="fas fa-file-invoice-dollar text-2xl text-purple-600"></i>
                    </div>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
                <h3 class="font-bold text-lg text-gray-800 mb-2">Salary Register</h3>
                <p class="text-sm text-gray-600">Complete monthly salary breakdown for all employees</p>
            </div>
            
            <!-- Advance Register -->
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer" onclick="showAdvanceRegister()">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-orange-100 p-3 rounded-full">
                        <i class="fas fa-hand-holding-usd text-2xl text-orange-600"></i>
                    </div>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
                <h3 class="font-bold text-lg text-gray-800 mb-2">Advance Register</h3>
                <p class="text-sm text-gray-600">Employee advances issued, recovered, and pending</p>
            </div>
            
            <!-- Disbursement Summary -->
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer" onclick="showDisbursementSummary()">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-red-100 p-3 rounded-full">
                        <i class="fas fa-money-check-alt text-2xl text-red-600"></i>
                    </div>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
                <h3 class="font-bold text-lg text-gray-800 mb-2">Disbursement Summary</h3>
                <p class="text-sm text-gray-600">Salary disbursement tracking and payment methods</p>
            </div>
            
            <!-- Payroll Analytics -->
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer" onclick="showPayrollAnalytics()">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-indigo-100 p-3 rounded-full">
                        <i class="fas fa-chart-line text-2xl text-indigo-600"></i>
                    </div>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
                <h3 class="font-bold text-lg text-gray-800 mb-2">Payroll Analytics</h3>
                <p class="text-sm text-gray-600">Visual trends, unit-wise costs, and overtime patterns</p>
            </div>
        </div>
    `;
}

async function showESIReport() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const formHtml = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                ESI Contribution: Employee 0.75% + Employer 3.25% = Total 4% of Gross Salary</p>
            </div>
            
            <div class="flex items-center space-x-4">
                <label class="font-medium text-gray-700">Select Month:</label>
                <select id="esiMonth" class="px-4 py-2 border rounded-lg">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                        <option value="${m}" ${m === currentMonth ? 'selected' : ''}>
                            ${new Date(2024, m-1).toLocaleString('default', { month: 'long' })}
                        </option>
                    `).join('')}
                </select>
                <select id="esiYear" class="px-4 py-2 border rounded-lg">
                    ${[2023, 2024, 2025, 2026].map(y => `
                        <option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>
                    `).join('')}
                </select>
                <button onclick="generateESIReport()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-sync mr-2"></i>Generate
                </button>
            </div>
            
            <div id="esiReportContent">
                <!-- Report will be loaded here -->
            </div>
        </div>
    `;
    
    showModal('ESI Report', formHtml, 'max-w-6xl');
    generateESIReport();
}

async function generateESIReport() {
    const month = parseInt(document.getElementById('esiMonth').value);
    const year = parseInt(document.getElementById('esiYear').value);
    const monthYear = `${year}-${String(month).padStart(2, '0')}-01`;
    
    const salaries = await API.getAll('salary_structure');
    const employees = await API.getAll('employees');
    
    const monthSalaries = salaries.filter(s => {
        const salDate = new Date(s.month_year);
        return salDate.getMonth() + 1 === month && salDate.getFullYear() === year && s.esi_deduction > 0;
    });
    
    if (monthSalaries.length === 0) {
        document.getElementById('esiReportContent').innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-file-excel text-6xl mb-4"></i>
                <p>No ESI applicable salaries for this month</p>
            </div>
        `;
        return;
    }
    
    const totalEmployeeESI = monthSalaries.reduce((sum, s) => sum + s.esi_deduction, 0);
    const totalGross = monthSalaries.reduce((sum, s) => sum + s.gross_earned, 0);
    const totalEmployerESI = totalGross * 0.0325; // 3.25%
    const totalESI = totalEmployeeESI + totalEmployerESI;
    
    const reportHtml = `
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="text-sm text-blue-600 font-medium">Employees Covered</p>
                <p class="text-2xl font-bold text-blue-800">${monthSalaries.length}</p>
            </div>
            <div class="bg-green-50 p-4 rounded-lg">
                <p class="text-sm text-green-600 font-medium">Employee Share (0.75%)</p>
                <p class="text-2xl font-bold text-green-800">${Utils.formatCurrency(totalEmployeeESI, 'INR')}</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg">
                <p class="text-sm text-purple-600 font-medium">Employer Share (3.25%)</p>
                <p class="text-2xl font-bold text-purple-800">${Utils.formatCurrency(totalEmployerESI, 'INR')}</p>
            </div>
            <div class="bg-red-50 p-4 rounded-lg">
                <p class="text-sm text-red-600 font-medium">Total ESI Payable</p>
                <p class="text-2xl font-bold text-red-800">${Utils.formatCurrency(totalESI, 'INR')}</p>
            </div>
        </div>
        
        <!-- Detailed Table -->
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-left py-3 px-4">Emp ID</th>
                        <th class="text-left py-3 px-4">Name</th>
                        <th class="text-left py-3 px-4">ESI Number</th>
                        <th class="text-left py-3 px-4">Gross Salary</th>
                        <th class="text-left py-3 px-4">Employee (0.75%)</th>
                        <th class="text-left py-3 px-4">Employer (3.25%)</th>
                        <th class="text-left py-3 px-4">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthSalaries.map(sal => {
                        const employee = employees.find(e => e.id === sal.employee_id);
                        if (!employee) return '';
                        
                        const employerShare = sal.gross_earned * 0.0325;
                        const total = sal.esi_deduction + employerShare;
                        
                        return `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-bold">${employee.emp_id}</td>
                                <td class="py-3 px-4">${employee.full_name}</td>
                                <td class="py-3 px-4">${employee.esi_number || 'N/A'}</td>
                                <td class="py-3 px-4">${Utils.formatCurrency(sal.gross_earned, 'INR')}</td>
                                <td class="py-3 px-4 text-green-600">${Utils.formatCurrency(sal.esi_deduction, 'INR')}</td>
                                <td class="py-3 px-4 text-purple-600">${Utils.formatCurrency(employerShare, 'INR')}</td>
                                <td class="py-3 px-4 font-bold">${Utils.formatCurrency(total, 'INR')}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="bg-blue-50 font-bold">
                        <td colspan="4" class="py-3 px-4 text-right">TOTAL:</td>
                        <td class="py-3 px-4 text-green-600">${Utils.formatCurrency(totalEmployeeESI, 'INR')}</td>
                        <td class="py-3 px-4 text-purple-600">${Utils.formatCurrency(totalEmployerESI, 'INR')}</td>
                        <td class="py-3 px-4 text-red-600">${Utils.formatCurrency(totalESI, 'INR')}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="mt-6 flex justify-end space-x-4">
            <button onclick="exportTableToExcel('ESI_Report_${month}_${year}')" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                <i class="fas fa-file-excel mr-2"></i>Export to Excel
            </button>
        </div>
    `;
    
    document.getElementById('esiReportContent').innerHTML = reportHtml;
}

async function showEPFReport() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const formHtml = `
        <div class="space-y-4">
            <div class="bg-green-50 p-4 rounded-lg">
                <p class="text-sm text-green-800"><i class="fas fa-info-circle mr-2"></i>
                EPF Contribution: Employee 12% + Employer 12% = Total 24% of Basic Salary</p>
            </div>
            
            <div class="flex items-center space-x-4">
                <label class="font-medium text-gray-700">Select Month:</label>
                <select id="epfMonth" class="px-4 py-2 border rounded-lg">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                        <option value="${m}" ${m === currentMonth ? 'selected' : ''}>
                            ${new Date(2024, m-1).toLocaleString('default', { month: 'long' })}
                        </option>
                    `).join('')}
                </select>
                <select id="epfYear" class="px-4 py-2 border rounded-lg">
                    ${[2023, 2024, 2025, 2026].map(y => `
                        <option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>
                    `).join('')}
                </select>
                <button onclick="generateEPFReport()" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                    <i class="fas fa-sync mr-2"></i>Generate
                </button>
            </div>
            
            <div id="epfReportContent">
                <!-- Report will be loaded here -->
            </div>
        </div>
    `;
    
    showModal('EPF Report', formHtml, 'max-w-6xl');
    generateEPFReport();
}

async function generateEPFReport() {
    const month = parseInt(document.getElementById('epfMonth').value);
    const year = parseInt(document.getElementById('epfYear').value);
    const monthYear = `${year}-${String(month).padStart(2, '0')}-01`;
    
    const salaries = await API.getAll('salary_structure');
    const employees = await API.getAll('employees');
    
    const monthSalaries = salaries.filter(s => {
        const salDate = new Date(s.month_year);
        return salDate.getMonth() + 1 === month && salDate.getFullYear() === year && s.epf_deduction > 0;
    });
    
    if (monthSalaries.length === 0) {
        document.getElementById('epfReportContent').innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-file-excel text-6xl mb-4"></i>
                <p>No EPF applicable salaries for this month</p>
            </div>
        `;
        return;
    }
    
    const totalEmployeeEPF = monthSalaries.reduce((sum, s) => sum + s.epf_deduction, 0);
    const totalBasic = monthSalaries.reduce((sum, s) => sum + s.earned_basic, 0);
    const totalEmployerEPF = totalBasic * 0.12; // 12%
    const totalEPF = totalEmployeeEPF + totalEmployerEPF;
    
    const reportHtml = `
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-green-50 p-4 rounded-lg">
                <p class="text-sm text-green-600 font-medium">Employees Covered</p>
                <p class="text-2xl font-bold text-green-800">${monthSalaries.length}</p>
            </div>
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="text-sm text-blue-600 font-medium">Employee Share (12%)</p>
                <p class="text-2xl font-bold text-blue-800">${Utils.formatCurrency(totalEmployeeEPF, 'INR')}</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg">
                <p class="text-sm text-purple-600 font-medium">Employer Share (12%)</p>
                <p class="text-2xl font-bold text-purple-800">${Utils.formatCurrency(totalEmployerEPF, 'INR')}</p>
            </div>
            <div class="bg-red-50 p-4 rounded-lg">
                <p class="text-sm text-red-600 font-medium">Total EPF Payable</p>
                <p class="text-2xl font-bold text-red-800">${Utils.formatCurrency(totalEPF, 'INR')}</p>
            </div>
        </div>
        
        <!-- Detailed Table -->
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-left py-3 px-4">Emp ID</th>
                        <th class="text-left py-3 px-4">Name</th>
                        <th class="text-left py-3 px-4">EPF Number / UAN</th>
                        <th class="text-left py-3 px-4">Basic Salary</th>
                        <th class="text-left py-3 px-4">Employee (12%)</th>
                        <th class="text-left py-3 px-4">Employer (12%)</th>
                        <th class="text-left py-3 px-4">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthSalaries.map(sal => {
                        const employee = employees.find(e => e.id === sal.employee_id);
                        if (!employee) return '';
                        
                        const employerShare = sal.earned_basic * 0.12;
                        const total = sal.epf_deduction + employerShare;
                        
                        return `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-bold">${employee.emp_id}</td>
                                <td class="py-3 px-4">${employee.full_name}</td>
                                <td class="py-3 px-4">${employee.epf_number || 'N/A'}</td>
                                <td class="py-3 px-4">${Utils.formatCurrency(sal.earned_basic, 'INR')}</td>
                                <td class="py-3 px-4 text-blue-600">${Utils.formatCurrency(sal.epf_deduction, 'INR')}</td>
                                <td class="py-3 px-4 text-purple-600">${Utils.formatCurrency(employerShare, 'INR')}</td>
                                <td class="py-3 px-4 font-bold">${Utils.formatCurrency(total, 'INR')}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="bg-green-50 font-bold">
                        <td colspan="4" class="py-3 px-4 text-right">TOTAL:</td>
                        <td class="py-3 px-4 text-blue-600">${Utils.formatCurrency(totalEmployeeEPF, 'INR')}</td>
                        <td class="py-3 px-4 text-purple-600">${Utils.formatCurrency(totalEmployerEPF, 'INR')}</td>
                        <td class="py-3 px-4 text-red-600">${Utils.formatCurrency(totalEPF, 'INR')}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="mt-6 flex justify-end space-x-4">
            <button onclick="exportTableToExcel('EPF_Report_${month}_${year}')" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                <i class="fas fa-file-excel mr-2"></i>Export to Excel
            </button>
        </div>
    `;
    
    document.getElementById('epfReportContent').innerHTML = reportHtml;
}

async function showSalaryRegister() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const formHtml = `
        <div class="space-y-4">
            <div class="flex items-center space-x-4">
                <label class="font-medium text-gray-700">Select Month:</label>
                <select id="registerMonth" class="px-4 py-2 border rounded-lg">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                        <option value="${m}" ${m === currentMonth ? 'selected' : ''}>
                            ${new Date(2024, m-1).toLocaleString('default', { month: 'long' })}
                        </option>
                    `).join('')}
                </select>
                <select id="registerYear" class="px-4 py-2 border rounded-lg">
                    ${[2023, 2024, 2025, 2026].map(y => `
                        <option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>
                    `).join('')}
                </select>
                <button onclick="generateSalaryRegister()" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">
                    <i class="fas fa-sync mr-2"></i>Generate
                </button>
            </div>
            
            <div id="registerContent">
                <!-- Report will be loaded here -->
            </div>
        </div>
    `;
    
    showModal('Salary Register', formHtml, 'max-w-full');
    generateSalaryRegister();
}

async function generateSalaryRegister() {
    const month = parseInt(document.getElementById('registerMonth').value);
    const year = parseInt(document.getElementById('registerYear').value);
    
    const salaries = await API.getAll('salary_structure');
    const employees = await API.getAll('employees');
    
    const monthSalaries = salaries.filter(s => {
        const salDate = new Date(s.month_year);
        return salDate.getMonth() + 1 === month && salDate.getFullYear() === year;
    });
    
    if (monthSalaries.length === 0) {
        document.getElementById('registerContent').innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-file-invoice text-6xl mb-4"></i>
                <p>No salary data for this month</p>
            </div>
        `;
        return;
    }
    
    // Unit-wise breakdown
    const modinagarSalaries = monthSalaries.filter(s => {
        const emp = employees.find(e => e.id === s.employee_id);
        return emp && emp.unit === 'Modinagar';
    });
    
    const patlaSalaries = monthSalaries.filter(s => {
        const emp = employees.find(e => e.id === s.employee_id);
        return emp && emp.unit === 'Patla';
    });
    
    const registerHtml = `
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-left py-2 px-2">Emp ID</th>
                        <th class="text-left py-2 px-2">Name</th>
                        <th class="text-left py-2 px-2">Unit</th>
                        <th class="text-left py-2 px-2">Days</th>
                        <th class="text-left py-2 px-2">Basic</th>
                        <th class="text-left py-2 px-2">HRA</th>
                        <th class="text-left py-2 px-2">OT</th>
                        <th class="text-left py-2 px-2">Gross</th>
                        <th class="text-left py-2 px-2">ESI</th>
                        <th class="text-left py-2 px-2">EPF</th>
                        <th class="text-left py-2 px-2">Leaves</th>
                        <th class="text-left py-2 px-2">Advance</th>
                        <th class="text-left py-2 px-2">Total Ded.</th>
                        <th class="text-left py-2 px-2">Net Pay</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthSalaries.map(sal => {
                        const employee = employees.find(e => e.id === sal.employee_id);
                        if (!employee) return '';
                        
                        return `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-2 px-2 font-bold">${employee.emp_id}</td>
                                <td class="py-2 px-2">${employee.full_name}</td>
                                <td class="py-2 px-2">${employee.unit}</td>
                                <td class="py-2 px-2">${sal.payable_days}</td>
                                <td class="py-2 px-2">₹${sal.earned_basic.toFixed(0)}</td>
                                <td class="py-2 px-2">₹${sal.earned_hra.toFixed(0)}</td>
                                <td class="py-2 px-2">${sal.overtime_amount > 0 ? '₹' + sal.overtime_amount.toFixed(0) : '-'}</td>
                                <td class="py-2 px-2 font-bold">₹${sal.gross_earned.toFixed(0)}</td>
                                <td class="py-2 px-2">${sal.esi_deduction > 0 ? '₹' + sal.esi_deduction.toFixed(0) : '-'}</td>
                                <td class="py-2 px-2">${sal.epf_deduction > 0 ? '₹' + sal.epf_deduction.toFixed(0) : '-'}</td>
                                <td class="py-2 px-2">${sal.leave_deduction > 0 ? '₹' + sal.leave_deduction.toFixed(0) : '-'}</td>
                                <td class="py-2 px-2">${sal.advance_recovery > 0 ? '₹' + sal.advance_recovery.toFixed(0) : '-'}</td>
                                <td class="py-2 px-2 text-red-600">₹${sal.total_deductions.toFixed(0)}</td>
                                <td class="py-2 px-2 font-bold text-green-600">₹${sal.net_payable.toFixed(0)}</td>
                            </tr>
                        `;
                    }).join('')}
                    
                    <!-- Modinagar Subtotal -->
                    <tr class="bg-blue-50 font-bold">
                        <td colspan="7" class="py-2 px-2">Modinagar Subtotal (${modinagarSalaries.length} emp):</td>
                        <td class="py-2 px-2">₹${modinagarSalaries.reduce((s, sal) => s + sal.gross_earned, 0).toFixed(0)}</td>
                        <td colspan="4"></td>
                        <td class="py-2 px-2 text-red-600">₹${modinagarSalaries.reduce((s, sal) => s + sal.total_deductions, 0).toFixed(0)}</td>
                        <td class="py-2 px-2 text-green-600">₹${modinagarSalaries.reduce((s, sal) => s + sal.net_payable, 0).toFixed(0)}</td>
                    </tr>
                    
                    <!-- Patla Subtotal -->
                    <tr class="bg-green-50 font-bold">
                        <td colspan="7" class="py-2 px-2">Patla Subtotal (${patlaSalaries.length} emp):</td>
                        <td class="py-2 px-2">₹${patlaSalaries.reduce((s, sal) => s + sal.gross_earned, 0).toFixed(0)}</td>
                        <td colspan="4"></td>
                        <td class="py-2 px-2 text-red-600">₹${patlaSalaries.reduce((s, sal) => s + sal.total_deductions, 0).toFixed(0)}</td>
                        <td class="py-2 px-2 text-green-600">₹${patlaSalaries.reduce((s, sal) => s + sal.net_payable, 0).toFixed(0)}</td>
                    </tr>
                    
                    <!-- Grand Total -->
                    <tr class="bg-purple-50 font-bold text-lg">
                        <td colspan="7" class="py-3 px-2">GRAND TOTAL (${monthSalaries.length} emp):</td>
                        <td class="py-3 px-2">₹${monthSalaries.reduce((s, sal) => s + sal.gross_earned, 0).toFixed(0)}</td>
                        <td colspan="4"></td>
                        <td class="py-3 px-2 text-red-600">₹${monthSalaries.reduce((s, sal) => s + sal.total_deductions, 0).toFixed(0)}</td>
                        <td class="py-3 px-2 text-green-600">₹${monthSalaries.reduce((s, sal) => s + sal.net_payable, 0).toFixed(0)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="mt-6 flex justify-end space-x-4">
            <button onclick="exportTableToExcel('Salary_Register_${month}_${year}')" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                <i class="fas fa-file-excel mr-2"></i>Export to Excel
            </button>
        </div>
    `;
    
    document.getElementById('registerContent').innerHTML = registerHtml;
}

async function showAdvanceRegister() {
    const advances = await API.getAll('advances');
    const employees = await API.getAll('employees');
    
    const totalAdvanced = advances.reduce((sum, a) => sum + a.advance_amount, 0);
    const totalRecovered = advances.reduce((sum, a) => sum + (a.deducted_so_far || 0), 0);
    const totalPending = totalAdvanced - totalRecovered;
    
    const reportHtml = `
        <div class="space-y-6">
            <!-- Summary -->
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-purple-50 p-4 rounded-lg">
                    <p class="text-sm text-purple-600 font-medium">Total Advanced</p>
                    <p class="text-2xl font-bold text-purple-800">${Utils.formatCurrency(totalAdvanced, 'INR')}</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <p class="text-sm text-green-600 font-medium">Total Recovered</p>
                    <p class="text-2xl font-bold text-green-800">${Utils.formatCurrency(totalRecovered, 'INR')}</p>
                </div>
                <div class="bg-red-50 p-4 rounded-lg">
                    <p class="text-sm text-red-600 font-medium">Pending Recovery</p>
                    <p class="text-2xl font-bold text-red-800">${Utils.formatCurrency(totalPending, 'INR')}</p>
                </div>
            </div>
            
            <!-- Detailed Table -->
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Emp ID</th>
                            <th class="text-left py-3 px-4">Name</th>
                            <th class="text-left py-3 px-4">Issue Date</th>
                            <th class="text-left py-3 px-4">Amount</th>
                            <th class="text-left py-3 px-4">Recovered</th>
                            <th class="text-left py-3 px-4">Balance</th>
                            <th class="text-left py-3 px-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${advances.map(adv => {
                            const employee = employees.find(e => e.id === adv.employee_id);
                            if (!employee) return '';
                            
                            const balance = adv.balance || (adv.advance_amount - (adv.deducted_so_far || 0));
                            
                            return `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="py-3 px-4 font-bold">${employee.emp_id}</td>
                                    <td class="py-3 px-4">${employee.full_name}</td>
                                    <td class="py-3 px-4">${Utils.formatDate(adv.issue_date)}</td>
                                    <td class="py-3 px-4">${Utils.formatCurrency(adv.advance_amount, 'INR')}</td>
                                    <td class="py-3 px-4 text-green-600">${Utils.formatCurrency(adv.deducted_so_far || 0, 'INR')}</td>
                                    <td class="py-3 px-4 font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}">
                                        ${Utils.formatCurrency(balance, 'INR')}
                                    </td>
                                    <td class="py-3 px-4">
                                        <span class="px-3 py-1 rounded-full text-sm ${
                                            adv.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                            adv.status === 'Deducting' ? 'bg-blue-100 text-blue-800' :
                                            'bg-green-100 text-green-800'
                                        }">
                                            ${adv.status}
                                        </span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="flex justify-end space-x-4">
                <button onclick="exportTableToExcel('Advance_Register')" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                    <i class="fas fa-file-excel mr-2"></i>Export to Excel
                </button>
            </div>
        </div>
    `;
    
    showModal('Advance Register', reportHtml, 'max-w-6xl');
}

async function showDisbursementSummary() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const formHtml = `
        <div class="space-y-4">
            <div class="flex items-center space-x-4">
                <label class="font-medium text-gray-700">Select Month:</label>
                <select id="disbMonth" class="px-4 py-2 border rounded-lg">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                        <option value="${m}" ${m === currentMonth ? 'selected' : ''}>
                            ${new Date(2024, m-1).toLocaleString('default', { month: 'long' })}
                        </option>
                    `).join('')}
                </select>
                <select id="disbYear" class="px-4 py-2 border rounded-lg">
                    ${[2023, 2024, 2025, 2026].map(y => `
                        <option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>
                    `).join('')}
                </select>
                <button onclick="generateDisbursementSummary()" class="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
                    <i class="fas fa-sync mr-2"></i>Generate
                </button>
            </div>
            
            <div id="disbursementContent">
                <!-- Report will be loaded here -->
            </div>
        </div>
    `;
    
    showModal('Disbursement Summary', formHtml, 'max-w-5xl');
    generateDisbursementSummary();
}

async function generateDisbursementSummary() {
    const month = parseInt(document.getElementById('disbMonth').value);
    const year = parseInt(document.getElementById('disbYear').value);
    
    const salaries = await API.getAll('salary_structure');
    
    const monthSalaries = salaries.filter(s => {
        const salDate = new Date(s.month_year);
        return salDate.getMonth() + 1 === month && salDate.getFullYear() === year;
    });
    
    const disbursed = monthSalaries.filter(s => s.is_disbursed);
    const pending = monthSalaries.filter(s => !s.is_disbursed);
    
    // Group by payment method
    const byMethod = {};
    disbursed.forEach(s => {
        const method = s.payment_method || 'Unknown';
        if (!byMethod[method]) {
            byMethod[method] = { count: 0, amount: 0 };
        }
        byMethod[method].count++;
        byMethod[method].amount += s.net_payable;
    });
    
    const reportHtml = `
        <div class="space-y-6">
            <!-- Status Summary -->
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-green-50 p-6 rounded-lg">
                    <p class="text-sm text-green-600 font-medium">Disbursed</p>
                    <p class="text-3xl font-bold text-green-800">${disbursed.length}</p>
                    <p class="text-xl font-bold text-green-600 mt-2">${Utils.formatCurrency(disbursed.reduce((s, sal) => s + sal.net_payable, 0), 'INR')}</p>
                </div>
                <div class="bg-yellow-50 p-6 rounded-lg">
                    <p class="text-sm text-yellow-600 font-medium">Pending</p>
                    <p class="text-3xl font-bold text-yellow-800">${pending.length}</p>
                    <p class="text-xl font-bold text-yellow-600 mt-2">${Utils.formatCurrency(pending.reduce((s, sal) => s + sal.net_payable, 0), 'INR')}</p>
                </div>
            </div>
            
            <!-- By Payment Method -->
            <div>
                <h3 class="font-bold text-lg mb-4">Disbursement by Payment Method</h3>
                <div class="grid grid-cols-2 gap-4">
                    ${Object.keys(byMethod).map(method => `
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <p class="text-sm text-gray-600">${method}</p>
                            <p class="text-xl font-bold">${byMethod[method].count} employees</p>
                            <p class="text-lg font-bold text-blue-600">${Utils.formatCurrency(byMethod[method].amount, 'INR')}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('disbursementContent').innerHTML = reportHtml;
}

async function showPayrollAnalytics() {
    const salaries = await API.getAll('salary_structure');
    const employees = await API.getAll('employees');
    
    // Prepare data for last 6 months
    const months = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        months.push({
            label: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear(),
            month: d.getMonth() + 1,
            year: d.getFullYear()
        });
    }
    
    const analyticsHtml = `
        <div class="space-y-6">
            <!-- Payroll Trend Chart -->
            <div class="bg-white p-6 rounded-lg">
                <h3 class="font-bold text-lg mb-4">Monthly Payroll Trend</h3>
                <canvas id="payrollTrendChart" style="height: 300px;"></canvas>
            </div>
            
            <!-- Unit-wise Comparison -->
            <div class="bg-white p-6 rounded-lg">
                <h3 class="font-bold text-lg mb-4">Unit-wise Cost Comparison</h3>
                <canvas id="unitComparisonChart" style="height: 300px;"></canvas>
            </div>
            
            <!-- Overtime Patterns -->
            <div class="bg-white p-6 rounded-lg">
                <h3 class="font-bold text-lg mb-4">Overtime Hours Trend</h3>
                <canvas id="overtimeChart" style="height: 300px;"></canvas>
            </div>
        </div>
    `;
    
    showModal('Payroll Analytics', analyticsHtml, 'max-w-6xl');
    
    // Wait for modal to render
    setTimeout(() => {
        renderPayrollCharts(months, salaries, employees);
    }, 100);
}

function renderPayrollCharts(months, salaries, employees) {
    // Payroll Trend Chart
    const trendData = months.map(m => {
        const monthSalaries = salaries.filter(s => {
            const d = new Date(s.month_year);
            return d.getMonth() + 1 === m.month && d.getFullYear() === m.year;
        });
        return monthSalaries.reduce((sum, s) => sum + s.net_payable, 0);
    });
    
    new Chart(document.getElementById('payrollTrendChart'), {
        type: 'line',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Total Payroll',
                data: trendData,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    // Unit Comparison Chart
    const latestMonth = months[months.length - 1];
    const latestSalaries = salaries.filter(s => {
        const d = new Date(s.month_year);
        return d.getMonth() + 1 === latestMonth.month && d.getFullYear() === latestMonth.year;
    });
    
    const modinagarCost = latestSalaries.filter(s => {
        const emp = employees.find(e => e.id === s.employee_id);
        return emp && emp.unit === 'Modinagar';
    }).reduce((sum, s) => sum + s.net_payable, 0);
    
    const patlaCost = latestSalaries.filter(s => {
        const emp = employees.find(e => e.id === s.employee_id);
        return emp && emp.unit === 'Patla';
    }).reduce((sum, s) => sum + s.net_payable, 0);
    
    new Chart(document.getElementById('unitComparisonChart'), {
        type: 'bar',
        data: {
            labels: ['Modinagar', 'Patla'],
            datasets: [{
                label: 'Payroll Cost',
                data: [modinagarCost, patlaCost],
                backgroundColor: ['#3B82F6', '#10B981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    // Overtime Chart
    const overtimeData = months.map(m => {
        const monthSalaries = salaries.filter(s => {
            const d = new Date(s.month_year);
            return d.getMonth() + 1 === m.month && d.getFullYear() === m.year;
        });
        return monthSalaries.reduce((sum, s) => sum + (s.overtime_hours || 0), 0);
    });
    
    new Chart(document.getElementById('overtimeChart'), {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Overtime Hours',
                data: overtimeData,
                backgroundColor: '#8B5CF6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Export to Excel function (basic)
function exportTableToExcel(filename) {
    Utils.showNotification('Export functionality would save table as: ' + filename + '.xlsx', 'info');
}
