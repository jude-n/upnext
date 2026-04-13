import { createClient } from '@supabase/supabase-js'

// iOS Safari PWA kills localStorage in certain privacy modes.
// This wrapper falls back gracefully and keeps the session alive.
const iOSFriendlyStorage = {
    getItem: (key) => {
        try {
            return localStorage.getItem(key)
        } catch {
            return sessionStorage.getItem(key)
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value)
        } catch {
            sessionStorage.setItem(key, value)
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(key)
        } catch {
            sessionStorage.removeItem(key)
        }
    },
}

export const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession:     true,
            autoRefreshToken:   true,
            detectSessionInUrl: true,
            storage:            iOSFriendlyStorage,
            flowType:           'pkce',
        }
    }
)