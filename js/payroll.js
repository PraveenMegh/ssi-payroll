// Payroll Management Module

// Constants
const ESI_RATE = 0.0075; // 0.75% employee contribution
const EPF_RATE = 0.12; // 12% employee contribution
const MONTHLY_DAYS = 30;
const DUTY_HOURS_START = '09:00';
const DUTY_HOURS_END = '17:30';
const DAILY_WORK_HOURS = 8.5;

// Staff password (can be changed)
const STAFF_VIEW_PASSWORD = 'staff@2024';
let staffViewUnlocked = false;

// Employee Management
async function loadEmployeeManagement(content, user) {
    const employees = await API.getAll('employees');
    
    // Sort: Partners first, then by emp_id
    employees.sort((a, b) => {
        if (a.employee_type === 'Partner' && b.employee_type !== 'Partner') return -1;
        if (a.employee_type !== 'Partner' && b.employee_type === 'Partner') return 1;
        return a.emp_id.localeCompare(b.emp_id);
    });
    
    // Separate Workers and Staff
    const workersOnly = employees.filter(e => e.employee_type === 'Worker');
    const staffOnly = employees.filter(e => e.employee_type === 'Staff' || e.employee_type === 'Partner');
    
    const activeEmployees = employees.filter(e => e.is_active);
    const modinagarCount = activeEmployees.filter(e => e.unit === 'Modinagar').length;
    const patlaCount = activeEmployees.filter(e => e.unit === 'Patla').length;
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Employee Management</h1>
                <p class="text-gray-600">Manage employees and workers across both units</p>
            </div>
            <div class="flex space-x-2">
                <button onclick="showBulkEmployeeUpload()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition duration-200">
                    <i class="fas fa-upload mr-2"></i>Bulk Upload
                </button>
                <button onclick="showAddEmployeeModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-plus mr-2"></i>Add Employee
                </button>
            </div>
        </div>
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Active</p>
                        <p class="text-3xl font-bold text-gray-800 mt-2">${activeEmployees.length}</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-users text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Modinagar (HO)</p>
                        <p class="text-3xl font-bold text-blue-600 mt-2">${modinagarCount}</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-industry text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Patla Unit</p>
                        <p class="text-3xl font-bold text-green-600 mt-2">${patlaCount}</p>
                    </div>
                    <div class="bg-green-100 p-3 rounded-full">
                        <i class="fas fa-industry text-2xl text-green-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Partners</p>
                        <p class="text-3xl font-bold text-purple-600 mt-2">${employees.filter(e => e.employee_type === 'Partner').length}</p>
                    </div>
                    <div class="bg-purple-100 p-3 rounded-full">
                        <i class="fas fa-crown text-2xl text-purple-600"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Employee List -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b flex justify-between items-center">
                <input type="text" id="employeeSearch" placeholder="Search employees..." 
                    class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mr-4"
                    onkeyup="searchEmployees()">
                <div class="flex space-x-2">
                    <button onclick="showWorkers()" class="emp-type-filter-btn px-4 py-2 rounded-lg bg-green-600 text-white text-sm" data-type="workers">
                        <i class="fas fa-hard-hat mr-2"></i>Workers
                    </button>
                    <button onclick="promptStaffPassword()" class="emp-type-filter-btn px-4 py-2 rounded-lg bg-orange-600 text-white text-sm" data-type="staff">
                        <i class="fas fa-lock mr-2"></i>View Staff
                    </button>
                    <button onclick="filterEmployeesByUnit('all')" class="emp-filter-btn px-4 py-2 rounded-lg bg-blue-600 text-white text-sm" data-unit="all">All Units</button>
                    <button onclick="filterEmployeesByUnit('Modinagar')" class="emp-filter-btn px-4 py-2 rounded-lg bg-gray-200 text-sm" data-unit="Modinagar">Modinagar</button>
                    <button onclick="filterEmployeesByUnit('Patla')" class="emp-filter-btn px-4 py-2 rounded-lg bg-gray-200 text-sm" data-unit="Patla">Patla</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full" id="employeeTable">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Emp ID</th>
                            <th class="text-left py-3 px-4">Name</th>
                            <th class="text-left py-3 px-4">Type</th>
                            <th class="text-left py-3 px-4">Designation</th>
                            <th class="text-left py-3 px-4">Unit</th>
                            <th class="text-left py-3 px-4">Basic Salary</th>
                            <th class="text-left py-3 px-4">HRA</th>
                            <th class="text-left py-3 px-4">ESI/EPF</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="employeeTableBody">
                        ${workersOnly.map(emp => `
                            <tr class="border-b hover:bg-gray-50 employee-row" data-unit="${emp.unit}" data-type="worker">
                                <td class="py-3 px-4 font-bold">${emp.emp_id}</td>
                                <td class="py-3 px-4">
                                    <div class="font-medium">${emp.full_name}</div>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">${emp.employee_type}</span>
                                </td>
                                    }">${emp.employee_type}</span>
                                </td>
                                <td class="py-3 px-4">${emp.designation}</td>
                                <td class="py-3 px-4">${emp.unit}</td>
                                <td class="py-3 px-4">${Utils.formatCurrency(emp.basic_salary, 'INR')}</td>
                                <td class="py-3 px-4">${Utils.formatCurrency(emp.hra || 0, 'INR')}</td>
                                <td class="py-3 px-4">
                                    ${emp.is_esi_applicable ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">ESI</span>' : ''}
                                    ${emp.is_epf_applicable ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">EPF</span>' : ''}
                                    ${!emp.is_esi_applicable && !emp.is_epf_applicable ? '<span class="text-xs text-gray-400">N/A</span>' : ''}
                                </td>
                                <td class="py-3 px-4">
                                    ${emp.is_active ? 
                                        '<span class="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">Active</span>' :
                                        '<span class="px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">Inactive</span>'
                                    }
                                </td>
                                <td class="py-3 px-4">
                                    <button onclick="viewEmployee('${emp.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="View">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    ${user.role === 'Admin' ? `
                                        <button onclick="editEmployee('${emp.id}')" class="text-green-600 hover:text-green-800 mr-2" title="Edit">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        ${emp.is_active ? `
                                            <button onclick="markEmployeeExit('${emp.id}')" class="text-red-600 hover:text-red-800" title="Mark Exit">
                                                <i class="fas fa-sign-out-alt"></i>
                                            </button>
                                        ` : ''}
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    window.allEmployees = employees;
}

function filterEmployeesByUnit(unit) {
    const rows = document.querySelectorAll('#employeeTable tbody tr');
    rows.forEach(row => {
        if (unit === 'all') {
            row.style.display = '';
        } else {
            row.style.display = row.dataset.unit === unit ? '' : 'none';
        }
    });
    
    // Update button styles
    document.querySelectorAll('.emp-filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200');
    });
    document.querySelector(`[data-unit="${unit}"]`).classList.add('bg-blue-600', 'text-white');
    document.querySelector(`[data-unit="${unit}"]`).classList.remove('bg-gray-200');
}

