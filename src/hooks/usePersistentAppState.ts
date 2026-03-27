import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState,
  AssetType,
  FilterType,
  MacroScenario,
  PortfolioPosition,
  RiskProfile,
} from '../domain/types';
import { DEFAULT_STATE } from '../data/defaults';
import { loadAppState, saveAppState } from '../services/storage/appStorage';
import {
  loadCloudAppState,
  saveCloudAppState,
} from '../services/storage/cloudStorage';

type StateUpdater<T> = (value: T) => void;

interface PersistentAppStateActions {
  updateRiskProfile: StateUpdater<RiskProfile>;
  updateMacroScenario: StateUpdater<MacroScenario>;
  updatePreferredTypes: StateUpdater<AssetType[]>;
  updateBlockedTickers: StateUpdater<string[]>;
  updateMonthlyContribution: StateUpdater<number>;
  updateFilterType: StateUpdater<FilterType>;
  upsertPosition: StateUpdater<PortfolioPosition>;
  upsertManyPositions: StateUpdater<PortfolioPosition[]>;
  replacePositions: StateUpdater<PortfolioPosition[]>;
  removePosition: StateUpdater<string>;
  resetState: () => void;
}

interface PersistentAppStateResult {
  state: AppState;
  actions: PersistentAppStateActions;
}

const normalizeTicker = (ticker: string): string => ticker.trim().toUpperCase();

const normalizePosition = (position: PortfolioPosition): PortfolioPosition => ({
  ticker: normalizeTicker(position.ticker),
  quantity: Number(position.quantity) || 0,
  avgPrice: Number(position.avgPrice) || 0,
});

const sanitizeState = (input: AppState): AppState => ({
  preferences: {
    riskProfile:
      input.preferences?.riskProfile ??
      DEFAULT_STATE.preferences.riskProfile,

    macroScenario:
      input.preferences?.macroScenario ??
      DEFAULT_STATE.preferences.macroScenario,

    preferredTypes:
      input.preferences?.preferredTypes ??
      DEFAULT_STATE.preferences.preferredTypes,

    blockedTickers: Array.isArray(input.preferences?.blockedTickers)
      ? input.preferences.blockedTickers.map((ticker) =>
          ticker.trim().toUpperCase()
        )
      : [],
  },

  monthlyContribution:
    Number(input.monthlyContribution) ||
    DEFAULT_STATE.monthlyContribution,

  filterType:
    input.filterType ??
    DEFAULT_STATE.filterType,

  positions: Array.isArray(input.positions)
    ? input.positions
        .map((position) => ({
          ticker: position.ticker.trim().toUpperCase(),
          quantity: Number(position.quantity) || 0,
          avgPrice: Number(position.avgPrice) || 0,
        }))
        .filter((position) => position.ticker.length > 0)
    : [],
});

const mergeState = (base: AppState, incoming: AppState): AppState =>
  sanitizeState({
    ...base,
    ...incoming,
    preferences: {
      ...base.preferences,
      ...incoming.preferences,
    },
  });

const upsertSinglePosition = (
  positions: PortfolioPosition[],
  nextPosition: PortfolioPosition
): PortfolioPosition[] => {
  const normalized = normalizePosition(nextPosition);

  if (!normalized.ticker) {
    return positions;
  }

  const next = [...positions];
  const index = next.findIndex((item) => item.ticker === normalized.ticker);

  if (index >= 0) {
    next[index] = normalized;
    return next;
  }

  next.push(normalized);
  return next;
};

export const usePersistentAppState = (): PersistentAppStateResult => {
  const [state, setState] = useState<AppState>(() => {
    const localState = loadAppState();

    if (!localState) {
      return sanitizeState(DEFAULT_STATE);
    }

    return mergeState(DEFAULT_STATE, localState);
  });

  const hasBootstrappedCloudRef = useRef(false);
  const lastSavedStateRef = useRef<string>('');

  useEffect(() => {
    if (hasBootstrappedCloudRef.current) {
      return;
    }

    hasBootstrappedCloudRef.current = true;

    let cancelled = false;

    const bootstrapCloudState = async () => {
      try {
        const cloudState = await loadCloudAppState();

        if (!cloudState || cancelled) {
          return;
        }

        setState((current) => mergeState(current, cloudState));
      } catch (error) {
        console.error('Erro ao carregar estado em nuvem:', error);
      }
    };

    void bootstrapCloudState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sanitized = sanitizeState(state);
    const serialized = JSON.stringify(sanitized);

    if (serialized === lastSavedStateRef.current) {
      return;
    }

    lastSavedStateRef.current = serialized;
    saveAppState(sanitized);

    const persistCloudState = async () => {
      try {
        await saveCloudAppState(sanitized);
      } catch (error) {
        console.error('Erro ao salvar estado em nuvem:', error);
      }
    };

    void persistCloudState();
  }, [state]);

  const actions = useMemo<PersistentAppStateActions>(
    () => ({
      updateRiskProfile: (value) => {
        setState((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            riskProfile: value,
          },
        }));
      },

      updateMacroScenario: (value) => {
        setState((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            macroScenario: value,
          },
        }));
      },

      updatePreferredTypes: (_value) => {
        console.warn('updatePreferredTypes não é utilizado pelo estado atual.');
      },

      updateBlockedTickers: (value) => {
        setState((current) => ({
          ...current,
          preferences: {
            ...current.preferences,
            blockedTickers: value.map((ticker) => normalizeTicker(ticker)),
          },
        }));
      },

      updateMonthlyContribution: (value) => {
        setState((current) => ({
          ...current,
          monthlyContribution: Number(value) || 0,
        }));
      },

      updateFilterType: (value) => {
        setState((current) => ({
          ...current,
          filterType: value,
        }));
      },

      upsertPosition: (value) => {
        setState((current) => ({
          ...current,
          positions: upsertSinglePosition(current.positions, value),
        }));
      },

      upsertManyPositions: (value) => {
        setState((current) => {
          const nextPositions = value.reduce<PortfolioPosition[]>(
            (accumulator, position) => upsertSinglePosition(accumulator, position),
            current.positions
          );

          return {
            ...current,
            positions: nextPositions,
          };
        });
      },

      replacePositions: (value) => {
        setState((current) => ({
          ...current,
          positions: value
            .map(normalizePosition)
            .filter((position) => position.ticker.length > 0),
        }));
      },

      removePosition: (ticker) => {
        const normalizedTicker = normalizeTicker(ticker);

        setState((current) => ({
          ...current,
          positions: current.positions.filter(
            (position) => position.ticker !== normalizedTicker
          ),
        }));
      },

      resetState: () => {
        setState(sanitizeState(DEFAULT_STATE));
      },
    }),
    []
  );

  return {
    state: sanitizeState(state),
    actions,
  };
};