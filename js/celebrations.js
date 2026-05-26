// Celebration Reminder Module
async function checkTodayCelebrations() {
    try {
        const celebrations = await API.getAll('celebrations');
        const today = new Date();
        const todayDate = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const todaysCelebrations = celebrations.filter(cel => 
            cel.is_active && cel.celebration_date === todayDate
        );
        
        if (todaysCelebrations.length > 0) {
            showCelebrationGreeting(todaysCelebrations);
        }
    } catch (error) {
        console.error('Error checking celebrations:', error);
    }
}

function showCelebrationGreeting(celebrations) {
    const greetingHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 celebration-overlay">
            <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
                <!-- Header with Logo -->
                <div class="bg-gradient-to-r from-red-600 to-red-700 p-6 text-center">
                    <img src="https://page.gensparksite.com/v1/base64_upload/9df1f51ca725382bf845fb19357a7ef5" 
                         alt="SSI Logo" 
                         class="mx-auto mb-4" 
                         style="height: 80px; width: auto; background: white; padding: 8px; border-radius: 50%;">
                    <h2 class="text-3xl font-bold text-white">Shree Sai Industries</h2>
                    <p class="text-red-100 mt-2">Wishes You</p>
                </div>
                
                <!-- Celebration Content -->
                <div class="p-8">
                    ${celebrations.map(cel => `
                        <div class="mb-6 last:mb-0">
                            <h3 class="text-2xl font-bold text-gray-800 mb-3 text-center">
                                🎉 ${cel.celebration_name} 🎉
                            </h3>
                            <div class="bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-lg border-l-4 border-red-600">
                                <p class="text-gray-700 text-lg leading-relaxed text-center">
                                    ${cel.greeting_message}
                                </p>
                            </div>
                        </div>
                    `).join('<hr class="my-6 border-gray-300">')}
                </div>
                
                <!-- Footer -->
                <div class="bg-gray-50 p-6 text-center border-t">
                    <p class="text-gray-600 mb-4">
                        <i class="fas fa-map-marker-alt mr-2"></i>Modinagar, UP • Patla, UP
                    </p>
                    <button onclick="closeCelebrationGreeting()" 
                            class="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition duration-200 font-semibold">
                        <i class="fas fa-times mr-2"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', greetingHtml);
}

