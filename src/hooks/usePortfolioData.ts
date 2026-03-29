import { useMemo } from 'react';
import { ASSETS } from '../data/assets';
import type {
  AppState,
  Asset,
  PortfolioPosition,
  RankedAsset,
} from '../domain/types';
import { allocateByScore } from '../engine/contribution/allocateByScore';
import { buildRanking } from '../engine/ranking/buildRanking';
import { calculateRebalance } from '../engine/rebalance/calculateRebalance';
import { safeDivide } from '../utils/number';

type PortfolioRow = PortfolioPosition & {
  price: number;
  marketValue: number;
  profit: number;
  allocationPct: number;
  sector: string;
  type: Asset['type'];
};

const UNKNOWN_ASSET_FALLBACK: Pick<
  PortfolioRow,
  'price' | 'marketValue' | 'profit' | 'allocationPct' | 'sector' | 'type'
> = {
  price: 0,
  marketValue: 0,
  profit: 0,
  allocationPct: 0,
  sector: 'Desconhecido',
  type: 'AÇÃO',
};

const normalizeTicker = (ticker: string): string => ticker.trim().toUpperCase();

const roundCurrency = (value: number): number => Number(value.toFixed(2));

const buildAssetsMap = (assets: readonly Asset[]): Map<string, Asset> => {
  const map = new Map<string, Asset>();

  for (const asset of assets) {
    map.set(normalizeTicker(asset.ticker), asset);
  }

  return map;
};

const buildPortfolioBaseRows = (
  positions: readonly PortfolioPosition[],
  assetsMap: ReadonlyMap<string, Asset>,
): PortfolioRow[] =>
  positions.map((position) => {
    const ticker = normalizeTicker(position.ticker);
    const asset = assetsMap.get(ticker);

    if (!asset) {
      return {
        ...position,
        ticker,
        ...UNKNOWN_ASSET_FALLBACK,
      };
    }

    const marketValue = roundCurrency(position.quantity * asset.price);
    const profit = roundCurrency(
      (asset.price - position.avgPrice) * position.quantity,
    );

    return {
      ...position,
      ticker,
      price: asset.price,
      sector: asset.sector,
      type: asset.type,
      marketValue,
      profit,
      allocationPct: 0,
    };
  });

const calculateTotalInvested = (portfolioRows: readonly PortfolioRow[]): number =>
  roundCurrency(portfolioRows.reduce((sum, item) => sum + item.marketValue, 0));

const withAllocationPct = (
  portfolioRows: readonly PortfolioRow[],
  totalInvested: number,
): PortfolioRow[] =>
  portfolioRows.map((item) => ({
    ...item,
    allocationPct: roundCurrency(
      safeDivide(item.marketValue, totalInvested) * 100,
    ),
  }));

const filterRankingByType = (
  ranking: readonly RankedAsset[],
  filterType: AppState['filterType'],
): RankedAsset[] => {
  if (filterType === 'TODOS') {
    return [...ranking];
  }

  return ranking.filter((asset) => asset.type === filterType);
};

const buildAlerts = (ranking: readonly RankedAsset[]): string[] =>
  ranking
    .filter((asset) => asset.currentAllocationPct > 20)
    .map((asset) => `${asset.ticker} acima de 20% da carteira.`);

export const usePortfolioData = (state: AppState) => {
  const assetsMap = useMemo<ReadonlyMap<string, Asset>>(
    () => buildAssetsMap(ASSETS),
    [],
  );

  return useMemo(() => {
    const ranking = buildRanking(ASSETS, state.positions, state.preferences);
    const filteredRanking = filterRankingByType(ranking, state.filterType);

    const portfolioBaseRows = buildPortfolioBaseRows(state.positions, assetsMap);
    const totalInvested = calculateTotalInvested(portfolioBaseRows);
    const portfolio = withAllocationPct(portfolioBaseRows, totalInvested);

    const contribution = allocateByScore(ranking, {
      totalAmount: state.monthlyContribution,
    });

    const rebalance = calculateRebalance(ranking);
    const alerts = buildAlerts(ranking);

    return {
      ranking: filteredRanking,
      portfolio,
      totalInvested,
      contribution,
      rebalance,
      alerts,
    };
  }, [
    assetsMap,
    state.filterType,
    state.monthlyContribution,
    state.positions,
    state.preferences,
  ]);
};