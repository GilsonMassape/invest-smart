import type { PatrimonyHistory } from '../../domain/history'
import type { Asset, Decision } from '../../domain/types'
import {
  aggregatePortfolio,
  type AssetType as DashboardAssetType,
  type ConcentrationDataItem,
  type DistributionByAssetItem,
  type DistributionByTypeItem,
  type PortfolioPosition as AggregationPortfolioPosition,
} from './aggregatePortfolio'
import { buildPerformanceMetrics } from './buildPerformanceMetrics'
import type { StatItem } from '../../components/common/StatGrid'

export type DashboardTypePoint = DistributionByTypeItem
export type DashboardAssetPoint = DistributionByAssetItem
export type DashboardConcentrationPoint = ConcentrationDataItem

export type DashboardMetricPoint = Readonly<{
  name: string
  value: number
}>

export type DashboardSourcePosition = Readonly<{
  ticker: string
  quantity: number
  avgPrice: number
  currentPrice?: number | null
}>

export type DashboardAssetCatalogMap = Map<string, Asset>

export type DashboardAggregation = Readonly<{
  totalInvested: number
  totalPatrimony: number
  distributionByType: DashboardTypePoint[]
  distributionByAsset: DashboardAssetPoint[]
  concentrationData: DashboardConcentrationPoint[]
}>

export type BuildDashboardViewModelParams = Readonly<{
  monthlyContribution: number
  rankedCount: number
  decision: readonly Decision[]
  patrimonyHistory: PatrimonyHistory
  aggregation: DashboardAggregation
}>

export type DashboardViewModelOutput = Readonly<{
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
  statItems: StatItem[]
}>

const VALID_DASHBOARD_TYPES: readonly DashboardAssetType[] = [
  'AÇÃO',
  'FII',
  'ETF',
  'BDR',
]

