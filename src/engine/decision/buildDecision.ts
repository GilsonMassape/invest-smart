import type {
  Decision,
  DecisionAction,
  DecisionConfidence,
  RankedAsset,
} from '../../domain/types'

const HIGH_SCORE = 80
const GOOD_SCORE = 65
const LOW_SCORE = 50
const AVOID_SCORE = 40

const HIGH_PERCENTILE = 80
const GOOD_PERCENTILE = 60

const HIGH_CONCENTRATION_PCT = 20
const STRONG_BUY_MAX_ALLOCATION_PCT = 10

function toSafeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampPercentile(value: number | undefined): number {
  return toSafeNumber(value, 50)
}

function resolveConfidence(
  score: number,
  percentile: number
): DecisionConfidence {
  if (score >= HIGH_SCORE && percentile >= HIGH_PERCENTILE) {
    return 'ALTA'
  }

  if (score >= GOOD_SCORE && percentile >= GOOD_PERCENTILE) {
    return 'MÉDIA'
  }

  return 'BAIXA'
}

function resolveAction(asset: RankedAsset): DecisionAction {
  const score = toSafeNumber(asset.score?.finalScore)
  const percentile = clampPercentile(asset.percentile)
  const allocation = toSafeNumber(asset.currentAllocationPct)
  const recommendation = asset.score?.recommendation?.trim()

  if (score < AVOID_SCORE) {
    return 'EVITAR'
  }

  if (allocation > HIGH_CONCENTRATION_PCT || score < LOW_SCORE) {
    return 'REDUZIR'
  }

  if (
    score >= HIGH_SCORE &&
    percentile >= HIGH_PERCENTILE &&
    allocation < STRONG_BUY_MAX_ALLOCATION_PCT
  ) {
    return 'COMPRAR_FORTE'
  }

  if (score >= GOOD_SCORE && percentile >= GOOD_PERCENTILE) {
    return 'COMPRAR'
  }

  if (recommendation === 'COMPRAR') {
    return 'COMPRAR'
  }

  return 'REDUZIR'
}

function buildReason(asset: RankedAsset, action: DecisionAction): string {
  const score = toSafeNumber(asset.score?.finalScore).toFixed(1)
  const percentile = clampPercentile(asset.percentile).toFixed(1)
  const allocation = toSafeNumber(asset.currentAllocationPct).toFixed(1)
  const scoreReasons = Array.isArray(asset.score?.reasons)
    ? asset.score.reasons.filter(Boolean)
    : []

  switch (action) {
    case 'COMPRAR_FORTE':
      return scoreReasons.length > 0
        ? `Score ${score}, percentil ${percentile} e baixa alocação (${allocation}%). ${scoreReasons.join(' ')}`
        : `Score ${score}, percentil ${percentile} e baixa alocação (${allocation}%).`

    case 'COMPRAR':
      return scoreReasons.length > 0
        ? `Bom score (${score}) e boa força relativa (${percentile}). ${scoreReasons.join(' ')}`
        : `Bom score (${score}) e boa força relativa (${percentile}).`

    case 'REDUZIR':
      return scoreReasons.length > 0
        ? `Concentração/alocação elevada (${allocation}%) ou score fraco (${score}). ${scoreReasons.join(' ')}`
        : `Concentração/alocação elevada (${allocation}%) ou score fraco (${score}).`

    case 'EVITAR':
      return scoreReasons.length > 0
        ? `Score muito baixo (${score}) e baixa atratividade relativa. ${scoreReasons.join(' ')}`
        : `Score muito baixo (${score}) e baixa atratividade relativa.`

    default:
      return scoreReasons.length > 0
        ? `Ativo equilibrado no contexto atual. ${scoreReasons.join(' ')}`
        : 'Ativo equilibrado no contexto atual.'
  }
}

export const buildDecision = (ranking: readonly RankedAsset[]): Decision[] => {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return []
  }

  return ranking.map((asset) => {
    const percentile = clampPercentile(asset.percentile)
    const score = toSafeNumber(asset.score?.finalScore)
    const action = resolveAction(asset)
    const confidence = resolveConfidence(score, percentile)

    return {
      ticker: asset.ticker,
      action,
      confidence,
      reason: buildReason(asset, action),
    }
  })
}