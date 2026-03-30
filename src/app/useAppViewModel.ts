import { useCallback, useEffect, useMemo } from 'react';
import { ASSETS } from '../data/assets';
import {
  resolveB3ImportPositions,
  type B3ImportMode,
  type B3ParsedPosition,
} from '../domain/import/b3Import';
import type {
  Asset,
  ContributionSuggestion,
  Decision,
  FilterType,
  MacroScenario,
  PortfolioPosition,
  RankedAsset,
  RebalanceSuggestion,
  RiskProfile,
} from '../domain/types';
import { buildDecision } from '../engine/decision/buildDecision';
import { usePersistentAppState } from '../hooks/usePersistentAppState';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { fetchPrices } from '../services/priceService';

type PersistentAppState = ReturnType<typeof usePersistentAppState>;
type PersistentState = PersistentAppState['state'];
type PersistentActions = PersistentAppState['actions'];
type PortfolioData = ReturnType<typeof usePortfolioData>;

type DashboardTypePoint = {
  name: string;
  value: number;
};

type DashboardAssetPoint = {
  symbol: string;
  value: number;
  percentage: number;
};

type DashboardMetricPoint = {
  name: string;
  value: number;
};

export interface HeaderViewModel {
  riskProfile: RiskProfile;
  macroScenario: MacroScenario;
  onRiskProfileChange: (value: RiskProfile) => void;
  onMacroScenarioChange: (value: MacroScenario) => void;
}

export interface DashboardViewModel {
  totalInvested: number;
  monthlyContribution: number;
  rankedCount: number;
  totalPatrimony: number;
  distributionByType: DashboardTypePoint[];
  distributionByAsset: DashboardAssetPoint[];
  concentrationData: DashboardAssetPoint[];
  performanceData: DashboardMetricPoint[];
  evolutionData: DashboardMetricPoint[];
  insights: string[];
}

export interface ContributionViewModel {
  monthlyContribution: number;
  contribution: ContributionSuggestion[];
  onMonthlyContributionChange: (value: number) => void;
}

export interface PortfolioViewModel {
  portfolio: PortfolioData['portfolio'];
  assets: Asset[];
  currentPositions: PortfolioPosition[];
  onUpsertPosition: (value: PortfolioPosition) => void;
  onRemovePosition: (ticker: string) => void;
  onImportFromB3: (parsed: B3ParsedPosition[], mode: B3ImportMode) => void;
}

export interface RankingViewModel {
  ranking: RankedAsset[];
  decision: Decision[];
  filterType: FilterType;
  onFilterTypeChange: (value: FilterType) => void;
}

export interface RebalanceViewModel {
  rebalance: RebalanceSuggestion[];
  alerts: string[];
}

export interface AppViewModel {
  header: HeaderViewModel;
  dashboard: DashboardViewModel;
  contribution: ContributionViewModel;
  portfolio: PortfolioViewModel;
  ranking: RankingViewModel;
  rebalance: RebalanceViewModel;
}

type AssetCatalogMap = Map<string, Asset>;

const toSafeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeTicker = (value: string): string => value.trim().toUpperCase();

const buildAssetCatalogMap = (assets: Asset[]): AssetCatalogMap =>
  new Map(assets.map((asset) => [normalizeTicker(asset.ticker), asset]));

const resolveAssetTypeLabel = (
  assetCatalog: AssetCatalogMap,
  ticker: string,
): string => {
  const asset = assetCatalog.get(normalizeTicker(ticker));

  if (!asset) {
    return 'Outros';
  }

  const rawType =
    'type' in asset ? (asset as Asset & { type?: string }).type : undefined;

  return rawType && rawType.trim() ? rawType : 'Outros';
};

const toBasePortfolioPositions = (
  portfolio: PortfolioData['portfolio'],
): PortfolioPosition[] =>
  portfolio.map((position) => ({
    ticker: position.ticker,
    quantity: position.quantity,
    avgPrice: position.avgPrice,
  }));

