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
  benchmarkValue?: number
}>

export type DashboardInsight = Readonly<{
  id: string
  ticker: string
  title: string
  summary: string
  reason: string
  action: Decision['action']
  confidence?: Decision['confidence']
  tone: 'positive' | 'warning' | 'negative'
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
  insights: DashboardInsight[]
  statItems: StatItem[]
}>

type SafePatrimonySnapshot = Readonly<{
  timestamp: number
  total: number
}>

type GroupedHistoryPoint = SafePatrimonySnapshot &
  Readonly<{
    dayTimestamp: number
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

const EVOLUTION_MAX_POINTS = 12
const BENCHMARK_DAILY_RETURN_PCT = 0.04
const DAY_IN_MS = 86400000
const MAX_DASHBOARD_INSIGHTS = 4

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function formatEvolutionLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function isValidPatrimonySnapshot(
  value: unknown
): value is SafePatrimonySnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SafePatrimonySnapshot>

  return (
    typeof candidate.timestamp === 'number' &&
    Number.isFinite(candidate.timestamp) &&
    typeof candidate.total === 'number' &&
    Number.isFinite(candidate.total)
  )
}

function getDayTimestamp(timestamp: number): number {
  const date = new Date(timestamp)

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime()
}

function calculateElapsedDays(fromTimestamp: number, toTimestamp: number): number {
  if (!Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp)) {
    return 0
  }

  return Math.max(
    0,
    Math.round((getDayTimestamp(toTimestamp) - getDayTimestamp(fromTimestamp)) / DAY_IN_MS)
  )
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

function groupHistoryByDay(history: PatrimonyHistory): GroupedHistoryPoint[] {
  const safeHistory = Array.isArray(history) ? history : []
  const groupedByDay = new Map<number, SafePatrimonySnapshot>()

  for (const item of safeHistory) {
    if (!isValidPatrimonySnapshot(item)) {
      continue
    }

    const dayTimestamp = getDayTimestamp(item.timestamp)

    groupedByDay.set(dayTimestamp, {
      timestamp: item.timestamp,
      total: toSafeNumber(item.total),
    })
  }

  return Array.from(groupedByDay.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([dayTimestamp, snapshot]) => ({
      ...snapshot,
      dayTimestamp,
    }))
}

function compressEvolutionPoints(
  points: readonly DashboardMetricPoint[],
  maxPoints: number
): DashboardMetricPoint[] {
  if (points.length <= maxPoints) {
    return [...points]
  }

  const selectedIndexes = new Set<number>([0, points.length - 1])
  const intervals = maxPoints - 1

  for (let step = 1; step < intervals; step += 1) {
    const index = Math.round((step * (points.length - 1)) / intervals)
    selectedIndexes.add(index)
  }

  return Array.from(selectedIndexes)
    .sort((left, right) => left - right)
    .map((index) => points[index])
}

function calculateBenchmarkValue(
  baseValue: number,
  elapsedDays: number
): number | undefined {
  if (baseValue <= 0 || elapsedDays < 0) {
    return undefined
  }

  const dailyRate = BENCHMARK_DAILY_RETURN_PCT / 100

  return baseValue * Math.pow(1 + dailyRate, elapsedDays)
}

function buildCurrentEvolutionPoint(params: {
  currentTotalPatrimony: number
  benchmarkBaseValue: number
  firstHistoryTimestamp: number
}): DashboardMetricPoint {
  const { currentTotalPatrimony, benchmarkBaseValue, firstHistoryTimestamp } = params
  const now = Date.now()

  return {
    name: 'Atual',
    value: toSafeNumber(currentTotalPatrimony),
    benchmarkValue: calculateBenchmarkValue(
      benchmarkBaseValue,
      calculateElapsedDays(firstHistoryTimestamp, now)
    ),
  }
}

function buildEvolutionData(
  history: PatrimonyHistory,
  currentTotalPatrimony: number
): DashboardMetricPoint[] {
  const groupedHistory = groupHistoryByDay(history)
  const safeCurrentTotalPatrimony = toSafeNumber(currentTotalPatrimony)

  if (groupedHistory.length === 0) {
    return [
      {
        name: 'Atual',
        value: safeCurrentTotalPatrimony,
        benchmarkValue:
          safeCurrentTotalPatrimony > 0 ? safeCurrentTotalPatrimony : undefined,
      },
    ]
  }

  const firstHistoryPoint = groupedHistory[0]
  const benchmarkBaseValue = toSafeNumber(firstHistoryPoint.total)

  const historicalPoints: DashboardMetricPoint[] = groupedHistory.map((item) => ({
    name: formatEvolutionLabel(new Date(item.dayTimestamp)),
    value: toSafeNumber(item.total),
    benchmarkValue: calculateBenchmarkValue(
      benchmarkBaseValue,
      calculateElapsedDays(firstHistoryPoint.dayTimestamp, item.dayTimestamp)
    ),
  }))

  const lastHistoricalPoint = historicalPoints[historicalPoints.length - 1]
  const shouldAppendCurrentPoint =
    lastHistoricalPoint.value !== safeCurrentTotalPatrimony

  const points = shouldAppendCurrentPoint
    ? [
        ...historicalPoints,
        buildCurrentEvolutionPoint({
          currentTotalPatrimony: safeCurrentTotalPatrimony,
          benchmarkBaseValue,
          firstHistoryTimestamp: firstHistoryPoint.dayTimestamp,
        }),
      ]
    : historicalPoints

  return compressEvolutionPoints(points, EVOLUTION_MAX_POINTS)
}

