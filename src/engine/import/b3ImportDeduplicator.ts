import type { B3ParsedPosition } from './b3Parser';

export const buildPositionHash = (positions: readonly B3ParsedPosition[]): string => {
  return positions
    .map(
      (p) =>
        `${p.ticker}|${p.quantity.toFixed(8)}|${p.avgPrice.toFixed(8)}`
    )
    .sort()
    .join('#');
};

export const removeExactDuplicates = (
  positions: readonly B3ParsedPosition[],
): B3ParsedPosition[] => {
  const seen = new Set<string>();
  const result: B3ParsedPosition[] = [];

  for (const p of positions) {
    const key = `${p.ticker}|${p.quantity}|${p.avgPrice}`;

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(p);
  }

  return result;
};