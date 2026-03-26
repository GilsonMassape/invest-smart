import { getSupabase } from './supabaseClient';

const supabase = getSupabase();

export const signInWithMagicLink = async (email: string) => {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
};

export const signOut = async () => {
  return supabase.auth.signOut();
};

export const getCurrentSession = async () => {
  return supabase.auth.getSession();
};

export const recoverSessionFromUrl = async () => {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : '';

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return { data: { session: null }, error: null };
  }

  const result = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.search}`
  );

  return result;
};

export const onAuthStateChange = (
  callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]
) => {
  return supabase.auth.onAuthStateChange(callback);
};