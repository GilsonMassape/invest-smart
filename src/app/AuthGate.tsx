import { useEffect, useMemo, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { AuthScreen } from '../components/auth/AuthScreen'
import { ResetPasswordScreen } from '../components/auth/ResetPasswordScreen'

type AuthGateProps = {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent | null>(null)

  useEffect(() => {
    let isMounted = true

    async function initialize() {
      try {
        const currentSession = await authService.getSession()

        if (isMounted) {
          setSession(currentSession)
          setIsLoading(false)
        }
      } catch {
        if (isMounted) {
          setSession(null)
          setIsLoading(false)
        }
      }
    }

    void initialize()

    const {
      data: { subscription }
    } = authService.onAuthStateChange((event, newSession) => {
      setAuthEvent(event)
      setSession(newSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const isRecoveryFlow = useMemo(() => {
    const hash = window.location.hash.toLowerCase()
    const search = window.location.search.toLowerCase()

    return (
      authEvent === 'PASSWORD_RECOVERY' ||
      hash.includes('type=recovery') ||
      search.includes('type=recovery')
    )
  }, [authEvent])

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span>Carregando...</span>
      </div>
    )
  }

  if (isRecoveryFlow && session) {
    return <ResetPasswordScreen />
  }

  if (!session) {
    return <AuthScreen />
  }

  return <>{children}</>
}