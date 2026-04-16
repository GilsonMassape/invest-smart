import type { RankedAsset, RebalanceSuggestion } from '../../domain/types'

const UPPER_CONCENTRATION_THRESHOLD_PCT = 20
const LOWER_CONCENTRATION_THRESHOLD_PCT = 5
const REDUCE_TARGET_PCT = 15
const BUY_TARGET_PCT = 10

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveTargetPct(currentPct: number): number {
  if (currentPct > UPPER_CONCENTRATION_THRESHOLD_PCT) {
    return REDUCE_TARGET_PCT
  }

  if (currentPct < LOWER_CONCENTRATION_THRESHOLD_PCT) {
    return BUY_TARGET_PCT
  }

  return currentPct
}

function resolveAction(currentPct: number): RebalanceSuggestion['action'] {
  if (currentPct > UPPER_CONCENTRATION_THRESHOLD_PCT) {
    return 'REDUZIR'
  }

  if (currentPct < LOWER_CONCENTRATION_THRESHOLD_PCT) {
    return 'COMPRAR'
  }

  return 'MANTER'
}

function resolveTargetValue(
  currentValue: number,
  currentPct: number,
  targetPct: number
): number {
  if (currentPct <= 0) {
    return currentValue
  }

  return currentValue * (targetPct / currentPct)
}

function sortRebalanceSuggestions(
  left: RebalanceSuggestion,
  right: RebalanceSuggestion
): number {
  const actionPriority = (action: RebalanceSuggestion['action']): number => {
    switch (action) {
      case 'REDUZIR':
        return 0
      case 'COMPRAR':
        return 1
      default:
        return 2
    }
  }

  const actionDiff = actionPriority(left.action) - actionPriority(right.action)

  if (actionDiff !== 0) {
    return actionDiff
  }

  const leftMagnitude = Math.abs(toSafeNumber(left.deltaValue ?? left.diffValue))
  const rightMagnitude = Math.abs(toSafeNumber(right.deltaValue ?? right.diffValue))

  if (rightMagnitude !== leftMagnitude) {
    return rightMagnitude - leftMagnitude
  }

  return left.ticker.localeCompare(right.ticker, 'pt-BR')
}

export function buildRebalance(
  ranking: readonly RankedAsset[]
): RebalanceSuggestion[] {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return []
  }

  const suggestions = ranking.map((asset): RebalanceSuggestion => {
    const currentPct = toSafeNumber(asset.currentAllocationPct)
    const currentValue = toSafeNumber(asset.currentMarketValue)
    const targetPct = resolveTargetPct(currentPct)
    const targetValue = resolveTargetValue(currentValue, currentPct, targetPct)
    const deltaValue = targetValue - currentValue

    return {
      ticker: asset.ticker,
      action: resolveAction(currentPct),
      currentValue,
      currentPct,
      targetValue,
      targetPct,
      diffValue: deltaValue,
      deltaValue,
    }
  })

  return suggestions.sort(sortRebalanceSuggestions)
}