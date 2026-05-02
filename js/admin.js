// Admin Module - User Management
async function loadAdminUsers(content) {
    const users = await API.getAll('users');
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">User Management</h1>
                <p class="text-gray-600">Manage system users and permissions</p>
            </div>
            <button onclick="showAddUserModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-plus mr-2"></i>Add User
            </button>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Username</th>
                            <th class="text-left py-3 px-4">Full Name</th>
                            <th class="text-left py-3 px-4">Role</th>
                            <th class="text-left py-3 px-4">Email</th>
                            <th class="text-left py-3 px-4">Phone</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Last Login</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-medium">${user.username}</td>
                                <td class="py-3 px-4">${user.full_name}</td>
                                <td class="py-3 px-4">
                                    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                        ${user.role}
                                    </span>
                                </td>
                                <td class="py-3 px-4">${user.email}</td>
                                <td class="py-3 px-4">${user.phone}</td>
                                <td class="py-3 px-4">
                                    <span class="px-3 py-1 rounded-full text-sm font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                        ${user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td class="py-3 px-4">${Utils.formatDateTime(user.last_login)}</td>
                                <td class="py-3 px-4">
                                    <button onclick="editUser('${user.id}')" class="text-blue-600 hover:text-blue-800 mr-3">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="toggleUserStatus('${user.id}', ${!user.is_active})" class="text-${user.is_active ? 'yellow' : 'green'}-600 hover:text-${user.is_active ? 'yellow' : 'green'}-800 mr-3">
                                        <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                                    </button>
                                    ${user.username !== 'admin' ? `
                                        <button onclick="deleteUser('${user.id}')" class="text-red-600 hover:text-red-800">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function showAddUserModal() {
    const formHtml = `
        <form id="addUserForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                    <input type="text" name="username" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                    <input type="password" name="password" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input type="text" name="full_name" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                    <select name="role" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Role</option>
                        <option value="Admin">Admin</option>
                        <option value="Sales">Sales</option>
                        <option value="Dispatch">Dispatch</option>
                        <option value="Accounts">Accounts</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input type="email" name="email" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input type="tel" name="phone" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Save User
                </button>
            </div>
        </form>
    `;
    
    showModal('Add New User', formHtml);
    
    document.getElementById('addUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {
            id: Utils.generateId('user'),
            username: formData.get('username'),
            password: formData.get('password'),
            full_name: formData.get('full_name'),
            role: formData.get('role'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            is_active: true,
            last_login: ''
        };
        
        try {
            await API.create('users', userData);
            Utils.showNotification('User created successfully', 'success');
            closeModal();
            loadPage('admin-users');
        } catch (error) {
            Utils.showNotification('Error creating user', 'error');
        }
    });
}

async function editUser(userId) {
    const user = await API.getById('users', userId);
    
    const formHtml = `
        <form id="editUserForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                    <input type="text" name="username" value="${user.username}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">New Password (leave blank to keep current)</label>
                    <input type="password" name="password" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input type="text" name="full_name" value="${user.full_name}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                    <select name="role" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="Sales" ${user.role === 'Sales' ? 'selected' : ''}>Sales</option>
                        <option value="Dispatch" ${user.role === 'Dispatch' ? 'selected' : ''}>Dispatch</option>
                        <option value="Accounts" ${user.role === 'Accounts' ? 'selected' : ''}>Accounts</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input type="email" name="email" value="${user.email}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input type="tel" name="phone" value="${user.phone}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Update User
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit User', formHtml);
    
    document.getElementById('editUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const updateData = {
            ...user,
            username: formData.get('username'),
            full_name: formData.get('full_name'),
            role: formData.get('role'),
            email: formData.get('email'),
            phone: formData.get('phone')
        };
        
        // Update password if provided
        const newPassword = formData.get('password');
        if (newPassword) {
            updateData.password = newPassword;
        }
        
        try {
            await API.update('users', userId, updateData);
            Utils.showNotification('User updated successfully', 'success');
            closeModal();
            loadPage('admin-users');
        } catch (error) {
            Utils.showNotification('Error updating user', 'error');
        }
    });
}

async function toggleUserStatus(userId, newStatus) {
    if (Utils.confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this user?`)) {
        try {
            await API.patch('users', userId, { is_active: newStatus });
            Utils.showNotification(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
            loadPage('admin-users');
        } catch (error) {
            Utils.showNotification('Error updating user status', 'error');
        }
    }
}

async function deleteUser(userId) {
    if (Utils.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            await API.delete('users', userId);
            Utils.showNotification('User deleted successfully', 'success');
            loadPage('admin-users');
        } catch (error) {
            Utils.showNotification('Error deleting user', 'error');
        }
    }
}

// Admin Data Management
async function loadAdminData(content) {
    content.innerHTML = `
        <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Data Management</h1>
            <p class="text-gray-600">Manage products, buyers, and other data</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Products</h3>
                    <i class="fas fa-box text-3xl text-blue-600"></i>
                </div>
                <p class="text-gray-600 mb-4">Manage product catalog</p>
                <button onclick="manageProducts()" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-cog mr-2"></i>Manage Products
                </button>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Buyers</h3>
                    <i class="fas fa-handshake text-3xl text-green-600"></i>
                </div>
                <p class="text-gray-600 mb-4">Manage buyer database</p>
                <button onclick="manageBuyers()" class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition duration-200">
                    <i class="fas fa-cog mr-2"></i>Manage Buyers
                </button>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Orders</h3>
                    <i class="fas fa-shopping-cart text-3xl text-purple-600"></i>
                </div>
                <p class="text-gray-600 mb-4">Manage all orders</p>
                <button onclick="manageOrders()" class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition duration-200">
                    <i class="fas fa-cog mr-2"></i>Manage Orders
                </button>
            </div>
        </div>
    `;
}

async function manageProducts() {
    loadPage('inventory');
}

async function manageBuyers() {
    loadPage('sales-buyers');
}

async function manageOrders() {
    loadPage('sales-orders');
}
