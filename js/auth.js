// Authentication Management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.loadSession();
    }

    async login(username, password) {
        try {
            // Fetch users from API
            const response = await fetch('tables/users?limit=1000');
            const data = await response.json();
            
            // Find user with matching credentials
            const user = data.data.find(u => 
                u.username === username && u.password === password && u.is_active === true
            );
            
            if (user) {
                // Update last login
                await fetch(`tables/users/${user.id}`, {
                    method: 'PATCH',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        last_login: new Date().toISOString()
                    })
                });
                
                // Store session
                this.currentUser = user;
                sessionStorage.setItem('ssi_user', JSON.stringify(user));
                return { success: true, user };
            } else {
                return { success: false, message: 'Invalid credentials or account inactive' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed. Please try again.' };
        }
    }

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('ssi_user');
        window.location.reload();
    }

    loadSession() {
        const userData = sessionStorage.getItem('ssi_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    hasRole(roles) {
        if (!this.currentUser) return false;
        if (typeof roles === 'string') roles = [roles];
        return roles.includes(this.currentUser.role);
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Global auth instance
const authManager = new AuthManager();

// Login form handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            
            errorDiv.classList.add('hidden');
            
            const result = await authManager.login(username, password);
            
            if (result.success) {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('mainApp').classList.remove('hidden');
                initializeApp();
            } else {
                errorDiv.textContent = result.message;
                errorDiv.classList.remove('hidden');
            }
        });
    }
    
    // Check if already logged in
    if (authManager.isAuthenticated()) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        initializeApp();
    }
});

function logout() {
    authManager.logout();
}
