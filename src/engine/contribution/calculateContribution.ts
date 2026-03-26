import type {
  ContributionSuggestion,
  RankedAsset,
  TagKey,
} from '../../domain/types';

type ContributionTag = TagKey;

type ContributionCandidate = RankedAsset & {
  normalizedScore: number;
  targetWeight: number;
};

type ScoredAsset = RankedAsset & {
  normalizedScore: number;
};

type AllocationState = {
  asset: ContributionCandidate;
  targetAmount: number;
  suggestedShares: number;
  suggestedAmount: number;
  remainder: number;
};

const MAX_POSITION_ALLOCATION_PCT = 20;
const MIN_ELIGIBLE_SCORE = 50;
const UNDERWEIGHT_THRESHOLD_PCT = 10;
const RELEVANT_POSITION_THRESHOLD_PCT = 15;

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const getCurrentAllocationPct = (asset: RankedAsset): number =>
  typeof asset.currentAllocationPct === 'number' &&
  Number.isFinite(asset.currentAllocationPct)
    ? asset.currentAllocationPct
    : 0;

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isEligibleAsset = (asset: RankedAsset): boolean => {
  if (!isFinitePositiveNumber(asset.price)) {
    return false;
  }

  if (
    typeof asset.score?.finalScore !== 'number' ||
    !Number.isFinite(asset.score.finalScore)
  ) {
    return false;
  }

  if (asset.score.finalScore < MIN_ELIGIBLE_SCORE) {
    return false;
  }

  if (getCurrentAllocationPct(asset) >= MAX_POSITION_ALLOCATION_PCT) {
    return false;
  }

  return true;
};

const normalizeScores = (assets: RankedAsset[]): ScoredAsset[] => {
  const totalScore = assets.reduce((sum, asset) => {
    const safeScore =
      typeof asset.score.finalScore === 'number' &&
      Number.isFinite(asset.score.finalScore)
        ? asset.score.finalScore
        : 0;

    return sum + safeScore;
  }, 0);

  return assets.map((asset) => ({
    ...asset,
    normalizedScore: totalScore > 0 ? asset.score.finalScore / totalScore : 0,
  }));
};

const calculateTargetWeights = (
  assets: ScoredAsset[]
): ContributionCandidate[] => {
  const totalNormalizedScore = assets.reduce(
    (sum, asset) => sum + asset.normalizedScore,
    0
  );

  return assets.map((asset) => ({
    ...asset,
    targetWeight:
      totalNormalizedScore > 0 ? asset.normalizedScore / totalNormalizedScore : 0,
  }));
};

const buildTags = (asset: RankedAsset): ContributionTag[] => {
  const tags: ContributionTag[] = [];
  const recommendation = normalizeText(asset.score?.recommendation);
  const confidence = normalizeText(asset.score?.confidence);

  if (recommendation.includes('forte compra')) {
    tags.push('strongBuy');
  }

  if (confidence.includes('alta')) {
    tags.push('highConfidence');
  }

  if (getCurrentAllocationPct(asset) < UNDERWEIGHT_THRESHOLD_PCT) {
    tags.push('underweight');
  }

  return tags;
};

const buildRationale = (asset: RankedAsset, tags: ContributionTag[]): string => {
  const parts: string[] = [];

  if (asset.score?.recommendation) {
    parts.push(asset.score.recommendation);
  }

  if (asset.score?.confidence) {
    parts.push(`confiança ${String(asset.score.confidence).toLowerCase()}`);
  }

  if (tags.includes('underweight')) {
    parts.push('posição abaixo da alocação desejada');
  }

  const allocationPct = getCurrentAllocationPct(asset);

  if (
    allocationPct >= RELEVANT_POSITION_THRESHOLD_PCT &&
    allocationPct < MAX_POSITION_ALLOCATION_PCT
  ) {
    parts.push('posição relevante, mas ainda elegível para aporte');
  }

  return parts.join(' · ');
};

const buildInitialAllocation = (
  assets: ContributionCandidate[],
  monthlyContribution: number
): AllocationState[] =>
  assets.map((asset) => {
    const targetAmount = monthlyContribution * asset.targetWeight;
    const suggestedShares = Math.floor(targetAmount / asset.price);
    const suggestedAmount = suggestedShares * asset.price;
    const remainder = targetAmount - suggestedAmount;

    return {
      asset,
      targetAmount,
      suggestedShares,
      suggestedAmount,
      remainder,
    };
  });

const distributeResidualBudget = (
  states: AllocationState[],
  monthlyContribution: number
): AllocationState[] => {
  const totalAllocated = states.reduce(
    (sum, state) => sum + state.suggestedAmount,
    0
  );

  let remainingBudget = monthlyContribution - totalAllocated;

  if (remainingBudget <= 0) {
    return states;
  }

  const sorted = [...states].sort((left, right) => {
    if (right.remainder !== left.remainder) {
      return right.remainder - left.remainder;
    }

    if (right.asset.targetWeight !== left.asset.targetWeight) {
      return right.asset.targetWeight - left.asset.targetWeight;
    }

    return left.asset.price - right.asset.price;
  });

  let allocatedInPass = true;

  while (allocatedInPass) {
    allocatedInPass = false;

    for (const state of sorted) {
      if (remainingBudget + 1e-9 < state.asset.price) {
        continue;
      }

      state.suggestedShares += 1;
      state.suggestedAmount += state.asset.price;
      remainingBudget -= state.asset.price;
      allocatedInPass = true;
    }
  }

  return states;
};

const buildSuggestions = (
  assets: ContributionCandidate[],
  monthlyContribution: number
): ContributionSuggestion[] => {
  const initialStates = buildInitialAllocation(assets, monthlyContribution);
  const allocatedStates = distributeResidualBudget(
    initialStates,
    monthlyContribution
  );

  return allocatedStates
    .filter((state) => state.suggestedShares > 0)
    .map((state) => {
      const tags = buildTags(state.asset);

      return {
        ticker: state.asset.ticker,
        suggestedAmount: Number(state.suggestedAmount.toFixed(2)),
        suggestedShares: state.suggestedShares,
        rationale: buildRationale(state.asset, tags),
        tags,
      } satisfies ContributionSuggestion;
    });
};

export const calculateContribution = (
  ranking: RankedAsset[],
  monthlyContribution: number
): ContributionSuggestion[] => {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return [];
  }

  if (!isFinitePositiveNumber(monthlyContribution)) {
    return [];
  }

  const eligibleAssets = ranking.filter(isEligibleAsset);

  if (eligibleAssets.length === 0) {
    return [];
  }

  const normalizedAssets = normalizeScores(eligibleAssets);
  const weightedAssets = calculateTargetWeights(normalizedAssets);

  return buildSuggestions(weightedAssets, monthlyContribution);
};