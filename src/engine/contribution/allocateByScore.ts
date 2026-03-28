import type {
  ContributionSuggestion,
  RankedAsset,
  TagKey,
} from '../../domain/types';

interface AllocationOptions {
  totalAmount: number;
  maxPerAssetPct?: number;
}

type AllocationCandidate = {
  asset: RankedAsset;
  scoreFactor: number;
  percentileFactor: number;
  strength: number;
};

const DEFAULT_MAX_PER_ASSET_PCT = 0.35;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const getPercentile = (asset: RankedAsset): number =>
  typeof asset.percentile === 'number' && Number.isFinite(asset.percentile)
    ? asset.percentile
    : 50;

const buildAllocationCandidates = (
  assets: RankedAsset[],
): AllocationCandidate[] =>
  assets.map((asset) => {
    const scoreFactor = clamp(asset.score.finalScore / 100, 0, 1);
    const percentileFactor = clamp(getPercentile(asset) / 100, 0, 1);
    const strength = scoreFactor * 0.6 + percentileFactor * 0.4;

    return {
      asset,
      scoreFactor,
      percentileFactor,
      strength,
    };
  });

const buildTags = (asset: RankedAsset): TagKey[] => {
  const tags: TagKey[] = [];
  const percentile = getPercentile(asset);

  if (percentile >= 90) {
    tags.push('strongBuy');
  }

  if (asset.score.finalScore >= 80) {
    tags.push('highConfidence');
  }

  if (asset.currentAllocationPct < 5) {
    tags.push('underweight');
  }

  return tags;
};

const buildRationale = (asset: RankedAsset): string => {
  if ((asset.percentile ?? 0) >= 85) {
    return 'Alta prioridade no ranking relativo';
  }

  if (asset.currentAllocationPct < 5) {
    return 'Baixa exposição atual na carteira';
  }

  return 'Alocação otimizada por score e percentil';
};

export const allocateByScore = (
  assets: RankedAsset[],
  options: AllocationOptions,
): ContributionSuggestion[] => {
  const { totalAmount, maxPerAssetPct = DEFAULT_MAX_PER_ASSET_PCT } = options;

  if (!Array.isArray(assets) || assets.length === 0) {
    return [];
  }

  if (!isFinitePositiveNumber(totalAmount)) {
    return [];
  }

  const candidates = buildAllocationCandidates(assets);
  const totalStrength = candidates.reduce(
    (sum, candidate) => sum + candidate.strength,
    0,
  );

  if (totalStrength <= 0) {
    return [];
  }

  const suggestions = candidates.map((candidate) => {
    const rawPct = candidate.strength / totalStrength;
    const cappedPct = clamp(rawPct, 0, maxPerAssetPct);
    const rawAmount = totalAmount * cappedPct;
    const suggestedShares = Math.floor(rawAmount / candidate.asset.price);
    const suggestedAmount = Number(
      (suggestedShares * candidate.asset.price).toFixed(2),
    );

    return {
      ticker: candidate.asset.ticker,
      suggestedAmount,
      suggestedShares,
      rationale: buildRationale(candidate.asset),
      tags: buildTags(candidate.asset),
    } satisfies ContributionSuggestion;
  });

  const allocatedAmount = suggestions.reduce(
    (sum, suggestion) => sum + suggestion.suggestedAmount,
    0,
  );

  const residual = Number((totalAmount - allocatedAmount).toFixed(2));

  if (residual > 0 && suggestions.length > 0) {
    suggestions[0].suggestedAmount = Number(
      (suggestions[0].suggestedAmount + residual).toFixed(2),
    );
  }

  return suggestions
    .filter((suggestion) => suggestion.suggestedAmount > 0)
    .sort((left, right) => right.suggestedAmount - left.suggestedAmount);
};