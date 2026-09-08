import { supabase } from '../../lib/supabase.js';
import { verifyAuth } from '../../lib/auth.js';
import { StatePayloadSchema } from '../../lib/validation.js';
import { extractStoragePath, deleteStorageFiles } from '../../lib/storage.js';
import { wrapRoute, AppError } from '../../lib/error.js';
import { logger } from '../../lib/logger.js';

async function saveHandler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 1. Authenticate user
    const user = verifyAuth(req);
    logger.info('Save state request authenticated', { username: user.username });

    // 2. Parse request payload
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

    // 3. Validate request schema
    const payload = StatePayloadSchema.parse(body);

    // 4. Validate and verify Idempotency-Key
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
        throw new AppError('Missing Idempotency-Key header.', 400, 'VALIDATION_ERROR');
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
        throw new AppError('Invalid Idempotency-Key format. Must be UUID.', 400, 'VALIDATION_ERROR');
    }

    const { data: idempRecord, error: idempError } = await supabase
        .from('idempotency_keys')
        .select('*')
        .eq('key', idempotencyKey)
        .single();

    if (idempRecord) {
        logger.info('Idempotency cache hit: returning previous response', { idempotencyKey });
        return res.status(idempRecord.response_status).json(idempRecord.response_body);
    }

    // 5. Gather current image URLs for post-commit cleanup comparison
    const [oldHero, oldPortfolio, oldFeedbacks] = await Promise.all([
        supabase.from('hero_settings').select('image_url'),
        supabase.from('portfolio_projects').select('image_url'),
        supabase.from('client_feedbacks').select('image_url')
    ]);

    const oldUrls = new Set();
    if (oldHero.data) oldHero.data.forEach(h => oldUrls.add(h.image_url));
    if (oldPortfolio.data) oldPortfolio.data.forEach(p => oldUrls.add(p.image_url));
    if (oldFeedbacks.data) oldFeedbacks.data.forEach(f => oldUrls.add(f.image_url));

    // 6. Execute atomic SQL sync inside Supabase using RPC function (with sections support)
    let newLastModified;
    const sectionsInput = payload.data.sections || [];

    const rpcWithSections = await supabase.rpc('sync_portfolio_state', {
        hero_input: payload.data.hero,
        portfolio_input: payload.data.portfolio,
        feedbacks_input: payload.data.feedbacks,
        client_last_modified: payload.lastModified,
        sections_input: sectionsInput
    });

    if (!rpcWithSections.error) {
        newLastModified = rpcWithSections.data;
    } else if (rpcWithSections.error.code === 'PGRST202') {
        // Fallback if Supabase database RPC has not yet been migrated to 5-param signature:
        // Execute 4-param RPC + update system_metadata
        const rpcLegacy = await supabase.rpc('sync_portfolio_state', {
            hero_input: payload.data.hero,
            portfolio_input: payload.data.portfolio,
            feedbacks_input: payload.data.feedbacks,
            client_last_modified: payload.lastModified
        });

        if (rpcLegacy.error) {
            if (rpcLegacy.error.message.includes('OCC_CONFLICT')) {
                throw new AppError('Conflict: The database was modified by another session. Please reload and try again.', 409, 'CONFLICT');
            }
            logger.error('RPC synchronization failed', { rpcError: rpcLegacy.error });
            throw rpcLegacy.error;
        }

        newLastModified = rpcLegacy.data;

        // Persist sections configuration to system_metadata
        const { error: metaError } = await supabase.from('system_metadata').upsert({
            key: 'portfolio_sections_config',
            value: JSON.stringify(sectionsInput),
            updated_at: new Date().toISOString()
        });

        if (metaError) {
            logger.error('Failed to persist portfolio_sections_config to system_metadata', { error: metaError });
            throw metaError;
        }
    } else {
        if (rpcWithSections.error.message.includes('OCC_CONFLICT')) {
            throw new AppError('Conflict: The database was modified by another session. Please reload and try again.', 409, 'CONFLICT');
        }
        logger.error('RPC synchronization failed', { rpcError: rpcWithSections.error });
        throw rpcWithSections.error;
    }

    const responseBody = { success: true, savedAt: Number(newLastModified) };
    const responseStatus = 200;

    // 7. Store idempotency record
    await supabase.from('idempotency_keys').insert({
        key: idempotencyKey,
        response_status: responseStatus,
        response_body: responseBody
    });

    // 8. Background orphaned image deletion
    const newUrls = new Set();
    newUrls.add(payload.data.hero.imageUrl);
    payload.data.portfolio.forEach(p => newUrls.add(p.imageUrl));
    payload.data.feedbacks.forEach(f => newUrls.add(f.imageUrl));

    const orphanedUrls = [];
    oldUrls.forEach(url => {
        if (url && !newUrls.has(url)) {
            orphanedUrls.push(url);
        }
    });

    const pathsToDelete = orphanedUrls
        .map(extractStoragePath)
        .filter(Boolean);

    if (pathsToDelete.length > 0) {
        deleteStorageFiles(pathsToDelete).catch(err => {
            logger.error('Background storage deletion failed', { error: err.message });
        });
    }

    logger.info('State sync transaction committed successfully', { newLastModified });
    return res.status(responseStatus).json(responseBody);
}

export default wrapRoute(saveHandler);
