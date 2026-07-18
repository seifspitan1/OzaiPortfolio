import { supabase } from './supabase.js';
import { logger } from './logger.js';

const BUCKET_NAME = 'portfolio-assets';

export function getBucketName() {
    return BUCKET_NAME;
}

export function extractStoragePath(url) {
    if (!url) return null;
    const marker = `/${BUCKET_NAME}/`;
    const index = url.indexOf(marker);
    if (index !== -1) {
        return url.substring(index + marker.length);
    }
    return null;
}

export async function deleteStorageFiles(paths) {
    if (!paths || paths.length === 0) return;
    
    // Normalize paths by stripping leading slashes
    const normalizedPaths = paths.map(p => p.startsWith('/') ? p.substring(1) : p).filter(Boolean);
    if (normalizedPaths.length === 0) return;

    logger.info('Attempting storage deletion for orphaned files', { paths: normalizedPaths });

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(normalizedPaths);

        if (error) {
            logger.warn('Supabase storage removal reported partial error', { error, data });
        } else {
            logger.info('Supabase storage files successfully removed', { data });
        }
    } catch (err) {
        logger.error('Failed to execute storage removal request', { error: err.message });
    }
}
