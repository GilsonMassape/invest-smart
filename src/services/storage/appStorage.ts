import type { AppState } from '../../domain/types';

const APP_STORAGE_KEY = 'invest-smart.app-state.v1';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const loadAppState = (): AppState | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(APP_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as AppState | null;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load app state from localStorage.', error);
    return null;
  }
};

export const saveAppState = (state: AppState): void => {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save app state to localStorage.', error);
  }
};

export const clearAppState = (): void => {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(APP_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear app state from localStorage.', error);
  }
};