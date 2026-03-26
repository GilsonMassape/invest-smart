import type { PortfolioPosition } from '../types';

export type B3ImportMode = 'MERGE' | 'REPLACE';

export type B3ParsedPosition = {
  ticker: string;
  quantity: number;
  avgPrice: number;
};

export type ImportStatus = 'NEW' | 'UPDATED' | 'UNCHANGED' | 'REMOVED';

export type B3ImportPreviewItem = {
  ticker: string;
  currentQuantity: number;
  importedQuantity: number;
  resultQuantity: number;
  status: ImportStatus;
};

export type B3ImportPreview = {
  items: B3ImportPreviewItem[];
};

type NormalizedPosition = {
  ticker: string;
  quantity: number;
  avgPrice: number;
};

const normalizeTicker = (ticker: string): string =>
  ticker.trim().toUpperCase();

const roundQuantity = (value: number): number =>
  Number(value.toFixed(8));

const roundPrice = (value: number): number =>
  Number(value.toFixed(8));

const isPositiveQuantity = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const normalizePosition = (
  position: Pick<PortfolioPosition, 'ticker' | 'quantity' | 'avgPrice'>,
): NormalizedPosition => ({
  ticker: normalizeTicker(position.ticker),
  quantity: roundQuantity(position.quantity),
  avgPrice: roundPrice(position.avgPrice),
});

const mergeDuplicatedPositions = <
  T extends Pick<PortfolioPosition, 'ticker' | 'quantity' | 'avgPrice'>,
>(
  positions: readonly T[],
): NormalizedPosition[] => {
  const map = new Map<string, NormalizedPosition>();

  for (const position of positions) {
    const normalized = normalizePosition(position);

    if (!isPositiveQuantity(normalized.quantity)) {
      continue;
    }

    const existing = map.get(normalized.ticker);

    if (!existing) {
      map.set(normalized.ticker, normalized);
      continue;
    }

    const mergedQuantity = roundQuantity(existing.quantity + normalized.quantity);

    const weightedAvgPrice =
      mergedQuantity > 0
        ? roundPrice(
            (existing.quantity * existing.avgPrice +
              normalized.quantity * normalized.avgPrice) /
              mergedQuantity,
          )
        : 0;

    map.set(normalized.ticker, {
      ticker: normalized.ticker,
      quantity: mergedQuantity,
      avgPrice: weightedAvgPrice,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
};

const buildPositionMap = <
  T extends Pick<PortfolioPosition, 'ticker' | 'quantity' | 'avgPrice'>,
>(
  positions: readonly T[],
): Map<string, NormalizedPosition> => {
  const normalizedPositions = mergeDuplicatedPositions(positions);
  const map = new Map<string, NormalizedPosition>();

  for (const position of normalizedPositions) {
    map.set(position.ticker, position);
  }

  return map;
};

export const buildB3ImportPreview = (
  currentPositions: PortfolioPosition[],
  importedPositions: B3ParsedPosition[],
  mode: B3ImportMode,
): B3ImportPreview => {
  const currentMap = buildPositionMap(currentPositions);
  const importedMap = buildPositionMap(importedPositions);

  const items: B3ImportPreviewItem[] = [];

  for (const importedPosition of importedMap.values()) {
    const currentPosition = currentMap.get(importedPosition.ticker);

    if (mode === 'MERGE') {
      const currentQuantity = currentPosition?.quantity ?? 0;
      const resultQuantity = roundQuantity(
        currentQuantity + importedPosition.quantity,
      );

      items.push({
        ticker: importedPosition.ticker,
        currentQuantity,
        importedQuantity: importedPosition.quantity,
        resultQuantity,
        status: currentPosition ? 'UPDATED' : 'NEW',
      });

      continue;
    }

    const currentQuantity = currentPosition?.quantity ?? 0;
    const resultQuantity = importedPosition.quantity;

    let status: ImportStatus;

    if (!currentPosition) {
      status = 'NEW';
    } else if (currentQuantity === resultQuantity) {
      status = 'UNCHANGED';
    } else {
      status = 'UPDATED';
    }

    items.push({
      ticker: importedPosition.ticker,
      currentQuantity,
      importedQuantity: importedPosition.quantity,
      resultQuantity,
      status,
    });
  }

  if (mode === 'REPLACE') {
    for (const currentPosition of currentMap.values()) {
      if (importedMap.has(currentPosition.ticker)) {
        continue;
      }

      items.push({
        ticker: currentPosition.ticker,
        currentQuantity: currentPosition.quantity,
        importedQuantity: 0,
        resultQuantity: 0,
        status: 'REMOVED',
      });
    }
  }

  items.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return { items };
};

export const resolveB3ImportPositions = (
  currentPositions: PortfolioPosition[],
  importedPositions: B3ParsedPosition[],
  mode: B3ImportMode,
): PortfolioPosition[] => {
  const currentMap = buildPositionMap(currentPositions);
  const importedMap = buildPositionMap(importedPositions);

  if (mode === 'REPLACE') {
    return Array.from(importedMap.values()).map((position) => ({
      ticker: position.ticker,
      quantity: position.quantity,
      avgPrice: position.avgPrice,
    }));
  }

  for (const importedPosition of importedMap.values()) {
    const currentPosition = currentMap.get(importedPosition.ticker);

    if (!currentPosition) {
      currentMap.set(importedPosition.ticker, {
        ticker: importedPosition.ticker,
        quantity: importedPosition.quantity,
        avgPrice: importedPosition.avgPrice,
      });
      continue;
    }

    const nextQuantity = roundQuantity(
      currentPosition.quantity + importedPosition.quantity,
    );

    const nextAvgPrice =
      nextQuantity > 0
        ? roundPrice(
            (currentPosition.quantity * currentPosition.avgPrice +
              importedPosition.quantity * importedPosition.avgPrice) /
              nextQuantity,
          )
        : currentPosition.avgPrice;

    currentMap.set(importedPosition.ticker, {
      ticker: importedPosition.ticker,
      quantity: nextQuantity,
      avgPrice: nextAvgPrice,
    });
  }

  return Array.from(currentMap.values())
    .filter((position) => isPositiveQuantity(position.quantity))
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
    .map((position) => ({
      ticker: position.ticker,
      quantity: position.quantity,
      avgPrice: position.avgPrice,
    }));
};