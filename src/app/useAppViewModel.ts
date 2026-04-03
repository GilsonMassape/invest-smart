import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ASSETS } from '../data/assets'
import {
  resolveB3ImportPositions,
  type B3ImportMode,
  type B3ParsedPosition,
} from '../domain/import/b3Import'
import type { PatrimonyHistory } from '../domain/history'
import type {
  Asset,
  ContributionSuggestion,
  Decision,
  FilterType,
  MacroScenario,
  PortfolioPosition,
  RankedAsset,
  RebalanceSuggestion,
  RiskProfile,
} from '../domain/types'
import {
  aggregatePortfolio,
  type AssetType as DashboardAssetType,
  type ConcentrationDataItem,
  type DistributionByAssetItem,
  type DistributionByTypeItem,
  type PortfolioPosition as AggregationPortfolioPosition,
} from '../engine/dashboard/aggregatePortfolio'
import { buildDecision } from '../engine/decision/buildDecision'
import { usePersistentAppState } from '../hooks/usePersistentAppState'
import { usePortfolioData } from '../hooks/usePortfolioData'
import {
  appendSnapshot,
  loadPatrimonyHistory,
  savePatrimonyHistory,
} from '../services/patrimonyHistory'
import { fetchPrices } from '../services/priceService'

type PersistentAppState = ReturnType<typeof usePersistentAppState>
type PersistentState = PersistentAppState['state']
type PersistentActions = PersistentAppState['actions']
type PortfolioData = ReturnType<typeof usePortfolioData>

type DashboardTypePoint = DistributionByTypeItem
type DashboardAssetPoint = DistributionByAssetItem
type DashboardConcentrationPoint = ConcentrationDataItem

type DashboardMetricPoint = {
  name: string
  value: number
}

type AggregatedDashboardData = {
  totalInvested: number
  distributionByType: DashboardTypePoint[]
  distributionByAsset: DashboardAssetPoint[]
  concentrationData: DashboardConcentrationPoint[]
}

export interface HeaderViewModel {
  riskProfile: RiskProfile
  macroScenario: MacroScenario
  onRiskProfileChange: (value: RiskProfile) => void
  onMacroScenarioChange: (value: MacroScenario) => void
}

export interface DashboardViewModel {
  totalInvested: number
  monthlyContribution: number
  rankedCount: number
  totalPatrimony: number
  distributionByType: DashboardTypePoint[]
  distributionByAsset: DashboardAssetPoint[]
  concentrationData: DashboardConcentrationPoint[]
  performanceData: DashboardMetricPoint[]
  evolutionData: DashboardMetricPoint[]
  insights: string[]
}

export interface ContributionViewModel {
  monthlyContribution: number
  contribution: ContributionSuggestion[]
  onMonthlyContributionChange: (value: number) => void
}

export interface PortfolioViewModel {
  portfolio: PortfolioData['portfolio']
  assets: Asset[]
  currentPositions: PortfolioPosition[]
  onUpsertPosition: (value: PortfolioPosition) => void
  onRemovePosition: (ticker: string) => void
  onImportFromB3: (parsed: B3ParsedPosition[], mode: B3ImportMode) => void
}

export interface RankingViewModel {
  ranking: RankedAsset[]
  decision: Decision[]
  filterType: FilterType
  onFilterTypeChange: (value: FilterType) => void
}

export interface RebalanceViewModel {
  rebalance: RebalanceSuggestion[]
  alerts: string[]
}

export interface AppViewModel {
  header: HeaderViewModel
  dashboard: DashboardViewModel
  contribution: ContributionViewModel
  portfolio: PortfolioViewModel
  ranking: RankingViewModel
  rebalance: RebalanceViewModel
}

type AssetCatalogMap = Map<string, Asset>

const VALID_DASHBOARD_TYPES: DashboardAssetType[] = [
  'AÇÃO',
  'FII',
  'ETF',
  'BDR',
]

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function buildAssetCatalogMap(assets: Asset[]): AssetCatalogMap {
  return new Map(assets.map((asset) => [normalizeTicker(asset.ticker), asset]))
}

function resolveAssetTypeForAggregation(
  assetCatalog: AssetCatalogMap,
  ticker: string
): DashboardAssetType | null {
  const asset = assetCatalog.get(normalizeTicker(ticker))

  if (!asset) {
    return null
  }

  const rawType =
    'type' in asset ? (asset as Asset & { type?: string }).type : undefined

  if (typeof rawType !== 'string' || rawType.trim().length === 0) {
    return null
  }

  const normalizedType = rawType.trim().toUpperCase() as DashboardAssetType

  return VALID_DASHBOARD_TYPES.includes(normalizedType)
    ? normalizedType
    : null
}

