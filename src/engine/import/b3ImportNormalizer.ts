import type { B3ParsedPosition } from './b3Parser';

export type NormalizedB3Position = {
  ticker: string;
  quantity: number;
  avgPrice: number;
};

const round = (value: number): number => Number(value.toFixed(8));

const normalizeTicker = (ticker: string): string =>
  ticker.trim().toUpperCase();

const isValidNumber = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export const normalizeB3Positions = (
  positions: readonly B3ParsedPosition[],
): NormalizedB3Position[] => {
  const map = new Map<string, NormalizedB3Position>();

  for (const position of positions) {
    const ticker = normalizeTicker(position.ticker);
    const quantity = round(position.quantity);
    const avgPrice = round(position.avgPrice);

    if (!ticker || !isValidNumber(quantity) || !isValidNumber(avgPrice)) {
      continue;
    }

    const existing = map.get(ticker);

    if (!existing) {
      map.set(ticker, {
        ticker,
        quantity,
        avgPrice,
      });
      continue;
    }

    const nextQuantity = round(existing.quantity + quantity);

    const nextAvgPrice =
      nextQuantity > 0
        ? round(
            (existing.quantity * existing.avgPrice + quantity * avgPrice) /
              nextQuantity,
          )
        : existing.avgPrice;

    map.set(ticker, {
      ticker,
      quantity: nextQuantity,
      avgPrice: nextAvgPrice,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
};