function buildInsightSummary(decision: Decision): string {
  const ticker = normalizeTicker(decision.ticker)

  switch (decision.action) {
    case 'COMPRAR_FORTE':
      return `${ticker} aparece como prioridade máxima de aporte no cenário atual.`
    case 'COMPRAR':
      return `${ticker} surge como oportunidade de compra para ampliar posição.`
    case 'REDUZIR':
      return `${ticker} pede redução para diminuir concentração ou risco.`
    case 'EVITAR':
      return `${ticker} não é prioridade para novos aportes neste momento.`
    default:
      return `${ticker} exige atenção no contexto atual da carteira.`
  }
}

function buildInsightTitle(decision: Decision): string {
  const ticker = normalizeTicker(decision.ticker)

  switch (decision.action) {
    case 'COMPRAR_FORTE':
      return `Compra forte em ${ticker}`
    case 'COMPRAR':
      return `Compra em ${ticker}`
    case 'REDUZIR':
      return `Reduzir ${ticker}`
    case 'EVITAR':
      return `Evitar ${ticker}`
    default:
      return ticker
  }
}

function buildInsightReason(decision: Decision): string {
  const explicitReason = toSafeString(decision.reason)

  if (explicitReason) {
    return explicitReason
  }

  const ticker = normalizeTicker(decision.ticker)
  const confidence = toSafeString(decision.confidence)

  switch (decision.action) {
    case 'COMPRAR_FORTE':
      return `${ticker} combina bom posicionamento relativo na carteira com sinal forte do motor decisório.${confidence ? ` Confiança: ${confidence}.` : ''}`
    case 'COMPRAR':
      return `${ticker} apresenta sinal positivo para aporte adicional, respeitando perfil e cenário atual.${confidence ? ` Confiança: ${confidence}.` : ''}`
    case 'REDUZIR':
      return `${ticker} merece ajuste de peso para reduzir desequilíbrio ou concentração excessiva.${confidence ? ` Confiança: ${confidence}.` : ''}`
    case 'EVITAR':
      return `${ticker} não oferece assimetria favorável para novo aporte agora.${confidence ? ` Confiança: ${confidence}.` : ''}`
    default:
      return `${ticker} foi destacado pelo motor decisório da carteira.`
  }
}

function buildInsightTone(
  action: Decision['action']
): DashboardInsight['tone'] {
  switch (action) {
    case 'COMPRAR_FORTE':
    case 'COMPRAR':
      return 'positive'
    case 'REDUZIR':
      return 'warning'
    case 'EVITAR':
      return 'negative'
    default:
      return 'warning'
  }
}

function buildDashboardInsights(
  decisions: readonly Decision[]
): DashboardInsight[] {
  if (!Array.isArray(decisions)) {
    return []
  }

  const priorityOrder: Record<string, number> = {
    COMPRAR_FORTE: 1,
    COMPRAR: 2,
    REDUZIR: 3,
    EVITAR: 4,
  }

  return decisions
    .filter(
      (decision) =>
        decision &&
        typeof decision.ticker === 'string' &&
        decision.ticker.trim().length > 0 &&
        typeof decision.action === 'string'
    )
    .map((decision) => {
      const ticker = normalizeTicker(decision.ticker)

      return {
        id: `${decision.action}:${ticker}`,
        ticker,
        title: buildInsightTitle(decision),
        summary: buildInsightSummary(decision),
        reason: buildInsightReason(decision),
        action: decision.action,
        confidence: decision.confidence,
        tone: buildInsightTone(decision.action),
      } satisfies DashboardInsight
    })
    .sort((left, right) => {
      const leftPriority = priorityOrder[left.action] ?? 99
      const rightPriority = priorityOrder[right.action] ?? 99

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return left.ticker.localeCompare(right.ticker, 'pt-BR')
    })
    .slice(0, MAX_DASHBOARD_INSIGHTS)
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

  return {
    totalInvested: toSafeNumber(aggregation.totalInvested),
    totalPatrimony: toSafeNumber(aggregation.totalPatrimony),
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
    {
      name: PERFORMANCE_LABELS.patrimony,
      value: toSafeNumber(metrics.patrimony),
    },
    { name: PERFORMANCE_LABELS.profit, value: toSafeNumber(metrics.profit) },
    {
      name: PERFORMANCE_LABELS.profitPct,
      value: toSafeNumber(metrics.profitPct),
    },
    {
      name: PERFORMANCE_LABELS.monthlyReturnPct,
      value: toSafeNumber(metrics.monthlyReturnPct),
      benchmarkValue: toSafeNumber(metrics.benchmarkMonthlyReturnPct),
    },
    {
      name: PERFORMANCE_LABELS.annualReturnPct,
      value: toSafeNumber(metrics.annualReturnPct),
      benchmarkValue: toSafeNumber(metrics.benchmarkAnnualReturnPct),
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