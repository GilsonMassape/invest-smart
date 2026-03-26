import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '../services/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
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

const supabase = getSupabase();

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

const PORTFOLIO_TABLE = 'portfolio_positions';

const cloneDefaultState = (): AppState => ({
  ...DEFAULT_STATE,
  positions: [...DEFAULT_STATE.positions],
  preferences: {
    ...DEFAULT_STATE.preferences,
    preferredTypes: [...DEFAULT_STATE.preferences.preferredTypes],
    blockedTickers: [...DEFAULT_STATE.preferences.blockedTickers],
  },
});

const getInitialState = (): AppState => loadAppState() ?? cloneDefaultState();

const sanitizeTicker = (ticker: string): string =>
  ticker.trim().toUpperCase();

const sanitizeNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const normalizePositions = (
  positions: PortfolioPosition[]
): PortfolioPosition[] => {
  const map = new Map<string, PortfolioPosition>();

  for (const p of positions) {
    const ticker = sanitizeTicker(p.ticker);
    if (!ticker) continue;

    map.set(ticker, {
      ticker,
      quantity: sanitizeNumber(p.quantity),
      avgPrice: sanitizeNumber(p.avgPrice),
    });
  }

  return [...map.values()].sort((a, b) =>
    a.ticker.localeCompare(b.ticker)
  );
};

const signature = (positions: PortfolioPosition[]) =>
  JSON.stringify(normalizePositions(positions));

export const usePersistentAppState = (): PersistentAppStateResult => {
  const [state, setState] = useState<AppState>(getInitialState);

  const supabaseRef = useRef<SupabaseClient | null>(supabase);
  const hydratedRef = useRef(false);
  const syncingRef = useRef(false);

  const lastSignatureRef = useRef(signature(state.positions));

  // LOCAL STORAGE
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // HYDRATE (APENAS UMA VEZ)
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    let cancelled = false;

    const run = async () => {
      const client = supabaseRef.current;
      if (!client) return;

      const sessionResult = await client.auth.getSession();
      const user = sessionResult.data.session?.user;
      if (!user) return;

      const { data, error } = await client
        .from(PORTFOLIO_TABLE)
        .select('ticker, quantity, avg_price')
        .eq('user_id', user.id);

      if (error || cancelled || !data) return;

      const positions = normalizePositions(
        data.map((row) => ({
          ticker: row.ticker,
          quantity: row.quantity,
          avgPrice: row.avg_price,
        }))
      );

      lastSignatureRef.current = signature(positions);

      setState((prev) => ({
        ...prev,
        positions,
      }));
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  // SYNC (CONTROLADO)
  useEffect(() => {
    const client = supabaseRef.current;
    if (!client) return;

    if (syncingRef.current) return;

    const currentSig = signature(state.positions);

    if (currentSig === lastSignatureRef.current) return;

    syncingRef.current = true;

    let cancelled = false;

    const run = async () => {
      const sessionResult = await client.auth.getSession();
      const user = sessionResult.data.session?.user;
      if (!user) {
        syncingRef.current = false;
        return;
      }

      await client
        .from(PORTFOLIO_TABLE)
        .delete()
        .eq('user_id', user.id);

      if (state.positions.length > 0) {
        await client.from(PORTFOLIO_TABLE).insert(
          state.positions.map((p) => ({
            user_id: user.id,
            ticker: p.ticker,
            quantity: p.quantity,
            avg_price: p.avgPrice,
          }))
        );
      }

      if (!cancelled) {
        lastSignatureRef.current = currentSig;
      }

      syncingRef.current = false;
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [state.positions]);

  const setPref =
    <K extends keyof AppState['preferences']>(key: K) =>
    (value: AppState['preferences'][K]) => {
      setState((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [key]: value,
        },
      }));
    };

  const actions = useMemo<PersistentAppStateActions>(
    () => ({
      updateRiskProfile: setPref('riskProfile'),
      updateMacroScenario: setPref('macroScenario'),
      updatePreferredTypes: setPref('preferredTypes'),
      updateBlockedTickers: setPref('blockedTickers'),

      updateMonthlyContribution: (value) =>
        setState((prev) => ({ ...prev, monthlyContribution: value })),

      updateFilterType: (value) =>
        setState((prev) => ({ ...prev, filterType: value })),

      upsertPosition: (p) =>
        setState((prev) => ({
          ...prev,
          positions: normalizePositions([...prev.positions, p]),
        })),

      upsertManyPositions: (positions) =>
        setState((prev) => ({
          ...prev,
          positions: normalizePositions([
            ...prev.positions,
            ...positions,
          ]),
        })),

      replacePositions: (positions) =>
        setState((prev) => ({
          ...prev,
          positions: normalizePositions(positions),
        })),

      removePosition: (ticker) =>
        setState((prev) => ({
          ...prev,
          positions: prev.positions.filter(
            (p) => p.ticker !== sanitizeTicker(ticker)
          ),
        })),

      resetState: () => {
        const next = cloneDefaultState();
        lastSignatureRef.current = signature(next.positions);
        setState(next);
      },
    }),
    []
  );

  return { state, actions };
};