function searchEmployees() {
    const searchTerm = document.getElementById('employeeSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#employeeTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Password protection for Staff view
function promptStaffPassword() {
    if (staffViewUnlocked) {
        showStaff();
        return;
    }
    
    const password = prompt('Enter password to view Staff details:');
    if (password === STAFF_VIEW_PASSWORD) {
        staffViewUnlocked = true;
        Utils.showNotification('Access granted! Showing Staff members.', 'success');
        showStaff();
    } else if (password !== null) {
        Utils.showNotification('Incorrect password! Access denied.', 'error');
    }
}

async function showWorkers() {
    const employees = await API.getAll('employees');
    const workersOnly = employees.filter(e => e.employee_type === 'Worker');
    renderEmployeeTable(workersOnly, 'workers');
}

async function showStaff() {
    const employees = await API.getAll('employees');
    const staffOnly = employees.filter(e => e.employee_type === 'Staff' || e.employee_type === 'Partner');
    renderEmployeeTable(staffOnly, 'staff');
}

function renderEmployeeTable(employees, type) {
    const tbody = document.getElementById('employeeTableBody');
    
    // Filter based on password lock status
    let displayEmployees = employees;
    if (!staffViewUnlocked) {
        // Only show Workers when staff view is locked
        displayEmployees = employees.filter(emp => emp.employee_type === 'Worker');
    }
    
    displayEmployees.sort((a, b) => {
        // Sort alphabetically by full_name
        return a.full_name.localeCompare(b.full_name);
    });
    
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    
    tbody.innerHTML = displayEmployees.map(emp => `
        <tr class="border-b hover:bg-gray-50 employee-row ${emp.employee_type === 'Partner' ? 'bg-purple-50' : ''}" data-unit="${emp.unit}" data-type="${type}">
            <td class="py-3 px-4 font-bold">${emp.emp_id}</td>
            <td class="py-3 px-4">
                <div class="font-medium">${emp.full_name}</div>
                ${emp.employee_type === 'Partner' ? '<span class="text-xs text-purple-600 font-bold">👑 PARTNER</span>' : ''}
            </td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 rounded-full text-xs ${
                    emp.employee_type === 'Partner' ? 'bg-purple-100 text-purple-800' :
                    emp.employee_type === 'Staff' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                }">${emp.employee_type}</span>
            </td>
            <td class="py-3 px-4">${emp.designation}</td>
            <td class="py-3 px-4">${emp.unit}</td>
            <td class="py-3 px-4">${Utils.formatCurrency(emp.basic_salary, 'INR')}</td>
            <td class="py-3 px-4">${Utils.formatCurrency(emp.hra || 0, 'INR')}</td>
            <td class="py-3 px-4">
                ${emp.is_esi_applicable ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">ESI</span>' : ''}
                ${emp.is_epf_applicable ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">EPF</span>' : ''}
                ${!emp.is_esi_applicable && !emp.is_epf_applicable ? '<span class="text-xs text-gray-400">N/A</span>' : ''}
            </td>
            <td class="py-3 px-4">
                ${emp.is_active ? 
                    '<span class="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">Active</span>' :
                    '<span class="px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">Inactive</span>'
                }
            </td>
            <td class="py-3 px-4">
                <button onclick="viewEmployee('${emp.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${user.role === 'Admin' ? `
                    <button onclick="editEmployee('${emp.id}')" class="text-green-600 hover:text-green-800 mr-2" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${emp.is_active ? `
                        <button onclick="markEmployeeExit('${emp.id}')" class="text-red-600 hover:text-red-800" title="Mark Exit">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    ` : ''}
                ` : ''}
            </td>
        </tr>
    `).join('');
    
    // Update button styles
    document.querySelectorAll('.emp-type-filter-btn').forEach(btn => {
        btn.classList.remove('bg-green-600', 'bg-orange-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-800');
    });
    
    const activeBtn = document.querySelector(`[data-type="${type}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-800');
        if (type === 'workers') {
            activeBtn.classList.add('bg-green-600', 'text-white');
        } else {
            activeBtn.classList.add('bg-orange-600', 'text-white');
        }
    }
}


// Generate next employee ID
async function generateNextEmployeeId(employeeType, unit) {
    const employees = await API.getAll('employees');
    const prefix = employeeType === 'Staff' ? 'SSIA' : 'SSIB';
    
    // Get existing IDs with this prefix
    const existingIds = employees
        .filter(e => e.emp_id.startsWith(prefix))
        .map(e => parseInt(e.emp_id.replace(prefix, '')))
        .filter(num => !isNaN(num));
    
    // Find next available number
    let nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : (prefix === 'SSIA' ? 4 : 1); // Start from 4 for SSIA (partners 1-3)
    
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

async function showAddEmployeeModal() {
    const formHtml = `
        <form id="addEmployeeForm" class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                Employee ID will be auto-generated: SSIA for Staff, SSIB for Workers</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input type="text" name="full_name" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Employee Type *</label>
                    <select name="employee_type" id="employeeTypeSelect" required onchange="updateEmployeeTypeFields()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Type</option>
                        <option value="Staff">Staff</option>
                        <option value="Worker">Worker</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
                    <select name="unit" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Unit</option>
                        <option value="Modinagar">Modinagar (HO)</option>
                        <option value="Patla">Patla</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Designation *</label>
                    <input type="text" name="designation" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Date of Joining *</label>
                    <input type="date" name="date_of_joining" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input type="tel" name="phone" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input type="email" name="email" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                    <textarea name="address" required rows="2" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                </div>
                
                <!-- Salary Section -->
                <div class="md:col-span-2 border-t pt-4">
                    <h3 class="font-bold text-gray-800 mb-3">Salary Structure</h3>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Basic Salary *</label>
                    <input type="number" name="basic_salary" id="basicSalaryInput" required min="0" step="0.01" onchange="calculateGrossSalary()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">HRA (Optional)</label>
                    <input type="number" name="hra" id="hraInput" min="0" step="0.01" onchange="calculateGrossSalary()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Gross Salary (Auto)</label>
                    <input type="number" id="grossSalaryDisplay" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100 font-bold">
                </div>
                
                <!-- Statutory Section -->
                <div class="md:col-span-2 border-t pt-4">
                    <h3 class="font-bold text-gray-800 mb-3">Statutory Details</h3>
                </div>
                <div>
                    <label class="flex items-center">
                        <input type="checkbox" name="is_esi_applicable" id="esiCheck" onchange="updateStatutoryFields()" class="mr-2">
                        <span class="text-sm font-medium text-gray-700">ESI Applicable</span>
                    </label>
                </div>
                <div id="esiNumberField" style="display:none;">
                    <label class="block text-sm font-medium text-gray-700 mb-2">ESI Number</label>
                    <input type="text" name="esi_number" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="flex items-center">
                        <input type="checkbox" name="is_epf_applicable" id="epfCheck" onchange="updateStatutoryFields()" class="mr-2">
                        <span class="text-sm font-medium text-gray-700">EPF Applicable (Coming Soon)</span>
                    </label>
                </div>
                <div id="epfNumberField" style="display:none;">
                    <label class="block text-sm font-medium text-gray-700 mb-2">EPF Number</label>
                    <input type="text" name="epf_number" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <!-- Bank Details -->
                <div class="md:col-span-2 border-t pt-4">
                    <h3 class="font-bold text-gray-800 mb-3">Bank Details</h3>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Bank Account Number</label>
                    <input type="text" name="bank_account" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Bank IFSC Code</label>
                    <input type="text" name="bank_ifsc" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <!-- Additional Info -->
                <div id="overtimeField" class="md:col-span-2" style="display:none;">
                    <label class="flex items-center">
                        <input type="checkbox" name="overtime_eligible" class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Overtime Eligible (for Workers only)</span>
                    </label>
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Save Employee
                </button>
            </div>
        </form>
    `;
    
    showModal('Add New Employee', formHtml, 'max-w-4xl');
    
    document.getElementById('addEmployeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const employeeType = formData.get('employee_type');
        const unit = formData.get('unit');
        const empId = await generateNextEmployeeId(employeeType, unit);
        
        const employeeData = {
            id: Utils.generateId('emp'),
            emp_id: empId,
            full_name: formData.get('full_name'),
            employee_type: employeeType,
            unit: unit,
            designation: formData.get('designation'),
            date_of_joining: formData.get('date_of_joining'),
            date_of_exit: null,
            is_active: true,
            phone: formData.get('phone'),
            email: formData.get('email') || '',
            address: formData.get('address'),
            esi_number: formData.get('esi_number') || '',
            epf_number: formData.get('epf_number') || '',
            bank_account: formData.get('bank_account') || '',
            bank_ifsc: formData.get('bank_ifsc') || '',
            basic_salary: parseFloat(formData.get('basic_salary')),
            hra: parseFloat(formData.get('hra')) || 0,
            is_esi_applicable: formData.get('is_esi_applicable') === 'on',
            is_epf_applicable: formData.get('is_epf_applicable') === 'on',
            overtime_eligible: formData.get('overtime_eligible') === 'on',
            monthly_leaves_allowed: employeeType === 'Staff' ? 2 : 0
        };
        
        try {
            await API.create('employees', employeeData);
            Utils.showNotification(`Employee added successfully with ID: ${empId}`, 'success');
            closeModal();
            loadPage('payroll-employees');
        } catch (error) {
            Utils.showNotification('Error adding employee', 'error');
        }
    });
}

function updateEmployeeTypeFields() {
    const type = document.getElementById('employeeTypeSelect').value;
    const overtimeField = document.getElementById('overtimeField');
    
    if (type === 'Worker') {
        overtimeField.style.display = 'block';
    } else {
        overtimeField.style.display = 'none';
    }
}

function calculateGrossSalary() {
    const basic = parseFloat(document.getElementById('basicSalaryInput').value) || 0;
    const hra = parseFloat(document.getElementById('hraInput').value) || 0;
    document.getElementById('grossSalaryDisplay').value = (basic + hra).toFixed(2);
}

function updateStatutoryFields() {
    const esiCheck = document.getElementById('esiCheck').checked;
    const epfCheck = document.getElementById('epfCheck').checked;
    
    document.getElementById('esiNumberField').style.display = esiCheck ? 'block' : 'none';
    document.getElementById('epfNumberField').style.display = epfCheck ? 'block' : 'none';
}

async function viewEmployee(empId) {
    const employee = await API.getById('employees', empId);
    
    const detailsHtml = `
        <div class="space-y-4">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-2xl font-bold">${employee.full_name}</h3>
                    <p class="text-gray-600">${employee.designation} - ${employee.unit}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500">Employee ID</p>
                    <p class="text-xl font-bold text-blue-600">${employee.emp_id}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                    <p class="text-sm text-gray-600">Type</p>
                    <p class="font-medium">${employee.employee_type}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Status</p>
                    <p class="font-medium">${employee.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Date of Joining</p>
                    <p class="font-medium">${Utils.formatDate(employee.date_of_joining)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Phone</p>
                    <p class="font-medium">${employee.phone}</p>
                </div>
                ${employee.email ? `
                    <div class="col-span-2">
                        <p class="text-sm text-gray-600">Email</p>
                        <p class="font-medium">${employee.email}</p>
                    </div>
                ` : ''}
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">Address</p>
                    <p class="font-medium">${employee.address}</p>
                </div>
            </div>
            
            <div class="border-t pt-4">
                <h4 class="font-bold text-gray-800 mb-3">Salary Structure</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-gray-600">Basic Salary</p>
                        <p class="font-bold text-lg">${Utils.formatCurrency(employee.basic_salary, 'INR')}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">HRA</p>
                        <p class="font-bold text-lg">${Utils.formatCurrency(employee.hra || 0, 'INR')}</p>
                    </div>
                    <div class="col-span-2">
                        <p class="text-sm text-gray-600">Gross Salary</p>
                        <p class="font-bold text-xl text-green-600">${Utils.formatCurrency((employee.basic_salary + (employee.hra || 0)), 'INR')}</p>
                    </div>
                </div>
            </div>
            
            <div class="border-t pt-4">
                <h4 class="font-bold text-gray-800 mb-3">Statutory Details</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-gray-600">ESI</p>
                        <p class="font-medium">${employee.is_esi_applicable ? `✓ ${employee.esi_number || 'Applied'}` : '✗ Not Applicable'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">EPF</p>
                        <p class="font-medium">${employee.is_epf_applicable ? `✓ ${employee.epf_number || 'Applied'}` : '✗ Not Applicable'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">Overtime Eligible</p>
                        <p class="font-medium">${employee.overtime_eligible ? '✓ Yes' : '✗ No'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">Monthly Leaves</p>
                        <p class="font-medium">${employee.monthly_leaves_allowed} days</p>
                    </div>
                </div>
            </div>
            
            ${employee.bank_account ? `
                <div class="border-t pt-4">
                    <h4 class="font-bold text-gray-800 mb-3">Bank Details</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-600">Account Number</p>
                            <p class="font-medium">${employee.bank_account}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">IFSC Code</p>
                            <p class="font-medium">${employee.bank_ifsc}</p>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    showModal('Employee Details', detailsHtml, 'max-w-3xl');
}

async function markEmployeeExit(empId) {
    const employee = await API.getById('employees', empId);
    
    const formHtml = `
        <form id="exitEmployeeForm" class="space-y-4">
            <div class="bg-red-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-red-800"><i class="fas fa-exclamation-triangle mr-2"></i>
                Mark employee as exited. They will be removed from active payroll but kept in records.</p>
            </div>
            
            <div>
                <p class="font-medium text-gray-800">Employee: ${employee.full_name} (${employee.emp_id})</p>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Date of Exit *</label>
                <input type="date" name="date_of_exit" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition duration-200">
                    <i class="fas fa-sign-out-alt mr-2"></i>Mark Exit
                </button>
            </div>
        </form>
    `;
    
    showModal('Mark Employee Exit', formHtml);
    
    document.getElementById('exitEmployeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await API.patch('employees', empId, {
                date_of_exit: formData.get('date_of_exit'),
                is_active: false
            });
            Utils.showNotification('Employee marked as exited', 'success');
            closeModal();
            loadPage('payroll-employees');
        } catch (error) {
            Utils.showNotification('Error marking exit', 'error');
        }
    });
}

async function editEmployee(empId) {
    const employee = await API.getById('employees', empId);
    
    const formHtml = `
        <form id="editEmployeeForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input type="text" name="full_name" value="${employee.full_name}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Designation *</label>
                    <input type="text" name="designation" value="${employee.designation}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input type="tel" name="phone" value="${employee.phone}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input type="email" name="email" value="${employee.email || ''}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                    <textarea name="address" required rows="2" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">${employee.address}</textarea>
                </div>
                
                <div class="md:col-span-2 border-t pt-4">
                    <h3 class="font-bold text-gray-800 mb-3">Salary Structure</h3>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Basic Salary *</label>
                    <input type="number" name="basic_salary" id="editBasicSalary" value="${employee.basic_salary}" required min="0" step="0.01" onchange="calculateEditGrossSalary()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">HRA</label>
                    <input type="number" name="hra" id="editHRA" value="${employee.hra || 0}" min="0" step="0.01" onchange="calculateEditGrossSalary()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Gross Salary (Auto)</label>
                    <input type="number" id="editGrossSalary" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100 font-bold">
                </div>
                
                <div class="md:col-span-2 border-t pt-4">
                    <h3 class="font-bold text-gray-800 mb-3">Bank Details</h3>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Bank Account Number</label>
                    <input type="text" name="bank_account" value="${employee.bank_account || ''}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Bank IFSC Code</label>
                    <input type="text" name="bank_ifsc" value="${employee.bank_ifsc || ''}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Update Employee
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit Employee', formHtml, 'max-w-3xl');
    
    // Initialize gross salary
    setTimeout(() => calculateEditGrossSalary(), 100);
    
    document.getElementById('editEmployeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const updateData = {
            full_name: formData.get('full_name'),
            designation: formData.get('designation'),
            phone: formData.get('phone'),
            email: formData.get('email') || '',
            address: formData.get('address'),
            basic_salary: parseFloat(formData.get('basic_salary')),
            hra: parseFloat(formData.get('hra')) || 0,
            bank_account: formData.get('bank_account') || '',
            bank_ifsc: formData.get('bank_ifsc') || ''
        };
        
        try {
            await API.patch('employees', empId, updateData);
            Utils.showNotification('Employee updated successfully', 'success');
            closeModal();
            loadPage('payroll-employees');
        } catch (error) {
            Utils.showNotification('Error updating employee', 'error');
        }
    });
}

function calculateEditGrossSalary() {
    const basic = parseFloat(document.getElementById('editBasicSalary').value) || 0;
    const hra = parseFloat(document.getElementById('editHRA').value) || 0;
    document.getElementById('editGrossSalary').value = (basic + hra).toFixed(2);
}

// ========================================
// ATTENDANCE MANAGEMENT
// ========================================

async function loadAttendanceManagement(content, user) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Get attendance records
    const allAttendance = await API.getAll('attendance');
    const holidays = await API.getAll('holidays');
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Attendance Management</h1>
                <p class="text-gray-600">Track monthly attendance, leaves, and overtime</p>
            </div>
            <div class="flex space-x-2">
                <button onclick="showHolidayCalendar()" class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition duration-200">
                    <i class="fas fa-calendar-alt mr-2"></i>Holiday Calendar
                </button>
                <button onclick="showBulkAttendanceUpload()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition duration-200">
                    <i class="fas fa-upload mr-2"></i>Bulk Upload
                </button>
                <button onclick="showAttendanceEntryModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-plus mr-2"></i>Add Attendance
                </button>
            </div>
        </div>
        
        <!-- Month/Year Selector -->
        <div class="bg-white rounded-lg shadow p-4 mb-6">
            <div class="flex items-center space-x-4">
                <label class="font-medium text-gray-700">Select Month:</label>
                <select id="attendanceMonth" onchange="filterAttendanceByMonth()" class="px-4 py-2 border rounded-lg">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                        <option value="${m}" ${m === currentMonth ? 'selected' : ''}>
                            ${new Date(2024, m-1).toLocaleString('default', { month: 'long' })}
                        </option>
                    `).join('')}
                </select>
                <select id="attendanceYear" onchange="filterAttendanceByMonth()" class="px-4 py-2 border rounded-lg">
                    ${[2023, 2024, 2025, 2026].map(y => `
                        <option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>
                    `).join('')}
                </select>
                <button onclick="loadAttendanceStats()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-sync mr-2"></i>Refresh
                </button>
            </div>
        </div>
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6" id="attendanceStats">
            <!-- Stats will be loaded dynamically -->
        </div>
        
        <!-- Attendance Records -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b">
                <input type="text" id="attendanceSearch" placeholder="Search by employee name or ID..." 
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onkeyup="searchAttendance()">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full" id="attendanceTable">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Emp ID</th>
                            <th class="text-left py-3 px-4">Employee Name</th>
                            <th class="text-left py-3 px-4">Month/Year</th>
                            <th class="text-left py-3 px-4">Present</th>
                            <th class="text-left py-3 px-4">Absent</th>
                            <th class="text-left py-3 px-4">Paid Leaves</th>
                            <th class="text-left py-3 px-4">Unpaid Leaves</th>
                            <th class="text-left py-3 px-4">Overtime (hrs)</th>
                            <th class="text-left py-3 px-4">Payable Days</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="attendanceTableBody">
                        <!-- Will be loaded dynamically -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    window.allAttendance = allAttendance;
    window.allHolidays = holidays;
    await loadAttendanceStats();
}

async function loadAttendanceStats() {
    const month = parseInt(document.getElementById('attendanceMonth').value);
    const year = parseInt(document.getElementById('attendanceYear').value);
    
    const allAttendance = await API.getAll('attendance');
    const employees = await API.getAll('employees');
    
    // Filter for selected month
    const monthAttendance = allAttendance.filter(a => {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        return a.month === monthStr && a.year === year;
    });
    
    const totalRecords = monthAttendance.length;
    const totalPresent = monthAttendance.reduce((sum, a) => sum + a.days_present, 0);
    const totalAbsent = monthAttendance.reduce((sum, a) => sum + a.days_absent, 0);
    const totalOvertime = monthAttendance.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
    
    document.getElementById('attendanceStats').innerHTML = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-gray-500 text-sm font-medium">Records</p>
                    <p class="text-3xl font-bold text-gray-800 mt-2">${totalRecords}</p>
                </div>
                <div class="bg-blue-100 p-3 rounded-full">
                    <i class="fas fa-file-alt text-2xl text-blue-600"></i>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-gray-500 text-sm font-medium">Total Present Days</p>
                    <p class="text-3xl font-bold text-green-600 mt-2">${totalPresent}</p>
                </div>
                <div class="bg-green-100 p-3 rounded-full">
                    <i class="fas fa-check-circle text-2xl text-green-600"></i>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-gray-500 text-sm font-medium">Total Absent Days</p>
                    <p class="text-3xl font-bold text-red-600 mt-2">${totalAbsent}</p>
                </div>
                <div class="bg-red-100 p-3 rounded-full">
                    <i class="fas fa-times-circle text-2xl text-red-600"></i>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-gray-500 text-sm font-medium">Total Overtime</p>
                    <p class="text-3xl font-bold text-purple-600 mt-2">${totalOvertime.toFixed(1)} hrs</p>
                </div>
                <div class="bg-purple-100 p-3 rounded-full">
                    <i class="fas fa-clock text-2xl text-purple-600"></i>
                </div>
            </div>
        </div>
    `;
    
    await renderAttendanceTable(monthAttendance, employees);
}

async function renderAttendanceTable(attendanceRecords, employees) {
    const tbody = document.getElementById('attendanceTableBody');
    
    if (attendanceRecords.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="py-8 text-center text-gray-500">
                    <i class="fas fa-calendar-times text-4xl mb-2"></i>
                    <p>No attendance records for this month</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = attendanceRecords.map(att => {
        return `
            <tr class="border-b hover:bg-gray-50" data-empname="${att.employee_name.toLowerCase()}">
                <td class="py-3 px-4 font-bold">${att.emp_id}</td>
                <td class="py-3 px-4">${att.employee_name}</td>
                <td class="py-3 px-4">${att.month}</td>
                <td class="py-3 px-4 text-green-600 font-bold">${att.days_present}</td>
                <td class="py-3 px-4 text-red-600 font-bold">${att.days_absent}</td>
                <td class="py-3 px-4">${att.paid_leaves}</td>
                <td class="py-3 px-4">${att.unpaid_leaves}</td>
                <td class="py-3 px-4 ${att.overtime_hours > 0 ? 'text-purple-600 font-bold' : ''}">${att.overtime_hours || 0}</td>
                <td class="py-3 px-4 font-bold text-blue-600">${att.total_payable_days}</td>
                <td class="py-3 px-4">
                    <button onclick="editAttendance('${att.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteAttendance('${att.id}')" class="text-red-600 hover:text-red-800" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function showAttendanceEntryModal() {
    const employees = await API.getAll('employees');
    const activeEmployees = employees.filter(e => e.is_active);
    
    const formHtml = `
        <form id="attendanceForm" class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                Payable Days = Present Days + Paid Leaves (calculated automatically)</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Employee *</label>
                    <select name="employee_id" id="attEmployeeSelect" required onchange="updateLeaveFields()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Employee</option>
                        ${activeEmployees.map(emp => `
                            <option value="${emp.id}" data-type="${emp.employee_type}" data-overtime="${emp.overtime_eligible}">
                                ${emp.emp_id} - ${emp.full_name} (${emp.employee_type})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Month/Year *</label>
                    <input type="month" name="month_year" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Days Present *</label>
                    <input type="number" name="days_present" id="daysPresent" required min="0" max="31" onchange="calculatePayableDays()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Days Absent *</label>
                    <input type="number" name="days_absent" required min="0" max="31" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Paid Leaves</label>
                    <input type="number" name="paid_leaves" id="paidLeaves" min="0" max="10" value="0" onchange="calculatePayableDays()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <p class="text-xs text-gray-500 mt-1" id="leavesHint">Staff: 2 free leaves/month</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Unpaid Leaves</label>
                    <input type="number" name="unpaid_leaves" min="0" max="31" value="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div id="overtimeField" style="display:none;">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Overtime Hours</label>
                    <input type="number" name="overtime_hours" min="0" step="0.5" value="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <p class="text-xs text-gray-500 mt-1">For workers only</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Payable Days (Auto) *</label>
                    <input type="number" name="payable_days" id="payableDays" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100 font-bold">
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Save Attendance
                </button>
            </div>
        </form>
    `;
    
    showModal('Add Attendance Record', formHtml, 'max-w-3xl');
    
    document.getElementById('attendanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        // Get employee details
        const employeeId = formData.get('employee_id');
        const employees = await API.getAll('employees');
        const employee = employees.find(emp => emp.id === employeeId);
        
        if (!employee) {
            Utils.showNotification('Employee not found', 'error');
            return;
        }
        
        const monthYear = formData.get('month_year');
        const year = parseInt(monthYear.split('-')[0]);
        
        const attendanceData = {
            id: Utils.generateId('att'),
            emp_id: employee.emp_id,
            employee_name: employee.full_name,
            month: monthYear,
            year: year,
            days_present: parseInt(formData.get('days_present')),
            days_absent: parseInt(formData.get('days_absent')),
            sundays_holidays: 4,
            paid_leaves: parseInt(formData.get('paid_leaves')) || 0,
            unpaid_leaves: parseInt(formData.get('unpaid_leaves')) || 0,
            overtime_hours: parseFloat(formData.get('overtime_hours')) || 0,
            total_payable_days: parseInt(formData.get('payable_days'))
        };
        
        try {
            await API.create('attendance', attendanceData);
            Utils.showNotification('Attendance record saved successfully', 'success');
            closeModal();
            loadPage('payroll-attendance');
        } catch (error) {
            Utils.showNotification('Error saving attendance: ' + error.message, 'error');
        }
    });
}

function updateLeaveFields() {
    const select = document.getElementById('attEmployeeSelect');
    const selectedOption = select.options[select.selectedIndex];
    const empType = selectedOption.dataset.type;
    const overtimeEligible = selectedOption.dataset.overtime === 'true';
    
    const overtimeField = document.getElementById('overtimeField');
    if (overtimeEligible && empType === 'Worker') {
        overtimeField.style.display = 'block';
    } else {
        overtimeField.style.display = 'none';
    }
}

function calculatePayableDays() {
    const present = parseInt(document.getElementById('daysPresent').value) || 0;
    const paidLeaves = parseInt(document.getElementById('paidLeaves').value) || 0;
    document.getElementById('payableDays').value = present + paidLeaves;
}

function filterAttendanceByMonth() {
    loadAttendanceStats();
}

function searchAttendance() {
    const searchTerm = document.getElementById('attendanceSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#attendanceTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function showHolidayCalendar() {
    const holidays = await API.getAll('holidays');
    const currentYear = new Date().getFullYear();
    
    const formHtml = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                Sundays are automatically excluded. Add other holidays here.</p>
            </div>
            
            <div class="mb-4">
                <button onclick="showAddHolidayForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-plus mr-2"></i>Add Holiday
                </button>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Date</th>
                            <th class="text-left py-3 px-4">Holiday Name</th>
                            <th class="text-left py-3 px-4">Type</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${holidays.length === 0 ? `
                            <tr>
                                <td colspan="4" class="py-8 text-center text-gray-500">No holidays added</td>
                            </tr>
                        ` : holidays.map(h => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4">${Utils.formatDate(h.holiday_date)}</td>
                                <td class="py-3 px-4 font-medium">${h.holiday_name}</td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                                        ${h.holiday_type}
                                    </span>
                                </td>
                                <td class="py-3 px-4">
                                    <button onclick="deleteHoliday('${h.id}')" class="text-red-600 hover:text-red-800">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    showModal('Holiday Calendar', formHtml, 'max-w-3xl');
}

async function showAddHolidayForm() {
    closeModal();
    
    const formHtml = `
        <form id="holidayForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Holiday Date *</label>
                <input type="date" name="holiday_date" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Holiday Name *</label>
                <input type="text" name="holiday_name" required placeholder="e.g., Diwali, Republic Day" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                <select name="holiday_type" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="National">National Holiday</option>
                    <option value="Festival">Festival</option>
                    <option value="Company">Company Holiday</option>
                </select>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal(); showHolidayCalendar();" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Back
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Save Holiday
                </button>
            </div>
        </form>
    `;
    
    showModal('Add Holiday', formHtml);
    
    document.getElementById('holidayForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const holidayData = {
            id: Utils.generateId('hol'),
            holiday_date: formData.get('holiday_date'),
            holiday_name: formData.get('holiday_name'),
            holiday_type: formData.get('holiday_type'),
            is_active: true
        };
        
        try {
            await API.create('holidays', holidayData);
            Utils.showNotification('Holiday added successfully', 'success');
            closeModal();
            showHolidayCalendar();
        } catch (error) {
            Utils.showNotification('Error adding holiday', 'error');
        }
    });
}

async function deleteHoliday(holidayId) {
    if (!confirm('Delete this holiday?')) return;
    
    try {
        await API.delete('holidays', holidayId);
        Utils.showNotification('Holiday deleted', 'success');
        showHolidayCalendar();
    } catch (error) {
        Utils.showNotification('Error deleting holiday', 'error');
    }
}
