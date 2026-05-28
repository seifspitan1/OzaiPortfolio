const Auth = {
    login: function(username, password) {
        if (username === 'admin' && password === 'admin123') {
            const session = {
                token: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
                expiry: Date.now() + (60 * 60 * 1000) // 1 hour
            };
            localStorage.setItem('auth', JSON.stringify(session));
            
            // Synchronize session state to backend
            fetch('../api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            }).catch(err => console.error("Session sync failed", err));

            return true;
        }
        return false;
    },
    
    logout: function() {
        localStorage.removeItem('auth');
        localStorage.removeItem('adminAuth'); // Ensure legacy data is also wiped
        fetch('../api/logout.php', { method: 'POST' }).catch(() => {});
    },

    isAuthenticated: function() {
        const authData = localStorage.getItem('auth');
        
        if (!authData) return false;
        
        // Handle backward compatibility -> treat 'true' string as invalid
        if (authData === 'true') {
            this.logout();
            return false;
        }
        
        try {
            const session = JSON.parse(authData);
            
            if (!session || !session.expiry || Date.now() > session.expiry) {
                this.logout();
                return false;
            }
            
            return true;
        } catch (e) {
            // Fallback for any JSON parsing errors
            this.logout();
            return false;
        }
    }
};

// Activity-based session refresh
function refreshSession() {
    const raw = localStorage.getItem('auth');
    if (!raw) return;

    try {
        const data = JSON.parse(raw);
        // Only refresh if already valid (has expiry)
        if (data && data.expiry) {
            data.expiry = Date.now() + (60 * 60 * 1000);
            localStorage.setItem('auth', JSON.stringify(data));
        }
    } catch {
        // ignore invalid data
    }
}

document.addEventListener('click', refreshSession);
document.addEventListener('keydown', refreshSession);
