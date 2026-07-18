import { clearAuthCookie } from '../../lib/auth.js';
import { wrapRoute } from '../../lib/error.js';
import { logger } from '../../lib/logger.js';

async function logoutHandler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    clearAuthCookie(res);
    logger.info('User logged out successfully.');
    return res.status(200).json({ success: true });
}

export default wrapRoute(logoutHandler);
