const SENSITIVE_KEYS = ['password', 'jwt', 'cookie', 'token', 'authorization', 'supabase_service_role_key'];

function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);

    const sanitized = {};
    for (const [key, val] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.includes(key.toLowerCase()) || key.toUpperCase().includes('SECRET') || key.toUpperCase().includes('KEY')) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof val === 'object') {
            sanitized[key] = sanitize(val);
        } else {
            sanitized[key] = val;
        }
    }
    return sanitized;
}

function log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = sanitize(meta);
    const logObject = {
        timestamp,
        level,
        message,
        ...sanitizedMeta
    };
    
    if (level === 'debug' && process.env.NODE_ENV === 'production') {
        return;
    }

    if (level === 'error' || level === 'fatal') {
        console.error(JSON.stringify(logObject));
    } else {
        console.log(JSON.stringify(logObject));
    }
}

export const logger = {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    fatal: (msg, meta) => log('fatal', msg, meta)
};
