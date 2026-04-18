import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StatItem } from '../components/common/StatGrid'
import { ASSETS } from '../data/assets'
import {
  resolveB3ImportPositions,
  type B3ImportMode,
  type B3ParsedPosition,
} from '../domain/import/b3Import'
import type { PatrimonyHistory, PatrimonySnapshot } from '../domain/history'
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
  buildDashboardAggregation,
  buildDashboardAssetCatalogMap,
  buildDashboardViewModel,
  type DashboardAggregation,
  type DashboardAssetCatalogMap,
  type DashboardAssetPoint,
  type DashboardConcentrationPoint,
  type DashboardInsight,
  type DashboardMetricPoint,
  type DashboardTypePoint,
} from '../engine/dashboard/buildDashboardViewModel'
import { buildDecision } from '../engine/decision/buildDecision'
import { usePersistentAppState } from '../hooks/usePersistentAppState'
import { usePortfolioData } from '../hooks/usePortfolioData'
import {
  appendSnapshot,
  loadPatrimonyHistory,
  savePatrimonyHistory,
} from '../services/patrimonyHistory'

type PersistentAppState = ReturnType<typeof usePersistentAppState>
type PersistentState = PersistentAppState['state']
type PersistentActions = PersistentAppState['actions']
type PortfolioData = ReturnType<typeof usePortfolioData>
type PortfolioItem = PortfolioData['portfolio'][number]
type PriceStatus = PortfolioData['priceStatus']

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
  insights: DashboardInsight[]
  statItems: StatItem[]
  priceStatus: PriceStatus
  priceError: string | null
  lastPriceUpdateAt: number | null
  onRefreshPrices: () => Promise<void>
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

function toSafeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readPortfolioItemCurrentPrice(position: PortfolioItem): number | null {
  const candidate = position as PortfolioItem & {
    currentPrice?: unknown
    price?: unknown
    marketPrice?: unknown
  }

  if (
    typeof candidate.currentPrice === 'number' &&
    Number.isFinite(candidate.currentPrice)
  ) {
    return candidate.currentPrice
  }

  if (
    typeof candidate.marketPrice === 'number' &&
    Number.isFinite(candidate.marketPrice)
  ) {
    return candidate.marketPrice
  }

  if (typeof candidate.price === 'number' && Number.isFinite(candidate.price)) {
    return candidate.price
  }

  return null
}

function mapToBasePortfolioPosition(position: PortfolioItem): PortfolioPosition {
  return {
    ticker: position.ticker,
    quantity: position.quantity,
    avgPrice: position.avgPrice,
    currentPrice: readPortfolioItemCurrentPrice(position),
  }
}

function toBasePortfolioPositions(
  portfolio: PortfolioData['portfolio']
): PortfolioPosition[] {
  return portfolio.map(mapToBasePortfolioPosition)
}

