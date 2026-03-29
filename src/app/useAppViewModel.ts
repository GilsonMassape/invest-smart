import { useCallback, useMemo } from 'react';
import { ASSETS } from '../data/assets';
import {
  resolveB3ImportPositions,
  type B3ImportMode,
  type B3ParsedPosition,
} from '../domain/import/b3Import';
import type {
  Asset,
  ContributionSuggestion,
  FilterType,
  MacroScenario,
  PortfolioPosition,
  RankedAsset,
  RebalanceSuggestion,
  RiskProfile,
} from '../domain/types';
import { usePersistentAppState } from '../hooks/usePersistentAppState';
import { usePortfolioData } from '../hooks/usePortfolioData';

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
  const safeTotalPatrimony = toSafeNumber(totalPatrimony);

  return portfolio
    .map((position) => {
      const quantity = toSafeNumber(position.quantity);
      const avgPrice = toSafeNumber(position.avgPrice);
      const value = quantity * avgPrice;
      const percentage =
        safeTotalPatrimony > 0 ? (value / safeTotalPatrimony) * 100 : 0;

      return {
        symbol: position.ticker,
        value,
        percentage,
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
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

const buildDashboardInsights = (ranking: RankedAsset[]): string[] => {
  const insights: string[] = [];

  const topAsset = ranking[0];
  const worstAsset = ranking[ranking.length - 1];

  if (topAsset && topAsset.score.finalScore >= 80) {
    insights.push(`Melhor oportunidade: ${topAsset.ticker}`);
  }

  if (worstAsset && worstAsset.score.finalScore < 50) {
    insights.push(`Ativo fraco: ${worstAsset.ticker}`);
  }

  const highConcentration = ranking.find((asset) => asset.currentAllocationPct > 25);

  if (highConcentration) {
    insights.push(
      `Alta concentração em ${highConcentration.ticker} (${highConcentration.currentAllocationPct.toFixed(
        1,
      )}%)`,
    );
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
  ranking,
}: {
  state: PersistentState;
  portfolio: PortfolioData['portfolio'];
  rankedCount: number;
  totalInvested: number;
  assetCatalog: AssetCatalogMap;
  ranking: RankedAsset[];
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
  const insights = buildDashboardInsights(ranking);

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
        ranking,
      }),
    [assetCatalog, portfolio, ranking, state, totalInvested],
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
      filterType: state.filterType,
      onFilterTypeChange: actions.updateFilterType,
    }),
    [actions.updateFilterType, ranking, state.filterType],
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