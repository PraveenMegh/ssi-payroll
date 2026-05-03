// Authentication Manager using Firebase
class AuthManager {
    constructor() {
        this.currentUser = this.loadSession();
        console.log('AuthManager initialized');
    }

    loadSession() {
        const userStr = sessionStorage.getItem('ssi_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    saveSession(user) {
        sessionStorage.setItem('ssi_user', JSON.stringify(user));
        this.currentUser = user;
    }

    async login(username, password) {
        try {
            console.log('Attempting login for:', username);
            
            // Query Firestore for user
            const usersRef = db.collection('users');
            const snapshot = await usersRef
                .where('username', '==', username)
                .where('password', '==', password)
                .where('active', '==', true)
                .limit(1)
                .get();

            if (snapshot.empty) {
                console.log('No matching user found');
                return { success: false, message: 'Invalid credentials or account inactive' };
            }

            const userDoc = snapshot.docs[0];
            const user = { id: userDoc.id, ...userDoc.data() };

            // Update last login
            await usersRef.doc(user.id).update({
                last_login: new Date().toISOString()
            });

            this.saveSession(user);
            console.log('Login successful:', user.name);
            return { success: true, user };

        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed: ' + error.message };
        }
    }

    logout() {
        sessionStorage.removeItem('ssi_user');
        this.currentUser = null;
        location.reload();
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Global instance
const authManager = new AuthManager();

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');

            try {
                const result = await authManager.login(username, password);
                
                if (result.success) {
                    document.getElementById('loginScreen').classList.add('hidden');
                    document.getElementById('mainApp').classList.remove('hidden');
                    initializeApp();
                } else {
                    errorDiv.textContent = result.message;
                    errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Login error:', error);
                errorDiv.textContent = 'An error occurred. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        });
    }

    // Check existing session
    if (authManager.isAuthenticated()) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }
});

// Logout function
function logout() {
    authManager.logout();
}
