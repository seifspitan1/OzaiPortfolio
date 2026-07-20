import { supabase } from '../../lib/supabase.js';
import { wrapRoute } from '../../lib/error.js';
import { logger } from '../../lib/logger.js';

async function loadHandler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    logger.info('Received load data request.');

    const [heroRes, portfolioRes, feedbacksRes, metadataRes] = await Promise.all([
        supabase.from('hero_settings').select('*').limit(1),
        supabase.from('portfolio_projects').select('*').order('sort_order', { ascending: true }),
        supabase.from('client_feedbacks').select('*').order('sort_order', { ascending: true }),
        supabase.from('system_metadata').select('value').eq('key', 'last_modified').single()
    ]);

    if (heroRes.error) logger.error('Error fetching hero_settings', { error: heroRes.error });
    if (portfolioRes.error) logger.error('Error fetching portfolio_projects', { error: portfolioRes.error });
    if (feedbacksRes.error) logger.error('Error fetching client_feedbacks', { error: feedbacksRes.error });
    if (metadataRes.error && metadataRes.error.code !== 'PGRST116') {
        logger.error('Error fetching system_metadata last_modified', { error: metadataRes.error });
    }

    const dbHero = heroRes.data && heroRes.data[0];
    const hero = dbHero ? {
        id: dbHero.id,
        imageUrl: dbHero.image_url
    } : {
        id: '00000000-0000-0000-0000-000000000000',
        imageUrl: ''
    };

    const portfolio = (portfolioRes.data || []).map(p => ({
        id: p.id,
        order: p.sort_order,
        title: p.title || '',
        description: p.description || '',
        link: p.link_url || '',
        imageUrl: p.image_url,
        section: p.section || 'Section 1'
    }));

    const feedbacks = (feedbacksRes.data || []).map(f => ({
        id: f.id,
        order: f.sort_order,
        clientName: f.client_name,
        text: f.feedback_text,
        rating: f.rating,
        imageUrl: f.image_url || ''
    }));

    const lastModified = metadataRes.data ? parseInt(metadataRes.data.value, 10) : 0;

    const responsePayload = {
        version: 2,
        lastModified,
        data: {
            hero,
            portfolio,
            feedbacks
        }
    };

    logger.info('Load data completed successfully.', {
        portfolioCount: portfolio.length,
        feedbackCount: feedbacks.length,
        lastModified
    });

    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.status(200).json(responsePayload);
}

export default wrapRoute(loadHandler);
