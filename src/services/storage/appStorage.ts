import type { AppState } from '../../domain/types'

const APP_STORAGE_KEY = 'invest-smart.app-state.v1'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function loadAppState(): AppState | null {
  if (!isBrowser()) {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(APP_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as unknown

    if (!isObject(parsed)) {
      return null
    }

    return parsed as unknown as AppState
  } catch (error) {
    console.error('Failed to load app state from localStorage.', error)
    return null
  }
}

export function saveAppState(state: AppState): void {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save app state to localStorage.', error)
  }
}

export function clearAppState(): void {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.removeItem(APP_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear app state from localStorage.', error)
  }
}