import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,        // save session to localStorage
            autoRefreshToken: true,      // silently refresh before expiry
            detectSessionInUrl: true,    // picks up the token from the magic link URL
        }
    }
)