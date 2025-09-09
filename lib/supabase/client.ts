import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton instance
let clientInstance: SupabaseClient<Database> | null = null

export function createClient() {
  // Return existing instance if already created
  if (clientInstance) {
    return clientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (process.env.NODE_ENV === 'development') {
    console.log('Creating Supabase client singleton with:', {
      url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
      key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing'
    })
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = `Missing Supabase environment variables. URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  clientInstance = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'evently-analytics'
        },
      },
    }
  )

  return clientInstance
}

// Function to reset the singleton (useful for testing or logout)
export function resetClient() {
  clientInstance = null
}
