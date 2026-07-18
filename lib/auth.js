import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import crypto from 'crypto';
import { AppError } from './error.js';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'auth_token';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is missing.');
}

export function timingSafeCompare(str1, str2) {
    const buf1 = Buffer.from(str1);
    const buf2 = Buffer.from(str2);
    if (buf1.length !== buf2.length) {
        crypto.timingSafeEqual(buf1, buf1);
        return false;
    }
    return crypto.timingSafeEqual(buf1, buf2);
}

export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyAuth(req) {
    const cookieHeader = req.headers.cookie || '';
    const cookies = parse(cookieHeader);
    const token = cookies[COOKIE_NAME];

    if (!token) {
        throw new AppError('Unauthorized: Missing session cookie.', 401, 'UNAUTHORIZED');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        throw new AppError('Unauthorized: Invalid or expired session cookie.', 401, 'UNAUTHORIZED');
    }
}

export function setAuthCookie(res, token) {
    const cookie = serialize(COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api',
        maxAge: 3600
    });
    res.setHeader('Set-Cookie', cookie);
}

export function clearAuthCookie(res) {
    const cookie = serialize(COOKIE_NAME, '', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api',
        maxAge: 0
    });
    res.setHeader('Set-Cookie', cookie);
}
