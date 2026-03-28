import type {
  Asset,
  Preferences,
  RankedAsset,
  ScoreBreakdown
} from '../../domain/types';
import { clamp } from '../../utils/number';
import { getRecommendationLabel } from '../../utils/labels';
import { getScoreWeight } from './getScoreWeight';

type Adjustment = {
  value: number;
  reason: string;
};

const BASE_SCORE_WEIGHTS = {
  quality: 0.35,
  growth: 0.25,
  resilience: 0.25,
  governance: 0.15
} as const;

const CONCENTRATION_POLICY = {
  warningThresholdPct: 18,
  penaltyPerExtraPct: 1.2,
  maxPenalty: 12
} as const;

const BLOCKED_TICKER_PENALTY = 100;

const normalizeText = (value: string | undefined | null): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isPreferredType = (asset: Asset, preferences: Preferences): boolean =>
  preferences.preferredTypes.includes(asset.type);

const isBlockedTicker = (asset: Asset, preferences: Preferences): boolean =>
  preferences.blockedTickers.includes(asset.ticker);

const calculateBaseScore = (asset: Asset): number =>
  asset.quality * BASE_SCORE_WEIGHTS.quality +
  asset.growth * BASE_SCORE_WEIGHTS.growth +
  asset.resilience * BASE_SCORE_WEIGHTS.resilience +
  asset.governance * BASE_SCORE_WEIGHTS.governance;

const getMacroAdjustment = (
  asset: Asset,
  macroScenario: Preferences['macroScenario']
): Adjustment => {
  const sector = normalizeText(asset.sector);

  switch (macroScenario) {
    case 'JUROS_ALTOS': {
      if (asset.type === 'FII') {
        return {
          value: -3,
          reason: 'FIIs tendem a sofrer mais em cenário de juros elevados.'
        };
      }

      if (sector.includes('bank')) {
        return {
          value: 4,
          reason: 'Bancos tendem a preservar rentabilidade com juros elevados.'
        };
      }

      return {
        value: 0,
        reason: 'Sem impacto macro relevante em cenário de juros altos.'
      };
    }

    case 'CRESCIMENTO': {
      if (asset.growth >= 85) {
        return {
          value: 4,
          reason: 'Ativo favorecido por cenário de expansão econômica.'
        };
      }

      return {
        value: 1,
        reason: 'Ativo com benefício moderado em ambiente de crescimento.'
      };
    }

    case 'INFLACAO': {
      if (sector.includes('energy') || asset.type === 'FII') {
        return {
          value: 2,
          reason: 'Ativo com alguma proteção em ambiente inflacionário.'
        };
      }

      return {
        value: -1,
        reason: 'Cenário inflacionário exige cautela adicional.'
      };
    }

    case 'NEUTRO':
    default:
      return {
        value: 0,
        reason: 'Cenário macro neutro.'
      };
  }
};

const getProfileAdjustment = (
  asset: Asset,
  preferences: Preferences
): Adjustment => {
  const preferredTypeBonus = isPreferredType(asset, preferences) ? 2 : -2;

  switch (preferences.riskProfile) {
    case 'CONSERVADOR':
      return {
        value: preferredTypeBonus + (asset.resilience >= 80 ? 4 : -5),
        reason: 'Perfil conservador prioriza resiliência e previsibilidade.'
      };

    case 'ARROJADO':
      return {
        value: preferredTypeBonus + (asset.growth >= 80 ? 4 : 0),
        reason: 'Perfil arrojado aceita mais volatilidade em troca de crescimento.'
      };

    case 'EQUILIBRADO':
    default:
      return {
        value: preferredTypeBonus + 1,
        reason: 'Perfil equilibrado busca qualidade com diversificação.'
      };
  }
};

const getBlockedTickerAdjustment = (
  asset: Asset,
  preferences: Preferences
): Adjustment => {
  if (!isBlockedTicker(asset, preferences)) {
    return {
      value: 0,
      reason: 'Ativo não bloqueado pelo usuário.'
    };
  }

  return {
    value: -BLOCKED_TICKER_PENALTY,
    reason: 'Ativo bloqueado nas preferências do usuário.'
  };
};

const getConcentrationPenalty = (currentAllocationPct: number): Adjustment => {
  if (!Number.isFinite(currentAllocationPct)) {
    return {
      value: 0,
      reason: 'Sem penalização de concentração.'
    };
  }

  if (currentAllocationPct <= CONCENTRATION_POLICY.warningThresholdPct) {
    return {
      value: 0,
      reason: 'Sem penalização de concentração.'
    };
  }

  const extraAllocation =
    currentAllocationPct - CONCENTRATION_POLICY.warningThresholdPct;

  const penalty = Math.min(
    extraAllocation * CONCENTRATION_POLICY.penaltyPerExtraPct,
    CONCENTRATION_POLICY.maxPenalty
  );

  return {
    value: penalty,
    reason: 'Penalização por concentração excessiva na carteira.'
  };
};

const getConfidence = (
  asset: Asset,
  finalScore: number
): ScoreBreakdown['confidence'] => {
  if (asset.quality >= 85 && asset.resilience >= 80 && finalScore >= 78) {
    return 'ALTA';
  }

  if (finalScore >= 65) {
    return 'MÉDIA';
  }

  return 'BAIXA';
};

const buildReasons = (
  macroAdjustment: Adjustment,
  profileAdjustment: Adjustment,
  concentrationPenalty: Adjustment,
  blockedTickerAdjustment: Adjustment
): string[] => {
  const reasons = [macroAdjustment.reason, profileAdjustment.reason];

  if (concentrationPenalty.value > 0) {
    reasons.push(concentrationPenalty.reason);
  }

  if (blockedTickerAdjustment.value < 0) {
    reasons.push(blockedTickerAdjustment.reason);
  }

  return reasons;
};

export const getAssetScore = (
  asset: Asset,
  preferences: Preferences,
  currentAllocationPct: number
): ScoreBreakdown => {
  const baseScore = calculateBaseScore(asset);
  const macroAdjustment = getMacroAdjustment(asset, preferences.macroScenario);
  const profileAdjustment = getProfileAdjustment(asset, preferences);
  const blockedTickerAdjustment = getBlockedTickerAdjustment(asset, preferences);
  const concentrationPenalty = getConcentrationPenalty(currentAllocationPct);

  const rawFinalScore =
    baseScore +
    macroAdjustment.value +
    profileAdjustment.value +
    blockedTickerAdjustment.value -
    concentrationPenalty.value;

  const finalScore = clamp(rawFinalScore, 0, 100);

  return {
    baseScore: Number(baseScore.toFixed(2)),
    preferenceBonus: Number(profileAdjustment.value.toFixed(2)),
    macroAdjustment: Number(macroAdjustment.value.toFixed(2)),
    concentrationPenalty: Number(concentrationPenalty.value.toFixed(2)),
    finalScore: Number(finalScore.toFixed(2)),
    weight: getScoreWeight(finalScore, currentAllocationPct),
    recommendation: getRecommendationLabel(finalScore),
    confidence: getConfidence(asset, finalScore),
    reasons: buildReasons(
      macroAdjustment,
      profileAdjustment,
      concentrationPenalty,
      blockedTickerAdjustment
    )
  };
};

export const enrichAssetWithScore = (
  asset: Asset,
  preferences: Preferences,
  currentAllocationPct: number,
  currentMarketValue = 0,
  ownedQuantity = 0
): RankedAsset => {
  return {
    ...asset,
    score: getAssetScore(asset, preferences, currentAllocationPct),
    currentAllocationPct,
    currentMarketValue,
    ownedQuantity
  };
};