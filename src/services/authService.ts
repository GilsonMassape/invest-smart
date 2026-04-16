import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '../infra/supabase/supabaseClient'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePassword(password: string): string {
  return password.trim()
}

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    return data.session
  },

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) {
    return supabase.auth.onAuthStateChange(callback)
  },

  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: normalizePassword(password),
    })
  },

  async signUp(email: string, password: string) {
    return supabase.auth.signUp({
      email: normalizeEmail(email),
      password: normalizePassword(password),
    })
  },

  async signOut() {
    return supabase.auth.signOut()
  },

  async updatePassword(password: string) {
    return supabase.auth.updateUser({
      password: normalizePassword(password),
    })
  },
}