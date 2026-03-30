import { FormEvent, useMemo, useState } from 'react'
import { authService } from '../../services/authService'

type ResetPasswordScreenProps = {
  onSuccess?: () => void
}

export function ResetPasswordScreen({
  onSuccess
}: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const submitLabel = useMemo(() => {
    return loading ? 'Salvando nova senha...' : 'Salvar nova senha'
  }, [loading])

  const validate = (): string => {
    if (!password) return 'Informe a nova senha.'
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.'
    if (password !== confirmPassword) {
      return 'A confirmação de senha não confere.'
    }

    return ''
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const validationError = validate()

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    try {
      setLoading(true)

      const { error } = await authService.updatePassword(password)

      if (error) throw error

      setSuccessMessage('Senha atualizada com sucesso.')

      window.history.replaceState({}, document.title, window.location.pathname)

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao atualizar a senha.'

      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-8">
            <span className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-blue-100">
              Invest Smart
            </span>

            <h1 className="mt-6 text-3xl font-semibold leading-tight text-white">
              Redefinir senha
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Defina uma nova senha para concluir a recuperação de acesso.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="reset-password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Nova senha
              </label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite a nova senha"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Confirmar nova senha
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}