import { useEffect, useRef, useState } from 'react'
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
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false)
  const recoveryDetectedRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const initialUrl = window.location.href.toLowerCase()
    const hasRecoveryInUrl =
      initialUrl.includes('type=recovery') ||
      initialUrl.includes('type=invite') ||
      initialUrl.includes('access_token=')

    if (hasRecoveryInUrl) {
      recoveryDetectedRef.current = true
      setIsRecoveryFlow(true)
    }

    const {
      data: { subscription }
    } = authService.onAuthStateChange((event: AuthChangeEvent, newSession) => {
      if (!isMounted) return

      if (event === 'PASSWORD_RECOVERY') {
        recoveryDetectedRef.current = true
        setIsRecoveryFlow(true)
        setSession(newSession)
        setIsLoading(false)
        return
      }

      setSession(newSession)

      if (!recoveryDetectedRef.current) {
        setIsRecoveryFlow(false)
      }

      setIsLoading(false)
    })

    async function initialize() {
      try {
        const currentSession = await authService.getSession()

        if (!isMounted) return

        setSession(currentSession)

        if (!recoveryDetectedRef.current) {
          setIsLoading(false)
        }
      } catch {
        if (!isMounted) return

        setSession(null)

        if (!recoveryDetectedRef.current) {
          setIsLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

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
    return (
      <ResetPasswordScreen
        onSuccess={() => {
          setIsRecoveryFlow(false)
        }}
      />
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return <>{children}</>
}