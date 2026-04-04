import type {
  AppState,
  FilterType,
  MacroScenario,
  PortfolioPosition,
  RiskProfile,
} from '../../domain/types';

export type CloudPositionRow = {
  ticker: string;
  quantity: number;
  avg_price: number;
  current_price: number | null;
};

export type CloudPreferencesRow = {
  risk_profile: RiskProfile;
  macro_scenario: MacroScenario;
  preferred_types: AppState['preferences']['preferredTypes'];
  blocked_tickers: AppState['preferences']['blockedTickers'];
};

export type CloudPayload = {
  positions: CloudPositionRow[];
  preferences: CloudPreferencesRow;
  monthly_contribution: number;
  filter_type?: FilterType;
};

const DEFAULT_RISK_PROFILE: RiskProfile = 'EQUILIBRADO';
const DEFAULT_MACRO_SCENARIO: MacroScenario = 'NEUTRO';
const DEFAULT_FILTER_TYPE: FilterType = 'TODOS';
const DEFAULT_PREFERRED_TYPES: AppState['preferences']['preferredTypes'] = [
  'AÇÃO',
  'FII',
  'ETF',
  'BDR',
];

const toSafeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSafeString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeTicker = (value: unknown): string => {
  return toSafeString(value).toUpperCase();
};

const isRiskProfile = (value: unknown): value is RiskProfile => {
  return (
    value === 'CONSERVADOR' ||
    value === 'EQUILIBRADO' ||
    value === 'ARROJADO'
  );
};

const isMacroScenario = (value: unknown): value is MacroScenario => {
  return (
    value === 'NEUTRO' ||
    value === 'JUROS_ALTOS' ||
    value === 'CRESCIMENTO' ||
    value === 'INFLACAO'
  );
};

const isFilterType = (value: unknown): value is FilterType => {
  return (
    value === 'AÇÃO' ||
    value === 'FII' ||
    value === 'ETF' ||
    value === 'BDR' ||
    value === 'TODOS'
  );
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isAssetTypeValue = (
  value: unknown,
): value is AppState['preferences']['preferredTypes'][number] => {
  return (
    value === 'AÇÃO' ||
    value === 'FII' ||
    value === 'ETF' ||
    value === 'BDR'
  );
};

const toCloudPositionRow = (position: PortfolioPosition): CloudPositionRow => ({
  ticker: normalizeTicker(position.ticker),
  quantity: toSafeNumber(position.quantity),
  avg_price: toSafeNumber(position.avgPrice),
  current_price:
    typeof position.currentPrice === 'number'
      ? toSafeNumber(position.currentPrice)
      : null,
});

const fromUnknownPositionRow = (value: unknown): PortfolioPosition | null => {
  if (!isObjectRecord(value)) {
    return null;
  }

  const ticker = normalizeTicker(value.ticker);

  if (!ticker) {
    return null;
  }

  return {
    ticker,
    quantity: toSafeNumber(value.quantity),
    avgPrice: toSafeNumber(value.avg_price),
    currentPrice:
      typeof value.current_price === 'number'
        ? toSafeNumber(value.current_price)
        : null,
  };
};

export const toCloudPayload = (state: AppState): CloudPayload => {
  return {
    positions: state.positions.map(toCloudPositionRow),
    preferences: {
      risk_profile: state.preferences.riskProfile,
      macro_scenario: state.preferences.macroScenario,
      preferred_types: state.preferences.preferredTypes,
      blocked_tickers: state.preferences.blockedTickers,
    },
    monthly_contribution: toSafeNumber(state.monthlyContribution),
    filter_type: state.filterType,
  };
};

export const fromCloudPayload = (payload: unknown): AppState => {
  if (!isObjectRecord(payload)) {
    return {
      positions: [],
      preferences: {
        riskProfile: DEFAULT_RISK_PROFILE,
        macroScenario: DEFAULT_MACRO_SCENARIO,
        preferredTypes: DEFAULT_PREFERRED_TYPES,
        blockedTickers: [],
      },
      monthlyContribution: 0,
      filterType: DEFAULT_FILTER_TYPE,
    };
  }

  const rawPositions = Array.isArray(payload.positions) ? payload.positions : [];
  const positions = rawPositions
    .map(fromUnknownPositionRow)
    .filter((position): position is PortfolioPosition => position !== null);

  const preferences = isObjectRecord(payload.preferences)
    ? payload.preferences
    : {};

  const riskProfile = isRiskProfile(preferences.risk_profile)
    ? preferences.risk_profile
    : DEFAULT_RISK_PROFILE;

  const macroScenario = isMacroScenario(preferences.macro_scenario)
    ? preferences.macro_scenario
    : DEFAULT_MACRO_SCENARIO;

  const preferredTypes = Array.isArray(preferences.preferred_types)
    ? preferences.preferred_types.filter(isAssetTypeValue)
    : DEFAULT_PREFERRED_TYPES;

  const blockedTickers = Array.isArray(preferences.blocked_tickers)
    ? preferences.blocked_tickers
        .map((ticker) => normalizeTicker(ticker))
        .filter(Boolean)
    : [];

  const filterType = isFilterType(payload.filter_type)
    ? payload.filter_type
    : DEFAULT_FILTER_TYPE;

  return {
    positions,
    preferences: {
      riskProfile,
      macroScenario,
      preferredTypes:
        preferredTypes.length > 0 ? preferredTypes : DEFAULT_PREFERRED_TYPES,
      blockedTickers,
    },
    monthlyContribution: toSafeNumber(payload.monthly_contribution),
    filterType,
  };
};

export const toPositionsInsertRows = (state: AppState): CloudPositionRow[] => {
  return state.positions.map(toCloudPositionRow);
};

export const loadCloudAppState = async (): Promise<AppState | null> => {
  return null;
};

export const saveCloudAppState = async (_state: AppState): Promise<void> => {
  return;
};