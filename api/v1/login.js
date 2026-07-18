import { supabase } from '../../lib/supabase.js';
import { timingSafeCompare, signToken, setAuthCookie } from '../../lib/auth.js';
import { wrapRoute, AppError } from '../../lib/error.js';
import { LoginSchema } from '../../lib/validation.js';
import { logger } from '../../lib/logger.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function loginHandler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            throw new AppError('Invalid JSON payload.', 400, 'VALIDATION_ERROR');
        }
    }
    if (!body) {
        throw new AppError('Missing request body.', 400, 'VALIDATION_ERROR');
    }

    const validated = LoginSchema.parse(body);
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    const { data: attempt, error: attemptError } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('ip_address', clientIp)
        .single();

    if (attempt) {
        const lastAttemptTime = new Date(attempt.last_attempt_at).getTime();
        const timeDiffMinutes = (Date.now() - lastAttemptTime) / (60 * 1000);

        if (attempt.failed_count >= 5 && timeDiffMinutes < 15) {
            logger.warn('Login blocked: Rate limit exceeded', { ip: clientIp });
            throw new AppError('Too Many Requests: Brute-force protection active. Locked for 15 minutes.', 429, 'RATE_LIMITED');
        }
    }

    const isUsernameValid = timingSafeCompare(validated.username, ADMIN_USERNAME);
    const isPasswordValid = timingSafeCompare(validated.password, ADMIN_PASSWORD);

    if (isUsernameValid && isPasswordValid) {
        if (attempt) {
            await supabase.from('login_attempts').delete().eq('ip_address', clientIp);
        }

        const token = signToken({ username: ADMIN_USERNAME });
        setAuthCookie(res, token);

        logger.info('Successful login', { username: ADMIN_USERNAME, ip: clientIp });
        return res.status(200).json({ success: true });
    } else {
        const nextFailedCount = attempt ? attempt.failed_count + 1 : 1;
        
        await supabase
            .from('login_attempts')
            .upsert({
                ip_address: clientIp,
                failed_count: nextFailedCount,
                last_attempt_at: new Date().toISOString()
            });

        logger.warn('Failed login attempt', { username: validated.username, ip: clientIp });
        throw new AppError('Invalid credentials.', 401, 'UNAUTHORIZED');
    }
}

export default wrapRoute(loginHandler);
