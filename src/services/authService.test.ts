import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const signInWithPasswordMock = vi.fn()
const signUpMock = vi.fn()
const signOutMock = vi.fn()
const updateUserMock = vi.fn()

vi.mock('../infra/supabase/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        getSession: getSessionMock,
        onAuthStateChange: onAuthStateChangeMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        signOut: signOutMock,
        updateUser: updateUserMock,
      },
    },
  }
})

function createFakeSession(): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    expires_at: 9999999999,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  } as unknown as Session
}

async function getAuthService() {
  const module = await import('./authService')
  return module.authService
}

describe('authService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('getSession retorna a sessão atual quando disponível', async () => {
    const fakeSession = createFakeSession()

    getSessionMock.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    })

    const authService = await getAuthService()
    const result = await authService.getSession()

    expect(getSessionMock).toHaveBeenCalledTimes(1)
    expect(result).toBe(fakeSession)
  })

  it('getSession lança erro quando o Supabase retorna erro', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error('session error'),
    })

    const authService = await getAuthService()

    await expect(authService.getSession()).rejects.toThrow('session error')
  })

  it('onAuthStateChange delega corretamente para o Supabase', async () => {
    const subscription = {
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    }

    const callback = vi.fn()

    onAuthStateChangeMock.mockReturnValue(subscription)

    const authService = await getAuthService()
    const result = authService.onAuthStateChange(callback)

    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1)
    expect(onAuthStateChangeMock).toHaveBeenCalledWith(callback)
    expect(result).toBe(subscription)
  })

  it('signIn normaliza email e password antes de autenticar', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })

    const authService = await getAuthService()

    await authService.signIn('  USER@Email.COM  ', '  secret-password  ')

    expect(signInWithPasswordMock).toHaveBeenCalledTimes(1)
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'user@email.com',
      password: 'secret-password',
    })
  })

  it('signUp normaliza email e password antes do cadastro', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })

    const authService = await getAuthService()

    await authService.signUp('  USER@Email.COM  ', '  new-password  ')

    expect(signUpMock).toHaveBeenCalledTimes(1)
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'user@email.com',
      password: 'new-password',
    })
  })

  it('signOut delega corretamente para o Supabase', async () => {
    signOutMock.mockResolvedValue({ error: null })

    const authService = await getAuthService()
    await authService.signOut()

    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('updatePassword normaliza a senha antes de atualizar', async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const authService = await getAuthService()

    await authService.updatePassword('  nova-senha-forte  ')

    expect(updateUserMock).toHaveBeenCalledTimes(1)
    expect(updateUserMock).toHaveBeenCalledWith({
      password: 'nova-senha-forte',
    })
  })
})