function toBasePortfolioPositions(
  portfolio: PortfolioData['portfolio']
): PortfolioPosition[] {
  return portfolio.map((position) => ({
    ticker: position.ticker,
    quantity: position.quantity,
    avgPrice: position.avgPrice,
    currentPrice: position.currentPrice ?? null,
  }))
}

function toAggregationPortfolioPositions(
  portfolio: PortfolioData['portfolio'],
  assetCatalog: AssetCatalogMap
): AggregationPortfolioPosition[] {
  return portfolio.map((position) => ({
    ticker: position.ticker,
    quantity: position.quantity,
    avgPrice: position.avgPrice,
    currentPrice: position.currentPrice ?? null,
    assetType: resolveAssetTypeForAggregation(assetCatalog, position.ticker),
    label: normalizeTicker(position.ticker),
  }))
}

function buildPerformanceData(
  totalInvested: number,
  totalPatrimony: number
): DashboardMetricPoint[] {
  const safeInvested = toSafeNumber(totalInvested)
  const safePatrimony = toSafeNumber(totalPatrimony)
  const absoluteResult = safePatrimony - safeInvested
  const percentageResult =
    safeInvested > 0 ? (absoluteResult / safeInvested) * 100 : 0

  return [
    {
      name: 'Investido',
      value: safeInvested,
    },
    {
      name: 'Patrimônio',
      value: safePatrimony,
    },
    {
      name: 'Resultado',
      value: absoluteResult,
    },
    {
      name: 'Resultado %',
      value: percentageResult,
    },
  ]
}

function buildEvolutionData(
  history: PatrimonyHistory,
  currentTotalPatrimony: number
): DashboardMetricPoint[] {
  const safeHistory = Array.isArray(history) ? history : []
  const groupedByDay = new Map<string, number>()

  safeHistory
    .filter((snapshot) => Number.isFinite(snapshot?.timestamp))
    .filter((snapshot) => Number.isFinite(snapshot?.total))
    .forEach((snapshot) => {
      const dayKey = new Date(snapshot.timestamp).toLocaleDateString('pt-BR')
      groupedByDay.set(dayKey, toSafeNumber(snapshot.total))
    })

  const normalizedHistory = Array.from(groupedByDay.entries()).map(
    ([name, value]) => ({
      name,
      value,
    })
  )

  if (normalizedHistory.length > 0) {
    return normalizedHistory
  }

  return [
    {
      name: 'Atual',
      value: toSafeNumber(currentTotalPatrimony),
    },
  ]
}

function buildDashboardInsights(decision: Decision[]): string[] {
  const insights: string[] = []

  const strongBuy = decision.find((item) => item.action === 'COMPRAR_FORTE')
  const buy = decision.find((item) => item.action === 'COMPRAR')
  const reduce = decision.find((item) => item.action === 'REDUZIR')
  const avoid = decision.find((item) => item.action === 'EVITAR')

  if (strongBuy) {
    insights.push(`Forte oportunidade: ${strongBuy.ticker}`)
  } else if (buy) {
    insights.push(`Melhor compra no momento: ${buy.ticker}`)
  }

  if (reduce) {
    insights.push(`Reduzir exposição em ${reduce.ticker}`)
  }

  if (avoid) {
    insights.push(`Evitar ${avoid.ticker} por baixa atratividade`)
  }

  return insights
}

function createHeaderViewModel(
  state: PersistentState,
  actions: PersistentActions
): HeaderViewModel {
  return {
    riskProfile: state.preferences.riskProfile,
    macroScenario: state.preferences.macroScenario,
    onRiskProfileChange: actions.updateRiskProfile,
    onMacroScenarioChange: actions.updateMacroScenario,
  }
}

function createDashboardAggregation(
  portfolio: PortfolioData['portfolio'],
  assetCatalog: AssetCatalogMap
): AggregatedDashboardData {
  const aggregationPositions = toAggregationPortfolioPositions(
    portfolio,
    assetCatalog
  )

  const aggregation = aggregatePortfolio(aggregationPositions)

  return {
    totalInvested: aggregation.totalInvested,
    distributionByType: aggregation.distributionByType,
    distributionByAsset: aggregation.distributionByAsset,
    concentrationData: aggregation.concentrationData.slice(0, 10),
  }
}

function createDashboardViewModel({
  state,
  rankedCount,
  decision,
  patrimonyHistory,
  aggregation,
}: {
  state: PersistentState
  rankedCount: number
  decision: Decision[]
  patrimonyHistory: PatrimonyHistory
  aggregation: AggregatedDashboardData
}): DashboardViewModel {
  const totalPatrimony = aggregation.totalInvested
  const performanceData = buildPerformanceData(
    aggregation.totalInvested,
    totalPatrimony
  )
  const evolutionData = buildEvolutionData(patrimonyHistory, totalPatrimony)
  const insights = buildDashboardInsights(decision)

  return {
    totalInvested: aggregation.totalInvested,
    monthlyContribution: state.monthlyContribution,
    rankedCount,
    totalPatrimony,
    distributionByType: aggregation.distributionByType,
    distributionByAsset: aggregation.distributionByAsset,
    concentrationData: aggregation.concentrationData,
    performanceData,
    evolutionData,
    insights,
  }
}

