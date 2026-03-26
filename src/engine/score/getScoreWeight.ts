const SCORE_WEIGHT_RULES = [
  { minScore: 88, weight: 1.35 },
  { minScore: 80, weight: 1.2 },
  { minScore: 72, weight: 1.05 },
  { minScore: 65, weight: 0.9 },
  { minScore: 0, weight: 0.4 }
] as const;

const normalizeScore = (score: number): number => {
  if (!Number.isFinite(score)) {
    return 0;
  }

  if (score < 0) {
    return 0;
  }

  if (score > 100) {
    return 100;
  }

  return score;
};

export const getScoreWeight = (score: number): number => {
  const safeScore = normalizeScore(score);

  const matchedRule = SCORE_WEIGHT_RULES.find(
    (rule) => safeScore >= rule.minScore
  );

  return matchedRule?.weight ?? 0.4;
};