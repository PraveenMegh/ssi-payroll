// API Helper Functions
const API = {
    // Generic GET request
    async get(table, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `tables/${table}${queryString ? '?' + queryString : ''}`;
        const response = await fetch(url);
        return await response.json();
    },

    // Get single record
    async getById(table, id) {
        if (!id) {
            console.error('API.getById called without ID for table:', table);
            throw new Error('ID is required for getById');
        }
        const response = await fetch(`tables/${table}/${id}`);
        if (!response.ok) {
            const error = await response.json();
            console.error('API Error:', error);
            throw new Error(error.message || 'API request failed');
        }
        return await response.json();
    },

    // Create new record
    async create(table, data) {
        const response = await fetch(`tables/${table}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    // Update record (full)
    async update(table, id, data) {
        const response = await fetch(`tables/${table}/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    // Update record (partial)
    async patch(table, id, data) {
        const response = await fetch(`tables/${table}/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    // Delete record
    async delete(table, id) {
        await fetch(`tables/${table}/${id}`, {
            method: 'DELETE'
        });
    },

    // Get all records (handles pagination)
    async getAll(table) {
        try {
            let allData = [];
            let page = 1;
            let hasMore = true;
            
            while (hasMore) {
                const result = await this.get(table, { page, limit: 100 });
                if (!result || !result.data) {
                    console.error('Invalid API response for table:', table, result);
                    break;
                }
                allData = allData.concat(result.data);
                hasMore = allData.length < result.total;
                page++;
                if (page > 100) break; // Safety limit
            }
            
            return allData;
        } catch (error) {
            console.error('Error in getAll for table:', table, error);
            return [];
        }
    }
};

// Utility Functions
const Utils = {
    // Generate unique ID
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // Format date
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Format datetime
    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format currency
    formatCurrency(amount, currency = 'INR') {
        if (currency === 'INR') {
            return '₹' + parseFloat(amount).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            return '$' + parseFloat(amount).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    },

    // Show notification
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        } text-white`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    // Confirm dialog
    confirm(message) {
        return window.confirm(message);
    },

    // Show loading
    showLoading() {
        const loading = document.createElement('div');
        loading.id = 'loadingOverlay';
        loading.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        loading.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-lg"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i><p class="mt-2 text-gray-700">Loading...</p></div>';
        document.body.appendChild(loading);
    },

    // Hide loading
    hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) loading.remove();
    },

    // Export to CSV
    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            Utils.showNotification('No data to export', 'warning');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    // Escape commas and quotes
                    return typeof value === 'string' && (value.includes(',') || value.includes('"'))
                        ? `"${value.replace(/"/g, '""')}"`
                        : value;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    },

    // Parse CSV
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
        
        return data;
    }
};
