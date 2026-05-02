// Main Application Logic
let currentPage = 'dashboard';

function initializeApp() {
    try {
        const user = authManager.getCurrentUser();
        
        if (!user) {
            console.error('No user found, redirecting to login');
            showLogin();
            return;
        }
        
        // Update header
        document.getElementById('userFullName').textContent = user.full_name || 'User';
        document.getElementById('userRole').textContent = user.role || 'Role';
        
        // Build sidebar based on role
        buildSidebar(user.role);
        
        // Load initial page
        loadPage('dashboard');
        
        // Check for today's celebrations (show greeting popup)
        setTimeout(() => {
            checkTodayCelebrations();
        }, 1000);
    } catch (error) {
        console.error('Error initializing app:', error);
        Utils.showNotification('Error loading application. Please refresh the page.', 'error');
    }
}

function buildSidebar(role) {
    const sidebarLinks = document.getElementById('sidebarLinks');
    const links = [];
    
    // Dashboard (all roles)
    links.push({
        id: 'dashboard',
        icon: 'fa-home',
        label: 'Dashboard',
        roles: ['Admin', 'Sales', 'Dispatch', 'Accounts']
    });
    
    // Admin specific
    if (role === 'Admin') {
        links.push({
            id: 'admin-users',
            icon: 'fa-users',
            label: 'User Management',
            roles: ['Admin']
        });
        links.push({
            id: 'admin-data',
            icon: 'fa-database',
            label: 'Data Management',
            roles: ['Admin']
        });
    }
    
    // Inventory (all roles can view)
    links.push({
        id: 'inventory',
        icon: 'fa-boxes',
        label: 'Inventory/Stock',
        roles: ['Admin', 'Sales', 'Dispatch', 'Accounts']
    });
    
    // Sales
    if (role === 'Admin' || role === 'Sales') {
        links.push({
            id: 'sales-orders',
            icon: 'fa-shopping-cart',
            label: 'Sales Orders',
            roles: ['Admin', 'Sales']
        });
        links.push({
            id: 'sales-buyers',
            icon: 'fa-handshake',
            label: 'Buyer Management',
            roles: ['Admin', 'Sales']
        });
    }
    
    // Dispatch
    if (role === 'Admin' || role === 'Dispatch') {
        links.push({
            id: 'dispatch-pending',
            icon: 'fa-truck',
            label: 'Pending Dispatch',
            roles: ['Admin', 'Dispatch']
        });
        links.push({
            id: 'dispatch-slips',
            icon: 'fa-file-alt',
            label: 'Dispatch Slips',
            roles: ['Admin', 'Dispatch']
        });
    }
    
    // Accounts
    if (role === 'Admin' || role === 'Accounts') {
        links.push({
            id: 'accounts-invoices',
            icon: 'fa-file-invoice',
            label: 'Invoices',
            roles: ['Admin', 'Accounts']
        });
    }
    
    // Payroll (Admin only)
    if (role === 'Admin') {
        links.push({
            id: 'payroll-employees',
            icon: 'fa-users-cog',
            label: 'Payroll - Employees',
            roles: ['Admin']
        });
        links.push({
            id: 'payroll-attendance',
            icon: 'fa-calendar-check',
            label: 'Payroll - Attendance',
            roles: ['Admin']
        });
        links.push({
            id: 'payroll-process',
            icon: 'fa-calculator',
            label: 'Payroll - Process',
            roles: ['Admin']
        });
        links.push({
            id: 'payroll-advances',
            icon: 'fa-hand-holding-usd',
            label: 'Payroll - Advances',
            roles: ['Admin']
        });
        links.push({
            id: 'payroll-reports',
            icon: 'fa-file-invoice-dollar',
            label: 'Payroll - Reports',
            roles: ['Admin']
        });
        links.push({
            id: 'celebrations',
            icon: 'fa-gift',
            label: 'Celebration Calendar',
            roles: ['Admin']
        });
    }
    
    // Reports (Admin, Dispatch, Accounts only - NOT Sales)
    if (role === 'Admin' || role === 'Dispatch' || role === 'Accounts') {
        links.push({
            id: 'reports',
            icon: 'fa-chart-bar',
            label: 'Reports & Analytics',
            roles: ['Admin', 'Dispatch', 'Accounts']
        });
    }
    
    // Render links
    const html = links
        .filter(link => link.roles.includes(role))
        .map(link => `
            <button onclick="loadPage('${link.id}')" 
                class="sidebar-link w-full text-left px-4 py-3 rounded-lg mb-2 transition duration-200 flex items-center"
                data-page="${link.id}">
                <i class="fas ${link.icon} mr-3"></i>
                ${link.label}
            </button>
        `).join('');
    
    sidebarLinks.innerHTML = html;
}

async function loadPage(pageId) {
    currentPage = pageId;
    
    // Update active link
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
    
    const content = document.getElementById('mainContent');
    const user = authManager.getCurrentUser();
    
    Utils.showLoading();
    
    try {
        switch(pageId) {
            case 'dashboard':
                await loadDashboard(content, user);
                break;
            case 'admin-users':
                await loadAdminUsers(content);
                break;
            case 'admin-data':
                await loadAdminData(content);
                break;
            case 'inventory':
                await loadInventory(content, user);
                break;
            case 'sales-orders':
                await loadSalesOrders(content, user);
                break;
            case 'sales-buyers':
                await loadSalesBuyers(content, user);
                break;
            case 'dispatch-pending':
                await loadDispatchPending(content, user);
                break;
            case 'dispatch-slips':
                await loadDispatchSlips(content, user);
                break;
            case 'accounts-invoices':
                await loadAccountsInvoices(content, user);
                break;
            case 'reports':
                await loadReports(content, user);
                break;
            case 'payroll-employees':
                await loadEmployeeManagement(content, user);
                break;
            case 'payroll-attendance':
                await loadAttendanceManagement(content, user);
                break;
            case 'payroll-process':
                await loadSalaryProcessing(content, user);
                break;
            case 'payroll-advances':
                await loadAdvanceManagement(content, user);
                break;
            case 'payroll-reports':
                await loadPayrollReports(content, user);
                break;
            case 'celebrations':
                await loadCelebrations(content, user);
                break;
            default:
                content.innerHTML = '<div class="text-center text-gray-500 mt-10">Page not found</div>';
        }
    } catch (error) {
        console.error('Error loading page:', error);
        content.innerHTML = '<div class="text-center text-red-500 mt-10">Error loading page. Please try again.</div>';
    } finally {
        Utils.hideLoading();
    }
}

// Modal helper
function showModal(title, contentHtml, width = 'max-w-2xl') {
    const modalHtml = `
        <div class="modal show" id="globalModal" onclick="if(event.target === this) closeModal()">
            <div class="modal-content ${width}">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold text-gray-800">${title}</h2>
                    <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700 text-2xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="modalBody">
                    ${contentHtml}
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal
    const existingModal = document.getElementById('globalModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeModal() {
    const modal = document.getElementById('globalModal');
    if (modal) modal.remove();
}
