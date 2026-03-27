import { getSupabase } from '../supabaseClient';
import type { AppState, PortfolioPosition } from '../../domain/types';

const supabase = getSupabase();

type CloudPreferencesRow = {
  user_id: string;
  risk_profile: AppState['preferences']['riskProfile'];
  macro_scenario: AppState['preferences']['macroScenario'];
  preferred_types: AppState['preferences']['preferredTypes'];
  monthly_contribution: number;
  filter_type: AppState['filterType'];
  blocked_tickers: string[];
};

type CloudPositionSelectRow = {
  ticker: string;
  quantity: number;
  avg_price: number;
};

type CloudPositionInsertRow = {
  user_id: string;
  ticker: string;
  quantity: number;
  avg_price: number;
};

export const loadCloudAppState = async (): Promise<AppState | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [preferencesResult, positionsResult] = await Promise.all([
    supabase
      .from('portfolio_preferences')
      .select(
        'risk_profile, macro_scenario, preferred_types, monthly_contribution, filter_type, blocked_tickers'
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('portfolio_positions')
      .select('ticker, quantity, avg_price')
      .eq('user_id', user.id)
      .order('ticker', { ascending: true }),
  ]);

  if (preferencesResult.error || positionsResult.error) {
    throw new Error(
      preferencesResult.error?.message ??
        positionsResult.error?.message ??
        'Erro ao carregar dados em nuvem.'
    );
  }

  const preferencesRow = preferencesResult.data as CloudPreferencesRow | null;
  const positionsRows = (positionsResult.data ?? []) as CloudPositionSelectRow[];

  if (!preferencesRow) {
    return null;
  }

  const positions: PortfolioPosition[] = positionsRows.map((row) => ({
    ticker: row.ticker,
    quantity: row.quantity,
    avgPrice: row.avg_price,
  }));

  return {
    preferences: {
      riskProfile: preferencesRow.risk_profile,
      macroScenario: preferencesRow.macro_scenario,
      preferredTypes: preferencesRow.preferred_types ?? [],
      blockedTickers: preferencesRow.blocked_tickers ?? [],
    },
    monthlyContribution: preferencesRow.monthly_contribution,
    filterType: preferencesRow.filter_type,
    positions,
  };
};

export const saveCloudAppState = async (state: AppState): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const preferencesPayload: CloudPreferencesRow = {
    user_id: user.id,
    risk_profile: state.preferences.riskProfile,
    macro_scenario: state.preferences.macroScenario,
    preferred_types: state.preferences.preferredTypes,
    monthly_contribution: state.monthlyContribution,
    filter_type: state.filterType,
    blocked_tickers: state.preferences.blockedTickers,
  };

  const positionsPayload: CloudPositionInsertRow[] = state.positions.map((position) => ({
    user_id: user.id,
    ticker: position.ticker,
    quantity: position.quantity,
    avg_price: position.avgPrice,
  }));

  const { error: preferencesError } = await supabase
    .from('portfolio_preferences')
    .upsert(preferencesPayload, { onConflict: 'user_id' });

  if (preferencesError) {
    throw new Error(preferencesError.message);
  }

  const { error: deleteError } = await supabase
    .from('portfolio_positions')
    .delete()
    .eq('user_id', user.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (positionsPayload.length > 0) {
    const { error: insertError } = await supabase
      .from('portfolio_positions')
      .insert(positionsPayload);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
};