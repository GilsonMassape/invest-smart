import type {
  AppState,
  AssetType,
  FilterType,
  MacroScenario,
  PortfolioPosition,
  RiskProfile,
} from '../../domain/types'
import { supabase } from '../../infra/supabase/supabaseClient'

export type CloudPositionRow = {
  ticker: string
  quantity: number
  avg_price: number
  current_price: number | null
}

export type CloudPreferencesRow = {
  risk_profile: RiskProfile
  macro_scenario: MacroScenario
  preferred_types: AppState['preferences']['preferredTypes']
  blocked_tickers: AppState['preferences']['blockedTickers']
}

export type CloudPayload = {
  positions: CloudPositionRow[]
  preferences: CloudPreferencesRow
  monthly_contribution: number
  filter_type?: FilterType
}

type CloudStateRow = {
  user_id: string
  payload: CloudPayload
  updated_at?: string | null
}

const CLOUD_STATE_TABLE = 'user_app_state'

const DEFAULT_RISK_PROFILE: RiskProfile = 'EQUILIBRADO'
const DEFAULT_MACRO_SCENARIO: MacroScenario = 'NEUTRO'
const DEFAULT_FILTER_TYPE: FilterType = 'TODOS'
const DEFAULT_PREFERRED_TYPES: AppState['preferences']['preferredTypes'] = [
  'AÇÃO',
  'FII',
  'ETF',
  'BDR',
]

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTicker(value: unknown): string {
  return toSafeString(value).toUpperCase()
}

function isRiskProfile(value: unknown): value is RiskProfile {
  return (
    value === 'CONSERVADOR' ||
    value === 'EQUILIBRADO' ||
    value === 'ARROJADO'
  )
}

function isMacroScenario(value: unknown): value is MacroScenario {
  return (
    value === 'NEUTRO' ||
    value === 'JUROS_ALTOS' ||
    value === 'CRESCIMENTO' ||
    value === 'INFLACAO'
  )
}

function isFilterType(value: unknown): value is FilterType {
  return (
    value === 'AÇÃO' ||
    value === 'FII' ||
    value === 'ETF' ||
    value === 'BDR' ||
    value === 'TODOS'
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAssetTypeValue(value: unknown): value is AssetType {
  return (
    value === 'AÇÃO' ||
    value === 'FII' ||
    value === 'ETF' ||
    value === 'BDR'
  )
}

function normalizePreferredTypes(
  value: unknown
): AppState['preferences']['preferredTypes'] {
  if (!Array.isArray(value)) {
    return DEFAULT_PREFERRED_TYPES
  }

  const normalized = value.filter(isAssetTypeValue)

  return normalized.length > 0 ? normalized : DEFAULT_PREFERRED_TYPES
}

function normalizeBlockedTickers(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((ticker) => normalizeTicker(ticker))
    .filter((ticker) => ticker.length > 0)
}

function toCloudPositionRow(position: PortfolioPosition): CloudPositionRow {
  return {
    ticker: normalizeTicker(position.ticker),
    quantity: toSafeNumber(position.quantity),
    avg_price: toSafeNumber(position.avgPrice),
    current_price:
      typeof position.currentPrice === 'number'
        ? toSafeNumber(position.currentPrice)
        : null,
  }
}

function fromUnknownPositionRow(value: unknown): PortfolioPosition | null {
  if (!isObjectRecord(value)) {
    return null
  }

  const ticker = normalizeTicker(value.ticker)

  if (!ticker) {
    return null
  }

  return {
    ticker,
    quantity: toSafeNumber(value.quantity),
    avgPrice: toSafeNumber(value.avg_price),
    currentPrice:
      typeof value.current_price === 'number'
        ? toSafeNumber(value.current_price)
        : null,
  }
}

function buildDefaultAppState(): AppState {
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
  }
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return data.user?.id ?? null
}

function isCloudPayload(value: unknown): value is CloudPayload {
  return isObjectRecord(value)
}

export function toCloudPayload(state: AppState): CloudPayload {
  return {
    positions: state.positions.map(toCloudPositionRow),
    preferences: {
      risk_profile: state.preferences.riskProfile,
      macro_scenario: state.preferences.macroScenario,
      preferred_types: normalizePreferredTypes(state.preferences.preferredTypes),
      blocked_tickers: normalizeBlockedTickers(state.preferences.blockedTickers),
    },
    monthly_contribution: toSafeNumber(state.monthlyContribution),
    filter_type: state.filterType,
  }
}

export function fromCloudPayload(payload: unknown): AppState {
  if (!isObjectRecord(payload)) {
    return buildDefaultAppState()
  }

  const rawPositions = Array.isArray(payload.positions) ? payload.positions : []
  const positions = rawPositions
    .map(fromUnknownPositionRow)
    .filter((position): position is PortfolioPosition => position !== null)

  const preferences = isObjectRecord(payload.preferences)
    ? payload.preferences
    : {}

  const riskProfile = isRiskProfile(preferences.risk_profile)
    ? preferences.risk_profile
    : DEFAULT_RISK_PROFILE

  const macroScenario = isMacroScenario(preferences.macro_scenario)
    ? preferences.macro_scenario
    : DEFAULT_MACRO_SCENARIO

  const preferredTypes = normalizePreferredTypes(preferences.preferred_types)
  const blockedTickers = normalizeBlockedTickers(preferences.blocked_tickers)

  const filterType = isFilterType(payload.filter_type)
    ? payload.filter_type
    : DEFAULT_FILTER_TYPE

  return {
    positions,
    preferences: {
      riskProfile,
      macroScenario,
      preferredTypes,
      blockedTickers,
    },
    monthlyContribution: toSafeNumber(payload.monthly_contribution),
    filterType,
  }
}

export function toPositionsInsertRows(state: AppState): CloudPositionRow[] {
  return state.positions.map(toCloudPositionRow)
}

export async function loadCloudAppState(): Promise<AppState | null> {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return null
  }

  const { data, error } = await supabase
    .from(CLOUD_STATE_TABLE)
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle<Pick<CloudStateRow, 'payload'>>()

  if (error) {
    throw error
  }

  if (!data || !isCloudPayload(data.payload)) {
    return null
  }

  return fromCloudPayload(data.payload)
}

export async function saveCloudAppState(state: AppState): Promise<void> {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return
  }

  const payload = toCloudPayload(state)

  const { error } = await supabase
    .from(CLOUD_STATE_TABLE)
    .upsert(
      {
        user_id: userId,
        payload,
      },
      {
        onConflict: 'user_id',
      }
    )

  if (error) {
    throw error
  }
}