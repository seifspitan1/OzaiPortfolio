import { supabase } from '../../lib/supabase.js';
import { wrapRoute } from '../../lib/error.js';
import { logger } from '../../lib/logger.js';

async function healthHandler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const timestamp = new Date().toISOString();
    let dbStatus = 'ok';
    let storageStatus = 'ok';
    let hasFailure = false;

    try {
        const { data, error } = await supabase
            .from('system_metadata')
            .select('value')
            .eq('key', 'schema_version')
            .single();

        if (error || !data) {
            dbStatus = 'error';
            hasFailure = true;
            logger.error('Health check database query failed', { error });
        }
    } catch (err) {
        dbStatus = 'error';
        hasFailure = true;
        logger.error('Health check database query exception', { error: err.message });
    }

    try {
        const { data, error } = await supabase.storage.getBucket('portfolio-assets');
        if (error || !data) {
            storageStatus = 'error';
            hasFailure = true;
            logger.error('Health check storage bucket query failed', { error });
        }
    } catch (err) {
        storageStatus = 'error';
        hasFailure = true;
        logger.error('Health check storage bucket query exception', { error: err.message });
    }

    const responsePayload = {
        status: hasFailure ? 'error' : 'ok',
        database: dbStatus,
        storage: storageStatus,
        timestamp
    };

    if (hasFailure) {
        logger.warn('Health check reported failures', responsePayload);
        return res.status(503).json(responsePayload);
    }

    logger.info('Health check completed successfully', responsePayload);
    return res.status(200).json(responsePayload);
}

export default wrapRoute(healthHandler);
