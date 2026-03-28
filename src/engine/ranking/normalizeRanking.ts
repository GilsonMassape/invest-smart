export const normalizeRanking = (scores: number[]) => {
  if (!scores.length) return [];

  const sorted = [...scores].sort((a, b) => b - a);

  return scores.map((score) => {
    const rank = sorted.indexOf(score) + 1;
    const percentile = 1 - (rank - 1) / scores.length;

    return {
      score,
      percentile: Number((percentile * 100).toFixed(2))
    };
  });
};