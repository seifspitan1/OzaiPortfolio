import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { wrapRoute } from '../../lib/error.js';
import { logger } from '../../lib/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'auth_token';

async function sessionHandler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const cookieHeader = req.headers.cookie || '';
    const cookies = parse(cookieHeader);
    const token = cookies[COOKIE_NAME];

    if (!token) {
        logger.info('Session check: No token present.');
        return res.status(200).json({ authenticated: false });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        logger.info('Session check: Token verified successfully.', { username: decoded.username });
        return res.status(200).json({
            authenticated: true,
            username: decoded.username
        });
    } catch (err) {
        logger.info('Session check: Token verification failed.', { error: err.message });
        return res.status(200).json({ authenticated: false });
    }
}

export default wrapRoute(sessionHandler);
