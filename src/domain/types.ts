import type { Asset, Preferences, ScoreBreakdown } from '../../domain/types';
import { clamp } from '../../utils/number';
import { getRecommendationLabel } from '../../utils/labels';
import { getScoreWeight } from './getScoreWeight';

const normalize = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return 0;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
};

// 🔹 1. VALUATION (proxy simples)
const getValuationScore = (asset: Asset): number => {
  if (!asset.price || !asset.quality) return 50;

  const proxyFairPrice = asset.quality * 1.2;
  const discount = proxyFairPrice / asset.price;

  return clamp(discount * 50, 0, 100);
};

// 🔹 2. DIVIDENDO
const getDividendScore = (asset: Asset): number => {
  if (!asset.dividendYield) return 30;
  return normalize(asset.dividendYield, 0, 12);
};

// 🔹 3. BALANCEAMENTO (quanto mais subalocado, maior score)
const getBalanceScore = (currentAllocationPct: number): number => {
  return clamp(100 - currentAllocationPct, 0, 100);
};

// 🔹 4. MACRO
const getMacroScore = (asset: Asset, macro: Preferences['macroScenario']): number => {
  if (macro === 'JUROS_ALTOS' && asset.type === 'FII') return 30;
  if (macro === 'CRESCIMENTO' && asset.growth > 80) return 90;
  if (macro === 'INFLACAO' && asset.sector?.toLowerCase().includes('energia')) return 80;
  return 60;
};

// 🔹 5. PERFIL
const getProfileScore = (asset: Asset, preferences: Preferences): number => {
  if (preferences.riskProfile === 'CONSERVADOR') {
    return asset.resilience;
  }
  if (preferences.riskProfile === 'ARROJADO') {
    return asset.growth;
  }
  return (asset.quality + asset.resilience) / 2;
};

export const getAssetScore = (
  asset: Asset,
  preferences: Preferences,
  currentAllocationPct: number
): ScoreBreakdown => {
  const valuation = getValuationScore(asset);
  const quality = asset.quality;
  const growth = asset.growth;
  const dividend = getDividendScore(asset);
  const balance = getBalanceScore(currentAllocationPct);
  const macro = getMacroScore(asset, preferences.macroScenario);
  const profile = getProfileScore(asset, preferences);

  const rawFinal =
    valuation * 0.25 +
    quality * 0.20 +
    growth * 0.15 +
    dividend * 0.15 +
    balance * 0.15 +
    macro * 0.05 +
    profile * 0.05;

  const finalScore = clamp(rawFinal, 0, 100);

  return {
    baseScore: Number(valuation.toFixed(2)),
    preferenceBonus: Number(profile.toFixed(2)),
    macroAdjustment: Number(macro.toFixed(2)),
    concentrationPenalty: Number((100 - balance).toFixed(2)),
    finalScore: Number(finalScore.toFixed(2)),
    weight: getScoreWeight(finalScore),
    recommendation: getRecommendationLabel(finalScore),
    confidence: finalScore > 75 ? 'ALTA' : finalScore > 60 ? 'MÉDIA' : 'BAIXA',
    reasons: [
      `Valuation: ${valuation.toFixed(0)}`,
      `Qualidade: ${quality}`,
      `Crescimento: ${growth}`,
      `Dividendos: ${dividend.toFixed(0)}`,
      `Balanceamento: ${balance.toFixed(0)}`
    ]
  };
};