const PERFORMANCE_LABELS = {
  invested: 'Investido',
  patrimony: 'Patrimônio',
  profit: 'Resultado',
  profitPct: 'Resultado %',
  monthlyReturnPct: 'Rentabilidade mensal',
  annualReturnPct: 'Rentabilidade anual',
  volatilityPct: 'Volatilidade',
} as const

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function resolveDashboardAssetType(
  assetCatalog: DashboardAssetCatalogMap,
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

function mapToAggregationPortfolioPosition(
  position: DashboardSourcePosition,
  assetCatalog: DashboardAssetCatalogMap
): AggregationPortfolioPosition {
  return {
    ticker: normalizeTicker(position.ticker),
    quantity: toSafeNumber(position.quantity),
    avgPrice: toSafeNumber(position.avgPrice),
    currentPrice:
      position.currentPrice == null ? null : toSafeNumber(position.currentPrice),
    assetType: resolveDashboardAssetType(assetCatalog, position.ticker),
    label: normalizeTicker(position.ticker),
  }
}

function toAggregationPortfolioPositions(
  portfolio: readonly DashboardSourcePosition[],
  assetCatalog: DashboardAssetCatalogMap
): AggregationPortfolioPosition[] {
  return portfolio.map((position) =>
    mapToAggregationPortfolioPosition(position, assetCatalog)
  )
}

function toDayKey(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR')
}

function buildEvolutionData(
  history: PatrimonyHistory,
  currentTotalPatrimony: number
): DashboardMetricPoint[] {
  const safeHistory = Array.isArray(history) ? history : []
  const groupedByDay = new Map<string, number>()

  for (const item of safeHistory) {
    if (
      !item ||
      !Number.isFinite(item.timestamp) ||
      !Number.isFinite(item.total)
    ) {
      continue
    }

    groupedByDay.set(toDayKey(item.timestamp), toSafeNumber(item.total))
  }

  if (groupedByDay.size === 0) {
    return [{ name: 'Atual', value: toSafeNumber(currentTotalPatrimony) }]
  }

  return Array.from(groupedByDay.entries()).map(([name, value]) => ({
    name,
    value: toSafeNumber(value),
  }))
}

function buildDashboardInsights(decision: readonly Decision[]): string[] {
  const insights: string[] = []

  const strongBuy = decision.find((item) => item.action === 'COMPRAR_FORTE')
  const buy = decision.find((item) => item.action === 'COMPRAR')
  const reduce = decision.find((item) => item.action === 'REDUZIR')
  const avoid = decision.find((item) => item.action === 'EVITAR')

  if (strongBuy) {
    insights.push(`Forte oportunidade: ${strongBuy.ticker}`)
  } else if (buy) {
    insights.push(`Melhor compra: ${buy.ticker}`)
  }

  if (reduce) {
    insights.push(`Reduzir ${reduce.ticker}`)
  }

  if (avoid) {
    insights.push(`Evitar ${avoid.ticker}`)
  }

  return insights
}

function buildDashboardStatItems(
  performanceData: readonly DashboardMetricPoint[]
): StatItem[] {
  const valuesByName = new Map(
    performanceData.map((item) => [item.name.trim(), toSafeNumber(item.value)])
  )

  return [
    {
      label: PERFORMANCE_LABELS.invested,
      value: valuesByName.get(PERFORMANCE_LABELS.invested) ?? 0,
      type: 'currency',
    },
    {
      label: PERFORMANCE_LABELS.patrimony,
      value: valuesByName.get(PERFORMANCE_LABELS.patrimony) ?? 0,
      type: 'currency',
    },
    {
      label: PERFORMANCE_LABELS.profit,
      value: valuesByName.get(PERFORMANCE_LABELS.profit) ?? 0,
      type: 'currency',
    },
    {
      label: PERFORMANCE_LABELS.profitPct,
      value: valuesByName.get(PERFORMANCE_LABELS.profitPct) ?? 0,
      type: 'percentage',
    },
    {
      label: PERFORMANCE_LABELS.monthlyReturnPct,
      value: valuesByName.get(PERFORMANCE_LABELS.monthlyReturnPct) ?? 0,
      type: 'percentage',
    },
    {
      label: PERFORMANCE_LABELS.annualReturnPct,
      value: valuesByName.get(PERFORMANCE_LABELS.annualReturnPct) ?? 0,
      type: 'percentage',
    },
    {
      label: PERFORMANCE_LABELS.volatilityPct,
      value: valuesByName.get(PERFORMANCE_LABELS.volatilityPct) ?? 0,
      type: 'percentage',
    },
  ]
}

export function buildDashboardAssetCatalogMap(
  assets: readonly Asset[]
): DashboardAssetCatalogMap {
  return new Map(assets.map((asset) => [normalizeTicker(asset.ticker), asset]))
}

export function buildDashboardAggregation(
  portfolio: readonly DashboardSourcePosition[],
  assetCatalog: DashboardAssetCatalogMap
): DashboardAggregation {
  const aggregationPositions = toAggregationPortfolioPositions(
    portfolio,
    assetCatalog
  )

  const aggregation = aggregatePortfolio(aggregationPositions)

  const totalPatrimony = aggregationPositions.reduce(
    (sum, position) =>
      sum +
      toSafeNumber(position.quantity) *
        toSafeNumber(position.currentPrice ?? position.avgPrice),
    0
  )

  return {
    totalInvested: toSafeNumber(aggregation.totalInvested),
    totalPatrimony: toSafeNumber(totalPatrimony),
    distributionByType: aggregation.distributionByType,
    distributionByAsset: aggregation.distributionByAsset,
    concentrationData: aggregation.concentrationData.slice(0, 10),
  }
}

export function buildDashboardViewModel(
  params: BuildDashboardViewModelParams
): DashboardViewModelOutput {
  const {
    monthlyContribution,
    rankedCount,
    decision,
    patrimonyHistory,
    aggregation,
  } = params

  const totalInvested = toSafeNumber(aggregation.totalInvested)
  const totalPatrimony = toSafeNumber(aggregation.totalPatrimony)

  const metrics = buildPerformanceMetrics({
    totalInvested,
    totalPatrimony,
    patrimonyHistory,
  })

  const performanceData: DashboardMetricPoint[] = [
    { name: PERFORMANCE_LABELS.invested, value: toSafeNumber(metrics.invested) },
    { name: PERFORMANCE_LABELS.patrimony, value: toSafeNumber(metrics.patrimony) },
    { name: PERFORMANCE_LABELS.profit, value: toSafeNumber(metrics.profit) },
    { name: PERFORMANCE_LABELS.profitPct, value: toSafeNumber(metrics.profitPct) },
    {
      name: PERFORMANCE_LABELS.monthlyReturnPct,
      value: toSafeNumber(metrics.monthlyReturnPct),
    },
    {
      name: PERFORMANCE_LABELS.annualReturnPct,
      value: toSafeNumber(metrics.annualReturnPct),
    },
    {
      name: PERFORMANCE_LABELS.volatilityPct,
      value: toSafeNumber(metrics.volatilityPct),
    },
  ]

  return {
    totalInvested,
    monthlyContribution: toSafeNumber(monthlyContribution),
    rankedCount: toSafeNumber(rankedCount),
    totalPatrimony,
    distributionByType: aggregation.distributionByType,
    distributionByAsset: aggregation.distributionByAsset,
    concentrationData: aggregation.concentrationData,
    performanceData,
    evolutionData: buildEvolutionData(patrimonyHistory, totalPatrimony),
    insights: buildDashboardInsights(decision),
    statItems: buildDashboardStatItems(performanceData),
  }
}