function closeCelebrationGreeting() {
    const overlay = document.querySelector('.celebration-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Celebration Management Module
async function loadCelebrations(content, user) {
    const celebrations = await API.getAll('celebrations');
    
    // Sort by date
    celebrations.sort((a, b) => {
        const [aMonth, aDay] = a.celebration_date.split('-').map(Number);
        const [bMonth, bDay] = b.celebration_date.split('-').map(Number);
        return (aMonth * 100 + aDay) - (bMonth * 100 + bDay);
    });
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Celebration Calendar</h1>
                <p class="text-gray-600">Manage annual celebrations and greetings</p>
            </div>
            <button onclick="addCelebration()" class="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition duration-200">
                <i class="fas fa-plus mr-2"></i>Add Celebration
            </button>
        </div>
        
        <!-- Statistics -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm">Total Celebrations</p>
                        <p class="text-3xl font-bold text-gray-800">${celebrations.length}</p>
                    </div>
                    <i class="fas fa-calendar-alt text-4xl text-blue-600"></i>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm">National Holidays</p>
                        <p class="text-3xl font-bold text-gray-800">${celebrations.filter(c => c.celebration_type === 'National Holiday').length}</p>
                    </div>
                    <i class="fas fa-flag text-4xl text-green-600"></i>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm">Festivals</p>
                        <p class="text-3xl font-bold text-gray-800">${celebrations.filter(c => c.celebration_type === 'Festival').length}</p>
                    </div>
                    <i class="fas fa-star text-4xl text-yellow-600"></i>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm">Active</p>
                        <p class="text-3xl font-bold text-gray-800">${celebrations.filter(c => c.is_active).length}</p>
                    </div>
                    <i class="fas fa-check-circle text-4xl text-red-600"></i>
                </div>
            </div>
        </div>
        
        <!-- Today's Celebrations -->
        ${getTodaysCelebrationsHTML(celebrations)}
        
        <!-- Celebrations List -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Date</th>
                            <th class="text-left py-3 px-4">Celebration Name</th>
                            <th class="text-left py-3 px-4">Type</th>
                            <th class="text-left py-3 px-4">Greeting Preview</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${celebrations.map(cel => {
                            const [month, day] = cel.celebration_date.split('-');
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const dateDisplay = `${day} ${monthNames[parseInt(month) - 1]}`;
                            
                            return `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="py-3 px-4 font-medium">${dateDisplay}</td>
                                    <td class="py-3 px-4 font-semibold text-gray-800">${cel.celebration_name}</td>
                                    <td class="py-3 px-4">
                                        <span class="px-3 py-1 rounded-full text-sm font-medium ${
                                            cel.celebration_type === 'National Holiday' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-yellow-100 text-yellow-800'
                                        }">
                                            ${cel.celebration_type}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">${cel.greeting_message}</td>
                                    <td class="py-3 px-4">
                                        <span class="px-3 py-1 rounded-full text-sm font-medium ${
                                            cel.is_active 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }">
                                            ${cel.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <button onclick="viewCelebrationGreeting('${cel.id}')" class="text-blue-600 hover:text-blue-800 mr-3" title="Preview">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button onclick="editCelebration('${cel.id}')" class="text-green-600 hover:text-green-800 mr-3" title="Edit">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="toggleCelebration('${cel.id}', ${!cel.is_active})" class="text-yellow-600 hover:text-yellow-800 mr-3" title="${cel.is_active ? 'Deactivate' : 'Activate'}">
                                            <i class="fas fa-${cel.is_active ? 'ban' : 'check'}"></i>
                                        </button>
                                        <button onclick="deleteCelebration('${cel.id}')" class="text-red-600 hover:text-red-800" title="Delete">
                                            <i class="fas fa-trash"></i>
                                        </button>
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

function getTodaysCelebrationsHTML(celebrations) {
    const today = new Date();
    const todayDate = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const todaysCelebrations = celebrations.filter(cel => 
        cel.is_active && cel.celebration_date === todayDate
    );
    
    if (todaysCelebrations.length === 0) return '';
    
    return `
        <div class="bg-gradient-to-r from-red-600 to-red-700 rounded-lg shadow-lg p-6 mb-6 text-white">
            <h2 class="text-2xl font-bold mb-4 flex items-center">
                <i class="fas fa-gift mr-3"></i>Today's Celebrations
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-${todaysCelebrations.length > 1 ? '2' : '1'} gap-4">
                ${todaysCelebrations.map(cel => `
                    <div class="bg-white bg-opacity-20 rounded-lg p-4">
                        <h3 class="text-xl font-bold mb-2">🎉 ${cel.celebration_name}</h3>
                        <p class="text-red-100">${cel.greeting_message}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function viewCelebrationGreeting(celebrationId) {
    const celebration = await API.getById('celebrations', celebrationId);
    showCelebrationGreeting([celebration]);
}

async function toggleCelebration(celebrationId, newStatus) {
    try {
        await API.patch('celebrations', celebrationId, { is_active: newStatus });
        Utils.showNotification(`Celebration ${newStatus ? 'activated' : 'deactivated'}`, 'success');
        loadPage('celebrations');
    } catch (error) {
        Utils.showNotification('Error updating celebration', 'error');
    }
}

async function deleteCelebration(celebrationId) {
    if (confirm('Are you sure you want to delete this celebration?')) {
        try {
            await API.delete('celebrations', celebrationId);
            Utils.showNotification('Celebration deleted successfully', 'success');
            loadPage('celebrations');
        } catch (error) {
            Utils.showNotification('Error deleting celebration', 'error');
        }
    }
}

function addCelebration() {
    const formHtml = `
        <form id="celebrationForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Celebration Name *</label>
                    <input type="text" name="celebration_name" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Date (MM-DD) *</label>
                    <input type="text" name="celebration_date" required placeholder="01-01" pattern="\\d{2}-\\d{2}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                    <select name="celebration_type" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">Select Type</option>
                        <option value="National Holiday">National Holiday</option>
                        <option value="Festival">Festival</option>
                        <option value="Company Event">Company Event</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select name="is_active" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Greeting Message *</label>
                <textarea name="greeting_message" required rows="4" placeholder="Enter formal greeting message with SSI branding..." class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"></textarea>
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit" class="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
                    <i class="fas fa-save mr-2"></i>Save
                </button>
            </div>
        </form>
    `;
    
    showModal('Add Celebration', formHtml);
    
    document.getElementById('celebrationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await API.create('celebrations', {
                id: Utils.generateId('cel'),
                celebration_name: formData.get('celebration_name'),
                celebration_date: formData.get('celebration_date'),
                celebration_type: formData.get('celebration_type'),
                greeting_message: formData.get('greeting_message'),
                is_active: formData.get('is_active') === 'true'
            });
            
            Utils.showNotification('Celebration added successfully', 'success');
            closeModal();
            loadPage('celebrations');
        } catch (error) {
            Utils.showNotification('Error adding celebration', 'error');
        }
    });
}

async function editCelebration(celebrationId) {
    const celebration = await API.getById('celebrations', celebrationId);
    
    const formHtml = `
        <form id="editCelebrationForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Celebration Name *</label>
                    <input type="text" name="celebration_name" value="${celebration.celebration_name}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Date (MM-DD) *</label>
                    <input type="text" name="celebration_date" value="${celebration.celebration_date}" required pattern="\\d{2}-\\d{2}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                    <select name="celebration_type" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="National Holiday" ${celebration.celebration_type === 'National Holiday' ? 'selected' : ''}>National Holiday</option>
                        <option value="Festival" ${celebration.celebration_type === 'Festival' ? 'selected' : ''}>Festival</option>
                        <option value="Company Event" ${celebration.celebration_type === 'Company Event' ? 'selected' : ''}>Company Event</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select name="is_active" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="true" ${celebration.is_active ? 'selected' : ''}>Active</option>
                        <option value="false" ${!celebration.is_active ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Greeting Message *</label>
                <textarea name="greeting_message" required rows="4" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500">${celebration.greeting_message}</textarea>
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit" class="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
                    <i class="fas fa-save mr-2"></i>Update
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit Celebration', formHtml);
    
    document.getElementById('editCelebrationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await API.update('celebrations', celebrationId, {
                ...celebration,
                celebration_name: formData.get('celebration_name'),
                celebration_date: formData.get('celebration_date'),
                celebration_type: formData.get('celebration_type'),
                greeting_message: formData.get('greeting_message'),
                is_active: formData.get('is_active') === 'true'
            });
            
            Utils.showNotification('Celebration updated successfully', 'success');
            closeModal();
            loadPage('celebrations');
        } catch (error) {
            Utils.showNotification('Error updating celebration', 'error');
        }
    });
}
