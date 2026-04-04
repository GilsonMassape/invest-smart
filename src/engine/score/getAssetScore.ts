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
  warningThresholdPct: 20,
  penaltyPerExtraPct: 1.2,
  maxPenalty: 12
} as const;

const BLOCKED_TICKER_PENALTY = 100;
const PREFERRED_TYPE_BONUS = 2;

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

const getPreferenceBonus = (
  asset: Asset,
  preferences: Preferences
): Adjustment => {
  if (isPreferredType(asset, preferences)) {
    return {
      value: PREFERRED_TYPE_BONUS,
      reason: 'Tipo de ativo alinhado às preferências do usuário.'
    };
  }

  return {
    value: 0,
    reason: 'Tipo de ativo sem bônus de preferência.'
  };
};

export const calculateBaseScore = (asset: Asset): number => {
  const quality = asset.quality ?? 0;
  const growth = asset.growth ?? 0;
  const resilience = asset.resilience ?? 0;
  const governance = asset.governance ?? 0;

  const rawScore =
    quality * BASE_SCORE_WEIGHTS.quality +
    growth * BASE_SCORE_WEIGHTS.growth +
    resilience * BASE_SCORE_WEIGHTS.resilience +
    governance * BASE_SCORE_WEIGHTS.governance;

  return clamp(Number(rawScore.toFixed(2)), 0, 100);
};

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

      if (asset.growth >= 80) {
        return {
          value: -4,
          reason: 'Ativos de crescimento tendem a ser penalizados em cenário de juros altos.'
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
  switch (preferences.riskProfile) {
    case 'CONSERVADOR':
      return {
        value: (asset.quality >= 80 ? 3 : -2) + (asset.resilience >= 80 ? 3 : -3),
        reason: 'Perfil conservador prioriza qualidade e resiliência.'
      };

    case 'ARROJADO':
      return {
        value: (asset.growth >= 80 ? 5 : -1) + (asset.quality >= 70 ? 1 : 0),
        reason: 'Perfil arrojado prioriza crescimento com tolerância maior a volatilidade.'
      };

    case 'EQUILIBRADO':
    default:
      return {
        value: 1,
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
  preferenceBonus: Adjustment,
  macroAdjustment: Adjustment,
  profileAdjustment: Adjustment,
  concentrationPenalty: Adjustment,
  blockedTickerAdjustment: Adjustment
): string[] => {
  if (blockedTickerAdjustment.value < 0) {
    return [
      blockedTickerAdjustment.reason,
      macroAdjustment.reason,
      profileAdjustment.reason
    ];
  }

  const reasons: string[] = [];

  if (preferenceBonus.value > 0) {
    reasons.push(preferenceBonus.reason);
  }

  reasons.push(macroAdjustment.reason, profileAdjustment.reason);

  if (concentrationPenalty.value > 0) {
    reasons.push(concentrationPenalty.reason);
  }

  return reasons;
};

export const getAssetScore = (
  asset: Asset,
  preferences: Preferences,
  currentAllocationPct: number
): ScoreBreakdown => {
  const baseScore = calculateBaseScore(asset);
  const preferenceBonus = getPreferenceBonus(asset, preferences);
  const macroAdjustment = getMacroAdjustment(asset, preferences.macroScenario);
  const profileAdjustment = getProfileAdjustment(asset, preferences);
  const blockedTickerAdjustment = getBlockedTickerAdjustment(asset, preferences);
  const concentrationPenalty = getConcentrationPenalty(currentAllocationPct);

  const rawFinalScore =
    baseScore +
    preferenceBonus.value +
    macroAdjustment.value +
    profileAdjustment.value +
    blockedTickerAdjustment.value -
    concentrationPenalty.value;

  const finalScore = clamp(Number(rawFinalScore.toFixed(2)), 0, 100);

  return {
    baseScore: Number(baseScore.toFixed(2)),
    preferenceBonus: Number(preferenceBonus.value.toFixed(2)),
    macroAdjustment: Number(macroAdjustment.value.toFixed(2)),
    concentrationPenalty: Number(concentrationPenalty.value.toFixed(2)),
    finalScore: Number(finalScore.toFixed(2)),
    weight: getScoreWeight(finalScore, currentAllocationPct),
    recommendation: getRecommendationLabel(finalScore),
    confidence: getConfidence(asset, finalScore),
    reasons: buildReasons(
      preferenceBonus,
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
    safeCurrentValue: currentMarketValue,
    ownedQuantity,
    percentile: 0
  };
};