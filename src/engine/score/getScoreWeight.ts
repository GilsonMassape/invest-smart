const clamp = (v: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, v));

// curva suave (sigmoid-like)
const smoothCurve = (score: number): number => {
  const x = (score - 60) / 15;
  return 1 / (1 + Math.exp(-x));
};

export const getScoreWeight = (
  score: number,
  concentrationPct?: number
): number => {

  // 🔹 base contínua (0.4 → 1.4)
  let weight = 0.4 + smoothCurve(score) * 1.0;

  // 🔹 boost para elite
  if (score > 85) weight += 0.15;
  if (score > 92) weight += 0.10;

  // 🔻 penalidade por concentração
  if (concentrationPct !== undefined) {
    if (concentrationPct > 25) weight *= 0.7;
    else if (concentrationPct > 18) weight *= 0.85;
  }

  return Number(clamp(weight, 0.3, 1.6).toFixed(2));
};