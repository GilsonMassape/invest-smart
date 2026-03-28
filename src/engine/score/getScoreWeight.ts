const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeScore = (score: number): number => {
  if (!Number.isFinite(score)) return 0;
  return clamp(score, 0, 100);
};

// 🔹 curva contínua (sem degraus)
const getBaseWeight = (score: number): number => {
  // escala 0–100 → 0.4–1.4
  return 0.4 + (score / 100);
};

// 🔹 bônus para topo (convicção alta)
const getConvictionBoost = (score: number): number => {
  if (score >= 85) return 0.15;
  if (score >= 75) return 0.08;
  return 0;
};

// 🔹 penalização leve para ruins
const getPenalty = (score: number): number => {
  if (score < 50) return -0.1;
  return 0;
};

export const getScoreWeight = (score: number): number => {
  const safeScore = normalizeScore(score);

  const base = getBaseWeight(safeScore);
  const boost = getConvictionBoost(safeScore);
  const penalty = getPenalty(safeScore);

  return clamp(base + boost + penalty, 0.3, 1.5);
};