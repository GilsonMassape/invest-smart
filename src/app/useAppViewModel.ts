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

const createHeaderViewModel = (
  state: PersistentState,
  actions: PersistentActions,
): HeaderViewModel => ({
  riskProfile: state.preferences.riskProfile,
  macroScenario: state.preferences.macroScenario,
  onRiskProfileChange: actions.updateRiskProfile,
  onMacroScenarioChange: actions.updateMacroScenario,
});

const createDashboardViewModel = (
  state: PersistentState,
  rankedCount: number,
  totalInvested: number,
): DashboardViewModel => ({
  totalInvested,
  monthlyContribution: state.monthlyContribution,
  rankedCount,
});

const createContributionViewModel = (
  state: PersistentState,
  contribution: ContributionSuggestion[],
  actions: PersistentActions,
): ContributionViewModel => ({
  monthlyContribution: state.monthlyContribution,
  contribution,
  onMonthlyContributionChange: actions.updateMonthlyContribution,
});

const toBasePortfolioPositions = (
  portfolio: PortfolioData['portfolio'],
): PortfolioPosition[] =>
  portfolio.map((position) => ({
    ticker: position.ticker,
    quantity: position.quantity,
    avgPrice: position.avgPrice,
  }));

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
      createDashboardViewModel(
        state,
        ranking.length,
        totalInvested,
      ),
    [ranking.length, state, totalInvested],
  );

  const contributionViewModel = useMemo<ContributionViewModel>(
    () =>
      createContributionViewModel(
        state,
        contribution,
        actions,
      ),
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