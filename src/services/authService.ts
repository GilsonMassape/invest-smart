import { Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '../infra/supabase/supabaseClient'

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) {
    return supabase.auth.onAuthStateChange(callback)
  },

  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({
      email,
      password
    })
  },

  async signUp(email: string, password: string) {
    return supabase.auth.signUp({
      email,
      password
    })
  },

  async signOut() {
    return supabase.auth.signOut()
  },

  async updatePassword(password: string) {
    return supabase.auth.updateUser({
      password
    })
  }
}