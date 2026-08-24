import {createClient} from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Anon key for regular operations (higher rate limits)
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Service role key for admin operations (user creation, etc.)
export const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);