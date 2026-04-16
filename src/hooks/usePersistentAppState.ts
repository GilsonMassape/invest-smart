import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppState,
  AssetType,
  FilterType,
  MacroScenario,
  PortfolioPosition,
  RiskProfile,
} from '../domain/types'
import { DEFAULT_STATE } from '../data/defaults'
import { loadAppState, saveAppState } from '../services/storage/appStorage'
import {
  loadCloudAppState,
  saveCloudAppState,
} from '../services/storage/cloudStorage'

type StateUpdater<T> = (value: T) => void

interface PersistentAppStateActions {
  updateRiskProfile: StateUpdater<RiskProfile>
  updateMacroScenario: StateUpdater<MacroScenario>
  updatePreferredTypes: StateUpdater<AssetType[]>
  updateBlockedTickers: StateUpdater<string[]>
  updateMonthlyContribution: StateUpdater<number>
  updateFilterType: StateUpdater<FilterType>
  upsertPosition: StateUpdater<PortfolioPosition>
  upsertManyPositions: StateUpdater<PortfolioPosition[]>
  replacePositions: StateUpdater<PortfolioPosition[]>
  removePosition: StateUpdater<string>
  resetState: () => void
}

interface PersistentAppStateResult {
  state: AppState
  actions: PersistentAppStateActions
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePosition(position: PortfolioPosition): PortfolioPosition {
  return {
    ticker: normalizeTicker(position.ticker),
    quantity: toSafeNumber(position.quantity),
    avgPrice: toSafeNumber(position.avgPrice),
    currentPrice:
      position.currentPrice == null ? null : toSafeNumber(position.currentPrice),
  }
}

function sanitizePreferredTypes(value: unknown): AssetType[] {
  return Array.isArray(value) ? (value as AssetType[]) : DEFAULT_STATE.preferences.preferredTypes
}

function sanitizeBlockedTickers(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((ticker) => (typeof ticker === 'string' ? normalizeTicker(ticker) : ''))
    .filter((ticker) => ticker.length > 0)
}

function sanitizePositions(value: unknown): PortfolioPosition[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((position) => normalizePosition(position as PortfolioPosition))
    .filter((position) => position.ticker.length > 0)
}

function sanitizeState(input: AppState): AppState {
  return {
    preferences: {
      riskProfile:
        input.preferences?.riskProfile ?? DEFAULT_STATE.preferences.riskProfile,
      macroScenario:
        input.preferences?.macroScenario ?? DEFAULT_STATE.preferences.macroScenario,
      preferredTypes: sanitizePreferredTypes(input.preferences?.preferredTypes),
      blockedTickers: sanitizeBlockedTickers(input.preferences?.blockedTickers),
    },
    monthlyContribution:
      toSafeNumber(input.monthlyContribution) || DEFAULT_STATE.monthlyContribution,
    filterType: input.filterType ?? DEFAULT_STATE.filterType,
    positions: sanitizePositions(input.positions),
  }
}

function mergeState(base: AppState, incoming: AppState): AppState {
  return sanitizeState({
    ...base,
    ...incoming,
    preferences: {
      ...base.preferences,
      ...incoming.preferences,
    },
  })
}

function upsertSinglePosition(
  positions: PortfolioPosition[],
  nextPosition: PortfolioPosition
): PortfolioPosition[] {
  const normalized = normalizePosition(nextPosition)

  if (!normalized.ticker) {
    return positions
  }

  const next = [...positions]
  const index = next.findIndex((item) => item.ticker === normalized.ticker)

  if (index >= 0) {
    next[index] = normalized
    return next
  }

  next.push(normalized)
  return next
}

export const usePersistentAppState = (): PersistentAppStateResult => {
  const [state, setState] = useState<AppState>(() => {
    const localState = loadAppState()

    if (!localState) {
      return sanitizeState(DEFAULT_STATE)
    }

    return mergeState(DEFAULT_STATE, localState)
  })

  const hasBootstrappedCloudRef = useRef(false)
  const lastSavedStateRef = useRef<string>('')

  useEffect(() => {
    if (hasBootstrappedCloudRef.current) {
      return
    }

    hasBootstrappedCloudRef.current = true

    let cancelled = false

    const bootstrapCloudState = async (): Promise<void> => {
      try {
        const cloudState = await loadCloudAppState()

        if (!cloudState || cancelled) {
          return
        }

        setState((current) => mergeState(current, cloudState))
      } catch (error) {
        console.error('Erro ao carregar estado em nuvem:', error)
      }
    }

    void bootstrapCloudState()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const sanitized = sanitizeState(state)
    const serialized = JSON.stringify(sanitized)

    if (serialized === lastSavedStateRef.current) {
      return
    }

    lastSavedStateRef.current = serialized
    saveAppState(sanitized)

    const persistCloudState = async (): Promise<void> => {
      try {
        await saveCloudAppState(sanitized)
      } catch (error) {
        console.error('Erro ao salvar estado em nuvem:', error)
      }
    }

    void persistCloudState()
  }, [state])

  const actions = useMemo<PersistentAppStateActions>(
    () => ({
      updateRiskProfile: (value) => {
        setState((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            riskProfile: value,
          },
        }))
      },

      updateMacroScenario: (value) => {
        setState((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            macroScenario: value,
          },
        }))
      },

      updatePreferredTypes: (value) => {
        setState((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            preferredTypes: sanitizePreferredTypes(value),
          },
        }))
      },

      updateBlockedTickers: (value) => {
        setState((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            blockedTickers: sanitizeBlockedTickers(value),
          },
        }))
      },

      updateMonthlyContribution: (value) => {
        setState((current) => ({
          ...current,
          monthlyContribution: toSafeNumber(value),
        }))
      },

      updateFilterType: (value) => {
        setState((current) => ({
          ...current,
          filterType: value,
        }))
      },

      upsertPosition: (value) => {
        setState((current) => ({
          ...current,
          positions: upsertSinglePosition(current.positions, value),
        }))
      },

      upsertManyPositions: (value) => {
        setState((current) => {
          const nextPositions = value.reduce<PortfolioPosition[]>(
            (accumulator, position) => upsertSinglePosition(accumulator, position),
            current.positions
          )

          return {
            ...current,
            positions: nextPositions,
          }
        })
      },

      replacePositions: (value) => {
        setState((current) => ({
          ...current,
          positions: sanitizePositions(value),
        }))
      },

      removePosition: (ticker) => {
        const normalizedTicker = normalizeTicker(ticker)

        setState((current) => ({
          ...current,
          positions: current.positions.filter(
            (position) => position.ticker !== normalizedTicker
          ),
        }))
      },

      resetState: () => {
        setState(sanitizeState(DEFAULT_STATE))
      },
    }),
    []
  )

  return {
    state: sanitizeState(state),
    actions,
  }
}