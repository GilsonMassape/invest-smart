import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are not defined');
}

declare global {
  // eslint-disable-next-line no-var
  var __investSmartSupabase__: SupabaseClient | undefined;
}

const createSupabase = (): SupabaseClient =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'invest-smart.supabase.auth',
    },
  });

export const getSupabase = (): SupabaseClient => {
  if (!globalThis.__investSmartSupabase__) {
    globalThis.__investSmartSupabase__ = createSupabase();
  }

  return globalThis.__investSmartSupabase__;
};