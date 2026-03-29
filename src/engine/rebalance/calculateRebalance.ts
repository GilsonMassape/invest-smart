import type { RankedAsset, RebalanceSuggestion } from '../../domain/types';

type EligibleAsset = RankedAsset & {
  safeCurrentValue: number;
  safeCurrentPct: number;
  safeWeight: number;
  safePercentile: number;
  targetStrength: number;
};

const MIN_POSITION_VALUE_DIFF = 50;
const MIN_POSITION_PCT_DIFF = 1;
const EPSILON = 1e-9;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const round2 = (value: number): number => Number(value.toFixed(2));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const getSafeOwnedQuantity = (asset: RankedAsset): number =>
  isFiniteNumber(asset.ownedQuantity) && asset.ownedQuantity > 0
    ? asset.ownedQuantity
    : 0;

const getSafeCurrentValue = (asset: RankedAsset): number =>
  isFiniteNumber(asset.currentMarketValue) && asset.currentMarketValue > 0
    ? asset.currentMarketValue
    : 0;

const getSafeCurrentPct = (asset: RankedAsset): number =>
  isFiniteNumber(asset.currentAllocationPct) && asset.currentAllocationPct >= 0
    ? asset.currentAllocationPct
    : 0;

const getSafeWeight = (asset: RankedAsset): number => {
  const rawWeight = asset.score?.weight;
  return isFiniteNumber(rawWeight) && rawWeight > 0 ? rawWeight : 0;
};

const getSafePercentile = (asset: RankedAsset): number => {
  const rawPercentile = asset.percentile;
  return isFiniteNumber(rawPercentile) ? clamp(rawPercentile, 0, 100) : 50;
};

const getTargetStrength = (asset: RankedAsset): number => {
  const weightFactor = getSafeWeight(asset);
  const scoreFactor =
    isFiniteNumber(asset.score?.finalScore) && asset.score.finalScore > 0
      ? clamp(asset.score.finalScore / 100, 0, 1)
      : 0;
  const percentileFactor = clamp(getSafePercentile(asset) / 100, 0, 1);

  return weightFactor * 0.5 + scoreFactor * 0.3 + percentileFactor * 0.2;
};

const isEligibleAsset = (asset: RankedAsset): asset is EligibleAsset => {
  const safeOwnedQuantity = getSafeOwnedQuantity(asset);
  const safeCurrentValue = getSafeCurrentValue(asset);
  const targetStrength = getTargetStrength(asset);

  if (safeOwnedQuantity <= 0) {
    return false;
  }

  if (safeCurrentValue <= 0) {
    return false;
  }

  if (targetStrength <= 0) {
    return false;
  }

  return true;
};

const buildEligibleAssets = (rankedAssets: RankedAsset[]): EligibleAsset[] =>
  rankedAssets
    .filter(isEligibleAsset)
    .map((asset) => ({
      ...asset,
      safeCurrentValue: getSafeCurrentValue(asset),
      safeCurrentPct: getSafeCurrentPct(asset),
      safeWeight: getSafeWeight(asset),
      safePercentile: getSafePercentile(asset),
      targetStrength: getTargetStrength(asset),
    }));

const resolveAction = (
  diffValue: number,
  diffPct: number,
): RebalanceSuggestion['action'] => {
  const absDiffValue = Math.abs(diffValue);
  const absDiffPct = Math.abs(diffPct);

  if (
    absDiffValue < MIN_POSITION_VALUE_DIFF &&
    absDiffPct < MIN_POSITION_PCT_DIFF
  ) {
    return 'MANTER';
  }

  if (diffValue > 0) {
    return 'COMPRAR';
  }

  if (diffValue < 0) {
    return 'REDUZIR';
  }

  return 'MANTER';
};

export const calculateRebalance = (
  rankedAssets: RankedAsset[],
): RebalanceSuggestion[] => {
  if (!Array.isArray(rankedAssets) || rankedAssets.length === 0) {
    return [];
  }

  const eligibleAssets = buildEligibleAssets(rankedAssets);

  if (eligibleAssets.length === 0) {
    return [];
  }

  const totalStrength = eligibleAssets.reduce(
    (sum, asset) => sum + asset.targetStrength,
    0,
  );

  const totalValue = eligibleAssets.reduce(
    (sum, asset) => sum + asset.safeCurrentValue,
    0,
  );

  if (totalStrength <= EPSILON || totalValue <= EPSILON) {
    return [];
  }

  return eligibleAssets
    .map((asset) => {
      const targetPct = (asset.targetStrength / totalStrength) * 100;
      const targetValue = (targetPct / 100) * totalValue;

      const diffValue = targetValue - asset.safeCurrentValue;
      const diffPct = targetPct - asset.safeCurrentPct;
      const action = resolveAction(diffValue, diffPct);

      return {
        ticker: asset.ticker,
        currentValue: round2(asset.safeCurrentValue),
        currentPct: round2(asset.safeCurrentPct),
        targetPct: round2(targetPct),
        diffValue: round2(diffValue),
        action,
      } satisfies RebalanceSuggestion;
    })
    .sort((a, b) => {
      const priority = (action: RebalanceSuggestion['action']) => {
        if (action === 'COMPRAR') return 0;
        if (action === 'REDUZIR') return 1;
        return 2;
      };

      const actionPriorityDiff = priority(a.action) - priority(b.action);
      if (actionPriorityDiff !== 0) {
        return actionPriorityDiff;
      }

      return Math.abs(b.diffValue) - Math.abs(a.diffValue);
    });
};