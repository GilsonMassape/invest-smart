import type {
  ContributionSuggestion,
  RankedAsset,
  TagKey,
} from '../../domain/types'

const DEFAULT_SUGGESTED_AMOUNT = 100
const MAX_SUGGESTIONS = 5
const UNDERWEIGHT_THRESHOLD_PCT = 10

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getAllocationGap(currentAllocationPct: number): number {
  return Math.max(UNDERWEIGHT_THRESHOLD_PCT - currentAllocationPct, 0)
}

function buildContributionRationale(
  asset: RankedAsset,
  allocationGap: number
): string {
  const rationaleParts: string[] = []

  if (allocationGap > 0) {
    rationaleParts.push(
      `Subalocado em ${allocationGap.toFixed(2).replace('.', ',')} p.p.`
    )
  }

  if (asset.score?.recommendation?.trim()) {
    rationaleParts.push(asset.score.recommendation)
  }

  if (Array.isArray(asset.score?.rationale) && asset.score.rationale.length > 0) {
    rationaleParts.push(asset.score.rationale[0])
  } else if (Array.isArray(asset.score?.reasons) && asset.score.reasons.length > 0) {
    rationaleParts.push(asset.score.reasons[0])
  }

  return rationaleParts.join(' • ') || 'Ativo subalocado na carteira'
}

function buildContributionTags(
  asset: RankedAsset,
  allocationGap: number
): TagKey[] {
  const tags = new Set<TagKey>()

  if (allocationGap > 0) {
    tags.add('underweight')
  }

  if (asset.score?.confidence === 'ALTA') {
    tags.add('highConfidence')
  }

  if (toSafeNumber(asset.score?.finalScore) >= 65) {
    tags.add('strongBuy')
  }

  return Array.from(tags)
}

function sortContributionCandidates(
  left: RankedAsset,
  right: RankedAsset
): number {
  const rightScore = toSafeNumber(right.score?.finalScore)
  const leftScore = toSafeNumber(left.score?.finalScore)

  if (rightScore !== leftScore) {
    return rightScore - leftScore
  }

  const leftGap = getAllocationGap(toSafeNumber(left.currentAllocationPct))
  const rightGap = getAllocationGap(toSafeNumber(right.currentAllocationPct))

  if (rightGap !== leftGap) {
    return rightGap - leftGap
  }

  return left.ticker.localeCompare(right.ticker, 'pt-BR')
}

export function buildContribution(
  ranking: RankedAsset[]
): ContributionSuggestion[] {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return []
  }

  return ranking
    .filter(
      (asset) =>
        toSafeNumber(asset.currentAllocationPct) < UNDERWEIGHT_THRESHOLD_PCT
    )
    .sort(sortContributionCandidates)
    .slice(0, MAX_SUGGESTIONS)
    .map((asset): ContributionSuggestion => {
      const price = toSafeNumber(asset.price)
      const currentAllocationPct = toSafeNumber(asset.currentAllocationPct)
      const allocationGap = getAllocationGap(currentAllocationPct)
      const suggestedAmount = DEFAULT_SUGGESTED_AMOUNT

      return {
        ticker: asset.ticker,
        suggestedAmount,
        suggestedShares:
          price > 0 ? Math.floor(suggestedAmount / price) : undefined,
        rationale: buildContributionRationale(asset, allocationGap),
        tags: buildContributionTags(asset, allocationGap),
      }
    })
}