import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

// Create a Supabase client with realtime disabled to avoid WebSocket errors
// Use this for pages that don't need realtime subscriptions
export const createClientNoRealtime = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        enabled: false
      }
    }
  )