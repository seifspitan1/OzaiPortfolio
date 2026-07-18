import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    logger.fatal('Supabase URL or Service Role Key is missing in environment variables.');
    throw new Error('Supabase configuration error');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false
    }
});

logger.info('Supabase client initialized successfully.');
