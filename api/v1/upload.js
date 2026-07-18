import Busboy from 'busboy';
import crypto from 'crypto';
import path from 'path';
import { supabase } from '../../lib/supabase.js';
import { verifyAuth } from '../../lib/auth.js';
import { wrapRoute, AppError } from '../../lib/error.js';
import { logger } from '../../lib/logger.js';

const ALLOWED_MIMES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

function validateMagicBytes(buffer, mimeType) {
    if (buffer.length < 4) return false;
    const hex = buffer.toString('hex', 0, 4).toLowerCase();

    if (hex.startsWith('ffd8ff')) {
        return mimeType === 'image/jpeg' || mimeType === 'image/jpg';
    }
    if (hex === '89504e47') {
        return mimeType === 'image/png';
    }
    if (hex === '52494646') {
        if (buffer.length >= 12) {
            const webpHex = buffer.toString('hex', 8, 12).toLowerCase();
            if (webpHex === '57454250') {
                return mimeType === 'image/webp';
            }
        }
    }
    return false;
}

const parseMultipart = (req) => {
    return new Promise((resolve, reject) => {
        let busboy;
        try {
            busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 2 * 1024 * 1024 } });
        } catch (e) {
            return reject(new AppError('Invalid multipart headers.', 400, 'VALIDATION_ERROR'));
        }

        let fileData = null;
        let limitTriggered = false;

        busboy.on('file', (fieldname, file, info) => {
            const { filename, mimeType } = info;
            const chunks = [];
            
            file.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            file.on('limit', () => {
                limitTriggered = true;
                reject(new AppError('Payload Too Large: File size exceeds 2MB limit.', 413, 'PAYLOAD_TOO_LARGE'));
            });

            file.on('end', () => {
                if (!limitTriggered) {
                    fileData = {
                        buffer: Buffer.concat(chunks),
                        mimeType,
                        filename
                    };
                }
            });
        });

        busboy.on('finish', () => {
            if (fileData) {
                resolve(fileData);
            } else {
                reject(new AppError('No file uploaded.', 400, 'VALIDATION_ERROR'));
            }
        });

        busboy.on('error', (err) => {
            reject(err);
        });

        req.pipe(busboy);
    });
};

async function uploadHandler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 1. Authenticate user
    const user = verifyAuth(req);
    logger.info('Upload image request authenticated', { username: user.username });



    // 2. Parse Multipart request
    const filePayload = await parseMultipart(req);

    const { buffer, mimeType } = filePayload;

    // 3. Validate mime type against whitelist
    const safeExt = ALLOWED_MIMES[mimeType.toLowerCase()];
    if (!safeExt) {
        throw new AppError(`Unsupported Media Type: ${mimeType}. Allowed types: JPEG, PNG, WEBP.`, 415, 'UNSUPPORTED_MEDIA_TYPE');
    }

    // 4. Validate magic bytes to defend against extension spoofing
    const isValid = validateMagicBytes(buffer, mimeType.toLowerCase());
    if (!isValid) {
        throw new AppError('Unsupported Media Type: Magic bytes signature validation failed.', 415, 'UNSUPPORTED_MEDIA_TYPE');
    }

    // 5. Generate secure UUID filename
    const secureFilename = `${crypto.randomUUID()}${safeExt}`;
    const storagePath = `uploads/${secureFilename}`;

    logger.info('Streaming file to Supabase storage', { path: storagePath, size: buffer.length });

    // 6. Upload buffer directly to Supabase storage bucket
    const { data, error: uploadError } = await supabase.storage
        .from('portfolio-assets')
        .upload(storagePath, buffer, {
            contentType: mimeType,
            cacheControl: '31536000',
            upsert: false
        });

    if (uploadError) {
        logger.error('Failed to stream file to storage bucket', { uploadError });
        throw new AppError(`Dependency Failure: Storage upload failed. ${uploadError.message}`, 503, 'SERVICE_UNAVAILABLE');
    }

    // 7. Generate public CDN URL
    const { data: publicUrlData } = supabase.storage
        .from('portfolio-assets')
        .getPublicUrl(storagePath);

    logger.info('File uploaded successfully', { publicUrl: publicUrlData.publicUrl });

    return res.status(200).json({
        success: true,
        url: publicUrlData.publicUrl
    });
}

export default wrapRoute(uploadHandler);