function createContributionViewModel(
  state: PersistentState,
  contribution: ContributionSuggestion[],
  actions: PersistentActions
): ContributionViewModel {
  return {
    monthlyContribution: state.monthlyContribution,
    contribution,
    onMonthlyContributionChange: actions.updateMonthlyContribution,
  }
}

export const useAppViewModel = (): AppViewModel => {
  const { state, actions } = usePersistentAppState()

  const {
    ranking,
    portfolio,
    contribution,
    rebalance,
    alerts,
  } = usePortfolioData(state)

  const patrimonyHistoryRef = useRef<PatrimonyHistory>(loadPatrimonyHistory())

  useEffect(() => {
    const tickers = portfolio.map((position) => position.ticker)

    if (tickers.length === 0) {
      return
    }

    fetchPrices(tickers).catch((error) => {
      console.error('❌ erro ao buscar preços', error)
    })
  }, [portfolio])

  const decision = useMemo<Decision[]>(() => buildDecision(ranking), [ranking])

  const assetCatalog = useMemo<AssetCatalogMap>(
    () => buildAssetCatalogMap(ASSETS),
    []
  )

  const currentPortfolioPositions = useMemo<PortfolioPosition[]>(
    () => toBasePortfolioPositions(portfolio),
    [portfolio]
  )

  const handleImportFromB3 = useCallback(
    (parsed: B3ParsedPosition[], mode: B3ImportMode) => {
      const nextPositions = resolveB3ImportPositions(
        currentPortfolioPositions,
        parsed,
        mode
      )

      actions.replacePositions(nextPositions)
    },
    [actions, currentPortfolioPositions]
  )

  const headerViewModel = useMemo<HeaderViewModel>(
    () => createHeaderViewModel(state, actions),
    [actions, state]
  )

  const dashboardAggregation = useMemo<AggregatedDashboardData>(
    () => createDashboardAggregation(portfolio, assetCatalog),
    [assetCatalog, portfolio]
  )

  const totalPatrimony = dashboardAggregation.totalInvested

  useEffect(() => {
    if (!Number.isFinite(totalPatrimony) || totalPatrimony <= 0) {
      return
    }

    const snapshot = {
      timestamp: Date.now(),
      total: totalPatrimony,
    }

    const updatedHistory = appendSnapshot(
      patrimonyHistoryRef.current,
      snapshot
    )

    patrimonyHistoryRef.current = updatedHistory
    savePatrimonyHistory(updatedHistory)
  }, [totalPatrimony])

  const dashboardViewModel = useMemo<DashboardViewModel>(
    () =>
      createDashboardViewModel({
        state,
        rankedCount: ranking.length,
        decision,
        patrimonyHistory: patrimonyHistoryRef.current,
        aggregation: dashboardAggregation,
      }),
    [dashboardAggregation, decision, ranking.length, state, totalPatrimony]
  )

  const contributionViewModel = useMemo<ContributionViewModel>(
    () => createContributionViewModel(state, contribution, actions),
    [actions, contribution, state]
  )

  const portfolioViewModel = useMemo<PortfolioViewModel>(
    () => ({
      portfolio,
      assets: ASSETS,
      currentPositions: currentPortfolioPositions,
      onUpsertPosition: actions.upsertPosition,
      onRemovePosition: actions.removePosition,
      onImportFromB3: handleImportFromB3,
    }),
    [
      actions.removePosition,
      actions.upsertPosition,
      currentPortfolioPositions,
      handleImportFromB3,
      portfolio,
    ]
  )

  const rankingViewModel = useMemo<RankingViewModel>(
    () => ({
      ranking,
      decision,
      filterType: state.filterType,
      onFilterTypeChange: actions.updateFilterType,
    }),
    [actions.updateFilterType, decision, ranking, state.filterType]
  )

  const rebalanceViewModel = useMemo<RebalanceViewModel>(
    () => ({
      rebalance,
      alerts,
    }),
    [alerts, rebalance]
  )

  return useMemo<AppViewModel>(
    () => ({
      header: headerViewModel,
      dashboard: dashboardViewModel,
      contribution: contributionViewModel,
      portfolio: portfolioViewModel,
      ranking: rankingViewModel,
      rebalance: rebalanceViewModel,
    }),
    [
      contributionViewModel,
      dashboardViewModel,
      headerViewModel,
      portfolioViewModel,
      rankingViewModel,
      rebalanceViewModel,
    ]
  )
}