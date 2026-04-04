import type { PatrimonyHistory } from '../../domain/history'

export type PerformanceMetrics = Readonly<{
  invested: number
  patrimony: number
  profit: number
  profitPct: number
  monthlyReturnPct: number
  annualReturnPct: number
  volatilityPct: number
}>

export type BuildPerformanceMetricsParams = Readonly<{
  totalInvested: number
  totalPatrimony: number
  patrimonyHistory: PatrimonyHistory
}>

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator !== 0 ? numerator / denominator : 0
}

function calculateProfit(totalInvested: number, totalPatrimony: number): number {
  return totalPatrimony - totalInvested
}

function calculateProfitPct(
  totalInvested: number,
  profit: number
): number {
  return safeDivide(profit * 100, totalInvested)
}

function buildOrderedHistory(history: PatrimonyHistory): number[] {
  if (!Array.isArray(history) || history.length === 0) {
    return []
  }

  return history
    .filter(
      (item) =>
        item &&
        Number.isFinite(item.timestamp) &&
        Number.isFinite(item.total)
    )
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((item) => toSafeNumber(item.total))
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

function calculateMonthlyReturnPct(
  historyValues: number[],
  fallbackProfitPct: number
): number {
  if (historyValues.length < 2) {
    return fallbackProfitPct / 12
  }

  const lastValue = historyValues[historyValues.length - 1]
  const comparisonIndex = Math.max(0, historyValues.length - 22)
  const baseValue = historyValues[comparisonIndex]

  if (baseValue <= 0) {
    return 0
  }

  return ((lastValue - baseValue) / baseValue) * 100
}

function calculateAnnualReturnPct(
  historyValues: number[],
  fallbackProfitPct: number
): number {
  if (historyValues.length < 2) {
    return fallbackProfitPct
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

export function buildPerformanceMetrics(
  params: BuildPerformanceMetricsParams
): PerformanceMetrics {
  const totalInvested = toSafeNumber(params.totalInvested)
  const totalPatrimony = toSafeNumber(params.totalPatrimony)

  const profit = calculateProfit(totalInvested, totalPatrimony)
  const profitPct = calculateProfitPct(totalInvested, profit)

  const historyValues = buildOrderedHistory(params.patrimonyHistory)

  const monthlyReturnPct = calculateMonthlyReturnPct(
    historyValues,
    profitPct
  )

  const annualReturnPct = calculateAnnualReturnPct(
    historyValues,
    profitPct
  )

  const volatilityPct = calculateVolatilityPct(historyValues)

  return {
    invested: totalInvested,
    patrimony: totalPatrimony,
    profit,
    profitPct,
    monthlyReturnPct,
    annualReturnPct,
    volatilityPct,
  }
}