import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { AuthScreen } from '../components/auth/AuthScreen'

type AuthGateProps = {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

    initialize()

    const { data: listener } = authService.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      isMounted = false
      listener?.subscription.unsubscribe()
    }
  }, [])

  // Loading inicial (evita flicker)
  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span>Carregando...</span>
      </div>
    )
  }

  // Não autenticado → bloqueia app
  if (!session) {
    return <AuthScreen />
  }

  // Autenticado → libera app
  return <>{children}</>
}