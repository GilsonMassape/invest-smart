import type { PatrimonyHistory } from '../../domain/history'

type SafePatrimonySnapshot = Readonly<{
  timestamp: number
  total: number
}>

export type PerformanceMetrics = Readonly<{
  invested: number
  patrimony: number
  profit: number
  profitPct: number
  monthlyReturnPct: number
  annualReturnPct: number
  volatilityPct: number
  benchmarkMonthlyReturnPct: number
  benchmarkAnnualReturnPct: number
  alphaMonthlyPct: number
  alphaAnnualPct: number
}>

export type BuildPerformanceMetricsParams = Readonly<{
  totalInvested: number
  totalPatrimony: number
  patrimonyHistory: PatrimonyHistory
}>

const APPROX_TRADING_DAYS_PER_MONTH = 21
const APPROX_TRADING_DAYS_PER_YEAR = 252
const BENCHMARK_DAILY_RETURN_PCT = 0.04

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator !== 0 ? numerator / denominator : 0
}

function isValidSnapshot(value: unknown): value is SafePatrimonySnapshot {
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

function calculateProfit(totalInvested: number, totalPatrimony: number): number {
  return totalPatrimony - totalInvested
}

function calculateProfitPct(totalInvested: number, profit: number): number {
  return safeDivide(profit * 100, totalInvested)
}

function normalizeHistory(history: PatrimonyHistory): SafePatrimonySnapshot[] {
  if (!Array.isArray(history) || history.length === 0) {
    return []
  }

  return history
    .filter(isValidSnapshot)
    .map((item) => ({
      timestamp: toSafeNumber(item.timestamp),
      total: toSafeNumber(item.total),
    }))
    .sort((left, right) => left.timestamp - right.timestamp)
}

function buildOrderedHistoryValues(history: PatrimonyHistory): number[] {
  return normalizeHistory(history).map((item) => item.total)
}

function buildReturnsSeries(values: number[]): number[] {
  if (values.length < 2) {
    return []
  }

  const returns: number[] = []

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1]
    const current = values[index]

    if (previous <= 0) {
      continue
    }

    returns.push(((current - previous) / previous) * 100)
  }

  return returns
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0
  }

  const average = calculateAverage(values)
  const variance =
    values.reduce((sum, value) => {
      const diff = value - average
      return sum + diff * diff
    }, 0) / values.length

  return Math.sqrt(variance)
}

function calculateWindowReturnPct(
  historyValues: number[],
  approxPeriods: number,
  fallbackValue: number
): number {
  if (historyValues.length < 2) {
    return fallbackValue
  }

  const lastValue = historyValues[historyValues.length - 1]
  const comparisonIndex = Math.max(0, historyValues.length - 1 - approxPeriods)
  const baseValue = historyValues[comparisonIndex]

  if (baseValue <= 0) {
    return 0
  }

  return ((lastValue - baseValue) / baseValue) * 100
}

function calculateSinceStartReturnPct(
  historyValues: number[],
  fallbackValue: number
): number {
  if (historyValues.length < 2) {
    return fallbackValue
  }

  const firstValue = historyValues[0]
  const lastValue = historyValues[historyValues.length - 1]

  if (firstValue <= 0) {
    return 0
  }

  return ((lastValue - firstValue) / firstValue) * 100
}

function calculateVolatilityPct(historyValues: number[]): number {
  const returnsSeries = buildReturnsSeries(historyValues)
  return calculateStandardDeviation(returnsSeries)
}

function calculateCompoundedBenchmarkReturnPct(periods: number): number {
  if (periods <= 0) {
    return 0
  }

  const dailyRate = BENCHMARK_DAILY_RETURN_PCT / 100
  return (Math.pow(1 + dailyRate, periods) - 1) * 100
}

function calculateBenchmarkMonthlyReturnPct(historyValues: number[]): number {
  if (historyValues.length < 2) {
    return calculateCompoundedBenchmarkReturnPct(APPROX_TRADING_DAYS_PER_MONTH)
  }

  const periods = Math.min(
    APPROX_TRADING_DAYS_PER_MONTH,
    Math.max(1, historyValues.length - 1)
  )

  return calculateCompoundedBenchmarkReturnPct(periods)
}

function calculateBenchmarkAnnualReturnPct(historyValues: number[]): number {
  if (historyValues.length < 2) {
    return calculateCompoundedBenchmarkReturnPct(
      APPROX_TRADING_DAYS_PER_YEAR
    )
  }

  const periods = Math.min(
    APPROX_TRADING_DAYS_PER_YEAR,
    Math.max(1, historyValues.length - 1)
  )

  return calculateCompoundedBenchmarkReturnPct(periods)
}

export function buildPerformanceMetrics(
  params: BuildPerformanceMetricsParams
): PerformanceMetrics {
  const totalInvested = toSafeNumber(params.totalInvested)
  const totalPatrimony = toSafeNumber(params.totalPatrimony)

  const profit = calculateProfit(totalInvested, totalPatrimony)
  const profitPct = calculateProfitPct(totalInvested, profit)

  const historyValues = buildOrderedHistoryValues(params.patrimonyHistory)

  const monthlyReturnPct = calculateWindowReturnPct(
    historyValues,
    APPROX_TRADING_DAYS_PER_MONTH,
    profitPct / 12
  )

  const annualReturnPct = calculateSinceStartReturnPct(historyValues, profitPct)

  const volatilityPct = calculateVolatilityPct(historyValues)

  const benchmarkMonthlyReturnPct =
    calculateBenchmarkMonthlyReturnPct(historyValues)

  const benchmarkAnnualReturnPct =
    calculateBenchmarkAnnualReturnPct(historyValues)

  const alphaMonthlyPct = monthlyReturnPct - benchmarkMonthlyReturnPct
  const alphaAnnualPct = annualReturnPct - benchmarkAnnualReturnPct

  return {
    invested: totalInvested,
    patrimony: totalPatrimony,
    profit,
    profitPct,
    monthlyReturnPct,
    annualReturnPct,
    volatilityPct,
    benchmarkMonthlyReturnPct,
    benchmarkAnnualReturnPct,
    alphaMonthlyPct,
    alphaAnnualPct,
  }
}