function buildHeaderViewModel(
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

function buildContributionViewModel(
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

function buildPortfolioViewModel(params: {
  portfolio: PortfolioData['portfolio']
  currentPositions: PortfolioPosition[]
  actions: PersistentActions
  onImportFromB3: (parsed: B3ParsedPosition[], mode: B3ImportMode) => void
}): PortfolioViewModel {
  const { portfolio, currentPositions, actions, onImportFromB3 } = params

  return {
    portfolio,
    assets: ASSETS,
    currentPositions,
    onUpsertPosition: actions.upsertPosition,
    onRemovePosition: actions.removePosition,
    onImportFromB3,
  }
}

function buildRankingViewModel(
  ranking: RankedAsset[],
  decision: Decision[],
  state: PersistentState,
  actions: PersistentActions
): RankingViewModel {
  return {
    ranking,
    decision,
    filterType: state.filterType,
    onFilterTypeChange: actions.updateFilterType,
  }
}

function buildRebalanceViewModel(
  rebalance: RebalanceSuggestion[],
  alerts: string[]
): RebalanceViewModel {
  return {
    rebalance,
    alerts,
  }
}

function buildDashboardStatItems(params: {
  totalInvested: number
  totalPatrimony: number
  performanceData: DashboardMetricPoint[]
}): StatItem[] {
  const { totalInvested, totalPatrimony, performanceData } = params

  const metricsByLabel = new Map(
    performanceData.map((item) => [
      String(item.name ?? '').trim(),
      toSafeNumber(item.value),
    ])
  )

  const readMetric = (label: string): number => metricsByLabel.get(label) ?? 0

  return [
    {
      label: 'Investido',
      value: toSafeNumber(totalInvested),
      type: 'currency',
    },
    {
      label: 'Patrimônio',
      value: toSafeNumber(totalPatrimony),
      type: 'currency',
    },
    {
      label: 'Resultado',
      value: readMetric('Resultado'),
      type: 'currency',
    },
    {
      label: 'Resultado %',
      value: readMetric('Resultado %'),
      type: 'percentage',
    },
    {
      label: 'Rentabilidade mensal',
      value: readMetric('Rentabilidade mensal'),
      type: 'percentage',
    },
    {
      label: 'Rentabilidade anual',
      value: readMetric('Rentabilidade anual'),
      type: 'percentage',
    },
    {
      label: 'Volatilidade',
      value: readMetric('Volatilidade'),
      type: 'percentage',
    },
  ]
}

export const useAppViewModel = (): AppViewModel => {
  const { state, actions } = usePersistentAppState()

  const {
    ranking,
    portfolio,
    contribution,
    rebalance,
    alerts,
    totalInvested,
    priceStatus,
    priceError,
    lastPriceUpdateAt,
    refreshPrices,
  } = usePortfolioData(state)

  const patrimonyHistoryRef = useRef<PatrimonyHistory>(loadPatrimonyHistory())

  const decision = useMemo<Decision[]>(() => buildDecision(ranking), [ranking])

  const assetCatalog = useMemo<DashboardAssetCatalogMap>(
    () => buildDashboardAssetCatalogMap(ASSETS),
    []
  )

  const currentPortfolioPositions = useMemo<PortfolioPosition[]>(
    () => toBasePortfolioPositions(portfolio),
    [portfolio]
  )

  const dashboardAggregation = useMemo<DashboardAggregation>(
    () => buildDashboardAggregation(currentPortfolioPositions, assetCatalog),
    [currentPortfolioPositions, assetCatalog]
  )

  const totalPatrimony = dashboardAggregation.totalPatrimony

  useEffect(() => {
    if (!Number.isFinite(totalPatrimony) || totalPatrimony <= 0) {
      return
    }

    const snapshot: PatrimonySnapshot = {
      timestamp: Date.now(),
      total: totalPatrimony,
    }

    const updatedHistory = appendSnapshot(patrimonyHistoryRef.current, snapshot)

    patrimonyHistoryRef.current = updatedHistory
    savePatrimonyHistory(updatedHistory)
  }, [totalPatrimony])

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
    () => buildHeaderViewModel(state, actions),
    [state, actions]
  )

  const dashboardViewModel = useMemo<DashboardViewModel>(() => {
    const baseDashboard = buildDashboardViewModel({
      monthlyContribution: state.monthlyContribution,
      rankedCount: ranking.length,
      decision,
      patrimonyHistory: patrimonyHistoryRef.current,
      aggregation: dashboardAggregation,
    })

    return {
      ...baseDashboard,
      totalInvested,
      statItems: buildDashboardStatItems({
        totalInvested,
        totalPatrimony: baseDashboard.totalPatrimony,
        performanceData: baseDashboard.performanceData,
      }),
      priceStatus,
      priceError,
      lastPriceUpdateAt,
      onRefreshPrices: refreshPrices,
    }
  }, [
    state.monthlyContribution,
    ranking.length,
    decision,
    dashboardAggregation,
    totalInvested,
    priceStatus,
    priceError,
    lastPriceUpdateAt,
    refreshPrices,
  ])

  const contributionViewModel = useMemo<ContributionViewModel>(
    () => buildContributionViewModel(state, contribution, actions),
    [state, contribution, actions]
  )

  const portfolioViewModel = useMemo<PortfolioViewModel>(
    () =>
      buildPortfolioViewModel({
        portfolio,
        currentPositions: currentPortfolioPositions,
        actions,
        onImportFromB3: handleImportFromB3,
      }),
    [portfolio, currentPortfolioPositions, actions, handleImportFromB3]
  )

  const rankingViewModel = useMemo<RankingViewModel>(
    () => buildRankingViewModel(ranking, decision, state, actions),
    [ranking, decision, state, actions]
  )

  const rebalanceViewModel = useMemo<RebalanceViewModel>(
    () => buildRebalanceViewModel(rebalance, alerts),
    [rebalance, alerts]
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
      headerViewModel,
      dashboardViewModel,
      contributionViewModel,
      portfolioViewModel,
      rankingViewModel,
      rebalanceViewModel,
    ]
  )
}