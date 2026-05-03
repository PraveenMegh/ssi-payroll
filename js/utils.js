// Utility Functions
const Utils = {
    showLoading() {
        const content = document.getElementById('mainContent');
        if (content) {
            content.innerHTML = '<div class="flex items-center justify-center h-64"><div class="text-gray-600"><i class="fas fa-spinner fa-spin text-4xl"></i><p class="mt-4">Loading...</p></div></div>';
        }
    },

    hideLoading() {
        // Loading is hidden when content is replaced
    },

    showError(message) {
        const content = document.getElementById('mainContent');
        if (content) {
            content.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"><strong>Error:</strong> ${message}</div>`;
        }
    },

    showSuccess(message) {
        alert(message);
    },

    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-IN');
    },

    formatDateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString('en-IN');
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

console.log('✅ Utils loaded');
