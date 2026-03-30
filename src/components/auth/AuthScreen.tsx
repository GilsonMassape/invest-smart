import { FormEvent, useMemo, useState } from 'react'
import { authService } from '../../services/authService'

type AuthMode = 'login' | 'signup'

const emailRegex = /\S+@\S+\.\S+/

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const isSignup = mode === 'signup'

  const submitLabel = useMemo(() => {
    if (loading) {
      return isSignup ? 'Criando conta...' : 'Entrando...'
    }

    return isSignup ? 'Criar conta' : 'Entrar'
  }, [isSignup, loading])

  const validate = (): string => {
    if (!email.trim()) return 'Informe seu e-mail.'
    if (!emailRegex.test(email.trim())) return 'Informe um e-mail válido.'
    if (!password) return 'Informe sua senha.'
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.'

    if (isSignup && password !== confirmPassword) {
      return 'A confirmação de senha não confere.'
    }

    return ''
  }

  const resetFeedback = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleModeChange = (nextMode: AuthMode) => {
    resetFeedback()
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    const validationError = validate()

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    try {
      setLoading(true)

      if (isSignup) {
        const { error } = await authService.signUp(email.trim(), password)

        if (error) throw error

        setSuccessMessage('Conta criada com sucesso. Faça seu login.')
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        return
      }

      const { error } = await authService.signIn(email.trim(), password)

      if (error) throw error

    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha na autenticação.'

      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl md:grid-cols-2">

          {/* LADO ESQUERDO */}
          <section className="flex flex-col justify-between bg-gradient-to-br from-blue-700 via-slate-900 to-slate-950 p-8 md:p-10">
            <div>
              <span className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-blue-100">
                Invest Smart
              </span>

              <h1 className="mt-6 text-3xl font-semibold leading-tight md:text-4xl">
                Decisão inteligente para aportes e buy and hold.
              </h1>

              <p className="mt-4 max-w-md text-sm leading-6 text-slate-300 md:text-base">
                Entre na sua conta para acompanhar carteira, ranking,
                rebalanceamento e oportunidades com base em preço de mercado.
              </p>
            </div>
          </section>

          {/* LADO DIREITO */}
          <section className="p-8 md:p-10">
            <div className="mx-auto w-full max-w-md">

              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-white">
                  {isSignup ? 'Criar conta' : 'Entrar'}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {isSignup
                    ? 'Crie seu acesso para usar o Invest Smart.'
                    : 'Acesse sua conta para continuar.'}
                </p>
              </div>

              <div className="mb-6 inline-flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                    !isSignup ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Entrar
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('signup')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                    isSignup ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Criar conta
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full rounded-xl px-4 py-3 bg-slate-950 border border-slate-700"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  className="w-full rounded-xl px-4 py-3 bg-slate-950 border border-slate-700"
                />

                {isSignup && (
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar senha"
                    className="w-full rounded-xl px-4 py-3 bg-slate-950 border border-slate-700"
                  />
                )}

                {errorMessage && <p className="text-red-400">{errorMessage}</p>}
                {successMessage && <p className="text-green-400">{successMessage}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 py-3 rounded-xl"
                >
                  {submitLabel}
                </button>

              </form>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}