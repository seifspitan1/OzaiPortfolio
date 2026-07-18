const Auth = {
    login: async function(username, password) {
        try {
            // Remove legacy localStorage auth items
            localStorage.removeItem('auth');
            localStorage.removeItem('adminAuth');

            const res = await fetch('/api/v1/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            return !!data.success;
        } catch (err) {
            console.error("Login failed", err);
            return false;
        }
    },
    
    logout: async function() {
        localStorage.removeItem('auth');
        localStorage.removeItem('adminAuth');
        try {
            await fetch('/api/v1/logout', { method: 'POST' });
        } catch (err) {
            console.error("Logout failed", err);
        }
    },

    isAuthenticated: function() {
        try {
            // Clean up any legacy items
            if (localStorage.getItem('auth') || localStorage.getItem('adminAuth')) {
                localStorage.removeItem('auth');
                localStorage.removeItem('adminAuth');
            }

            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/v1/session', false); // Synchronous XHR to block rendering before status is resolved
            xhr.send();
            if (xhr.status === 200) {
                const res = JSON.parse(xhr.responseText);
                return !!res.authenticated;
            }
        } catch (e) {
            console.error('Session check failed', e);
        }
        return false;
    }
};