const buildDistributionByAsset = (
  portfolio: PortfolioData['portfolio'],
  totalPatrimony: number,
): DashboardAssetPoint[] => {
  const items = portfolio
    .map((position) => {
      const quantity = toSafeNumber(position.quantity);
      const marketPrice = toSafeNumber(position.avgPrice);
      const value = quantity * marketPrice;

      return {
        symbol: position.ticker,
        value,
        percentage: 0,
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const patrimony = items.reduce((sum, item) => sum + item.value, 0);
  const safeTotalPatrimony =
    patrimony > 0 ? patrimony : toSafeNumber(totalPatrimony);

  return items.map((item) => ({
    ...item,
    percentage:
      safeTotalPatrimony > 0 ? (item.value / safeTotalPatrimony) * 100 : 0,
  }));
};

const buildDistributionByType = (
  portfolio: PortfolioData['portfolio'],
  assetCatalog: AssetCatalogMap,
): DashboardTypePoint[] => {
  const typeAccumulator = new Map<string, number>();

  for (const position of portfolio) {
    const quantity = toSafeNumber(position.quantity);
    const avgPrice = toSafeNumber(position.avgPrice);
    const patrimonyValue = quantity * avgPrice;

    if (patrimonyValue <= 0) {
      continue;
    }

    const typeLabel = resolveAssetTypeLabel(assetCatalog, position.ticker);

    typeAccumulator.set(
      typeLabel,
      (typeAccumulator.get(typeLabel) ?? 0) + patrimonyValue,
    );
  }

  return Array.from(typeAccumulator.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const buildPerformanceData = (
  totalInvested: number,
  totalPatrimony: number,
): DashboardMetricPoint[] => [
  {
    name: 'Investido',
    value: toSafeNumber(totalInvested),
  },
  {
    name: 'Patrimônio',
    value: toSafeNumber(totalPatrimony),
  },
];

const buildEvolutionData = (totalPatrimony: number): DashboardMetricPoint[] => [
  {
    name: 'Atual',
    value: toSafeNumber(totalPatrimony),
  },
];

const buildDashboardInsights = (decision: Decision[]): string[] => {
  const insights: string[] = [];

  const strongBuy = decision.find((item) => item.action === 'COMPRAR_FORTE');
  const buy = decision.find((item) => item.action === 'COMPRAR');
  const reduce = decision.find((item) => item.action === 'REDUZIR');
  const avoid = decision.find((item) => item.action === 'EVITAR');

  if (strongBuy) {
    insights.push(`Forte oportunidade: ${strongBuy.ticker}`);
  } else if (buy) {
    insights.push(`Melhor compra no momento: ${buy.ticker}`);
  }

  if (reduce) {
    insights.push(`Reduzir exposição em ${reduce.ticker}`);
  }

  if (avoid) {
    insights.push(`Evitar ${avoid.ticker} por baixa atratividade`);
  }

  return insights;
};

const createHeaderViewModel = (
  state: PersistentState,
  actions: PersistentActions,
): HeaderViewModel => ({
  riskProfile: state.preferences.riskProfile,
  macroScenario: state.preferences.macroScenario,
  onRiskProfileChange: actions.updateRiskProfile,
  onMacroScenarioChange: actions.updateMacroScenario,
});

const createDashboardViewModel = ({
  state,
  portfolio,
  rankedCount,
  totalInvested,
  assetCatalog,
  decision,
}: {
  state: PersistentState;
  portfolio: PortfolioData['portfolio'];
  rankedCount: number;
  totalInvested: number;
  assetCatalog: AssetCatalogMap;
  decision: Decision[];
}): DashboardViewModel => {
  const totalPatrimony = toSafeNumber(totalInvested);
  const distributionByAsset = buildDistributionByAsset(
    portfolio,
    totalPatrimony,
  );
  const distributionByType = buildDistributionByType(portfolio, assetCatalog);
  const concentrationData = distributionByAsset.slice(0, 10);
  const performanceData = buildPerformanceData(totalInvested, totalPatrimony);
  const evolutionData = buildEvolutionData(totalPatrimony);
  const insights = buildDashboardInsights(decision);

  return {
    totalInvested,
    monthlyContribution: state.monthlyContribution,
    rankedCount,
    totalPatrimony,
    distributionByType,
    distributionByAsset,
    concentrationData,
    performanceData,
    evolutionData,
    insights,
  };
};

const createContributionViewModel = (
  state: PersistentState,
  contribution: ContributionSuggestion[],
  actions: PersistentActions,
): ContributionViewModel => ({
  monthlyContribution: state.monthlyContribution,
  contribution,
  onMonthlyContributionChange: actions.updateMonthlyContribution,
});

export const useAppViewModel = (): AppViewModel => {
  const { state, actions } = usePersistentAppState();

  const {
    ranking,
    portfolio,
    totalInvested,
    contribution,
    rebalance,
    alerts,
  } = usePortfolioData(state);

  useEffect(() => {
    const tickers = portfolio.map((position) => position.ticker);

    if (tickers.length === 0) {
      return;
    }

    fetchPrices(tickers)
      .then((prices) => {
        console.log('✅ preços recebidos', prices);

        const positionsToUpdate = portfolio.filter((position) => {
          const marketPrice = prices[position.ticker];

          return (
            typeof marketPrice === 'number' &&
            marketPrice > 0 &&
            marketPrice !== position.avgPrice
          );
        });

        for (const position of positionsToUpdate) {
          const marketPrice = prices[position.ticker];

          actions.upsertPosition({
            ticker: position.ticker,
            quantity: position.quantity,
            avgPrice: marketPrice,
          });
        }
      })
      .catch((error) => {
        console.error('❌ erro ao buscar preços', error);
      });
  }, [actions, portfolio]);

  const decision = useMemo<Decision[]>(() => buildDecision(ranking), [ranking]);

  const assetCatalog = useMemo<AssetCatalogMap>(
    () => buildAssetCatalogMap(ASSETS),
    [],
  );

  const currentPortfolioPositions = useMemo<PortfolioPosition[]>(
    () => toBasePortfolioPositions(portfolio),
    [portfolio],
  );

  const handleImportFromB3 = useCallback(
    (parsed: B3ParsedPosition[], mode: B3ImportMode) => {
      const nextPositions = resolveB3ImportPositions(
        currentPortfolioPositions,
        parsed,
        mode,
      );

      actions.replacePositions(nextPositions);
    },
    [actions, currentPortfolioPositions],
  );

  const headerViewModel = useMemo<HeaderViewModel>(
    () => createHeaderViewModel(state, actions),
    [actions, state],
  );

  const dashboardViewModel = useMemo<DashboardViewModel>(
    () =>
      createDashboardViewModel({
        state,
        portfolio,
        rankedCount: ranking.length,
        totalInvested,
        assetCatalog,
        decision,
      }),
    [assetCatalog, decision, portfolio, ranking.length, state, totalInvested],
  );

  const contributionViewModel = useMemo<ContributionViewModel>(
    () => createContributionViewModel(state, contribution, actions),
    [actions, contribution, state],
  );

  const portfolioViewModel = useMemo<PortfolioViewModel>(
    () => ({
      portfolio,
      assets: ASSETS,
      currentPositions: currentPortfolioPositions,
      onUpsertPosition: actions.upsertPosition,
      onRemovePosition: actions.removePosition,
      onImportFromB3: handleImportFromB3,
    }),
    [
      actions.removePosition,
      actions.upsertPosition,
      currentPortfolioPositions,
      handleImportFromB3,
      portfolio,
    ],
  );

  const rankingViewModel = useMemo<RankingViewModel>(
    () => ({
      ranking,
      decision,
      filterType: state.filterType,
      onFilterTypeChange: actions.updateFilterType,
    }),
    [actions.updateFilterType, decision, ranking, state.filterType],
  );

  const rebalanceViewModel = useMemo<RebalanceViewModel>(
    () => ({
      rebalance,
      alerts,
    }),
    [alerts, rebalance],
  );

  return useMemo<AppViewModel>(
    () => ({
      header: headerViewModel,
      dashboard: dashboardViewModel,
      contribution: contributionViewModel,
      portfolio: portfolioViewModel,
      ranking: rankingViewModel,
      rebalance: rebalanceViewModel,
    }),
    [
      contributionViewModel,
      dashboardViewModel,
      headerViewModel,
      portfolioViewModel,
      rankingViewModel,
      rebalanceViewModel,
    ],
  );
};