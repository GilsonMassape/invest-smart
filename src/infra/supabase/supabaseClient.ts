import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`)
  }

  return value.trim()
}

const supabaseUrl = readRequiredEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = readRequiredEnv('VITE_SUPABASE_ANON_KEY')

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'invest-smart.supabase.auth',
    },
  }
)