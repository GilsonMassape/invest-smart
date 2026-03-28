import type {
  Asset,
  PortfolioPosition,
  Preferences,
  RankedAsset,
  ScoreBreakdown,
} from '../../domain/types';
import { enrichAssetWithScore } from '../score/getAssetScore';
import { safeDivide } from '../../utils/number';
import { normalizeRanking } from './normalizeRanking';

interface PortfolioContext {
  positionsByTicker: Map<string, PortfolioPosition>;
  totalPortfolioMarketValue: number;
}

interface RankedAssetSnapshot {
  ownedQuantity: number;
  currentMarketValue: number;
  currentAllocationPct: number;
}

type RankedAssetWithPercentile = RankedAsset & {
  percentile: number;
};

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const buildPositionsMap = (
  positions: PortfolioPosition[],
): Map<string, PortfolioPosition> => {
  const positionsByTicker = new Map<string, PortfolioPosition>();

  for (const position of positions) {
    if (!position?.ticker) continue;
    positionsByTicker.set(position.ticker, position);
  }

  return positionsByTicker;
};

const calculatePositionMarketValue = (
  asset: Asset,
  position?: PortfolioPosition,
): number => {
  if (!position) return 0;
  if (!isPositiveNumber(position.quantity)) return 0;
  if (!isPositiveNumber(asset.price)) return 0;

  return position.quantity * asset.price;
};

const calculateTotalPortfolioMarketValue = (
  assets: Asset[],
  positionsByTicker: Map<string, PortfolioPosition>,
): number => {
  let totalPortfolioMarketValue = 0;

  for (const asset of assets) {
    const position = positionsByTicker.get(asset.ticker);
    totalPortfolioMarketValue += calculatePositionMarketValue(asset, position);
  }

  return totalPortfolioMarketValue;
};

const buildPortfolioContext = (
  assets: Asset[],
  positions: PortfolioPosition[],
): PortfolioContext => {
  const positionsByTicker = buildPositionsMap(positions);

  return {
    positionsByTicker,
    totalPortfolioMarketValue: calculateTotalPortfolioMarketValue(
      assets,
      positionsByTicker,
    ),
  };
};

const getOwnedQuantity = (position?: PortfolioPosition): number => {
  if (!position) return 0;
  return isPositiveNumber(position.quantity) ? position.quantity : 0;
};

const getCurrentAllocationPct = (
  currentMarketValue: number,
  totalPortfolioMarketValue: number,
): number => safeDivide(currentMarketValue * 100, totalPortfolioMarketValue);

const buildRankedAssetSnapshot = (
  asset: Asset,
  position: PortfolioPosition | undefined,
  totalPortfolioMarketValue: number,
): RankedAssetSnapshot => {
  const ownedQuantity = getOwnedQuantity(position);
  const currentMarketValue = calculatePositionMarketValue(asset, position);
  const currentAllocationPct = getCurrentAllocationPct(
    currentMarketValue,
    totalPortfolioMarketValue,
  );

  return {
    ownedQuantity,
    currentMarketValue,
    currentAllocationPct,
  };
};

const normalizeBreakdownMetric = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const buildExplainabilityBreakdown = (
  score: ScoreBreakdown,
): NonNullable<ScoreBreakdown['breakdown']> => ({
  macro: normalizeBreakdownMetric(
    score.breakdown?.macro ?? score.macroAdjustment,
  ),
  profile: normalizeBreakdownMetric(
    score.breakdown?.profile ?? score.preferenceBonus,
  ),
  concentration: normalizeBreakdownMetric(
    score.breakdown?.concentration ?? Math.abs(score.concentrationPenalty),
  ),
});

const buildFallbackRationale = (
  asset: Asset,
  score: ScoreBreakdown,
  currentAllocationPct: number,
): string[] => {
  const rationale: string[] = [];

  if (score.recommendation?.trim()) {
    rationale.push(score.recommendation);
  }

  if (asset.type) {
    rationale.push(`Tipo: ${asset.type}`);
  }

  if (asset.sector) {
    rationale.push(`Setor: ${asset.sector}`);
  }

  rationale.push(
    currentAllocationPct > 0
      ? 'Ativo já presente na carteira'
      : 'Sem posição atual',
  );

  return rationale;
};

const buildExplainabilityRationale = (
  asset: Asset,
  score: ScoreBreakdown,
  currentAllocationPct: number,
): string[] => {
  if (Array.isArray(score.rationale) && score.rationale.length > 0) {
    return score.rationale;
  }

  if (Array.isArray(score.reasons) && score.reasons.length > 0) {
    return score.reasons;
  }

  return buildFallbackRationale(asset, score, currentAllocationPct);
};

const normalizeScoreExplainability = (
  asset: Asset,
  score: ScoreBreakdown,
  currentAllocationPct: number,
): ScoreBreakdown => ({
  ...score,
  breakdown: buildExplainabilityBreakdown(score),
  rationale: buildExplainabilityRationale(asset, score, currentAllocationPct),
});

const buildRankedAsset = (
  asset: Asset,
  preferences: Preferences,
  position: PortfolioPosition | undefined,
  totalPortfolioMarketValue: number,
): RankedAsset => {
  const snapshot = buildRankedAssetSnapshot(
    asset,
    position,
    totalPortfolioMarketValue,
  );

  const scoredAsset = enrichAssetWithScore(
    asset,
    preferences,
    snapshot.currentAllocationPct,
    snapshot.currentMarketValue,
    snapshot.ownedQuantity,
  );

  return {
    ...asset,
    score: normalizeScoreExplainability(
      asset,
      scoredAsset.score,
      snapshot.currentAllocationPct,
    ),
    ownedQuantity: snapshot.ownedQuantity,
    currentMarketValue: snapshot.currentMarketValue,
    currentAllocationPct: snapshot.currentAllocationPct,
  };
};

const sortByFinalScoreDesc = (
  left: RankedAssetWithPercentile,
  right: RankedAssetWithPercentile,
): number => right.score.finalScore - left.score.finalScore;

export const buildRanking = (
  assets: Asset[],
  positions: PortfolioPosition[],
  preferences: Preferences,
): RankedAssetWithPercentile[] => {
  if (!Array.isArray(assets) || assets.length === 0) {
    return [];
  }

  const safePositions = Array.isArray(positions) ? positions : [];
  const portfolioContext = buildPortfolioContext(assets, safePositions);

  const rankedAssets = assets.map((asset) =>
    buildRankedAsset(
      asset,
      preferences,
      portfolioContext.positionsByTicker.get(asset.ticker),
      portfolioContext.totalPortfolioMarketValue,
    ),
  );

  const normalized = normalizeRanking(
    rankedAssets.map((asset) => asset.score.finalScore),
  );

  const rankedWithPercentile = rankedAssets.map((asset, index) => ({
    ...asset,
    percentile: normalized[index]?.percentile ?? 0,
  }));

  return rankedWithPercentile.sort(sortByFinalScoreDesc);
};