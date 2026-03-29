import type { ChangeEvent } from 'react';
import { Dashboard } from '../components/dashboard/Dashboard';
import { StatGrid } from '../components/common/StatGrid';
import { ContributionSection } from '../components/contribution/ContributionSection';
import { B3ImportButton } from '../components/import/B3ImportButton';
import { PortfolioSection } from '../components/portfolio/PortfolioSection';
import { RankingSection } from '../components/ranking/RankingSection';
import { RebalanceSection } from '../components/rebalance/RebalanceSection';
import WhatToDoNowSection from '../components/decision/WhatToDoNowSection';
import type { MacroScenario, RiskProfile } from '../domain/types';
import { useAppViewModel } from './useAppViewModel';

type SelectOption<T extends string> = Readonly<{
  value: T;
  label: string;
}>;

const RISK_PROFILE_OPTIONS: readonly SelectOption<RiskProfile>[] = [
  { value: 'CONSERVADOR', label: 'Conservador' },
  { value: 'EQUILIBRADO', label: 'Equilibrado' },
  { value: 'ARROJADO', label: 'Arrojado' },
];

const MACRO_SCENARIO_OPTIONS: readonly SelectOption<MacroScenario>[] = [
  { value: 'NEUTRO', label: 'Neutro' },
  { value: 'JUROS_ALTOS', label: 'Juros altos' },
  { value: 'CRESCIMENTO', label: 'Crescimento' },
  { value: 'INFLACAO', label: 'Inflação' },
];

const App = () => {
  const vm = useAppViewModel();

  const handleRiskProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    vm.header.onRiskProfileChange(event.target.value as RiskProfile);
  };

  const handleMacroScenarioChange = (event: ChangeEvent<HTMLSelectElement>) => {
    vm.header.onMacroScenarioChange(event.target.value as MacroScenario);
  };

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Invest Smart</p>
          <h1>
            Decisão de aportes com ranking, proteção de concentração e
            persistência local
          </h1>
          <p className="muted">
            App modular em React + TypeScript, com engine separada, simulação de
            aporte, rebalanceamento e sincronização em nuvem.
          </p>
        </div>

        <section
          className="preferences-panel"
          aria-label="Preferências da carteira"
        >
          <label>
            Perfil
            <select
              value={vm.header.riskProfile}
              onChange={handleRiskProfileChange}
            >
              {RISK_PROFILE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cenário macro
            <select
              value={vm.header.macroScenario}
              onChange={handleMacroScenarioChange}
            >
              {MACRO_SCENARIO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <B3ImportButton
            currentPositions={vm.portfolio.currentPositions}
            onConfirmImport={vm.portfolio.onImportFromB3}
          />
        </section>
      </header>

      <Dashboard
        totalPatrimony={vm.dashboard.totalPatrimony}
        distributionByType={vm.dashboard.distributionByType}
        distributionByAsset={vm.dashboard.distributionByAsset}
        concentrationData={vm.dashboard.concentrationData}
        performanceData={vm.dashboard.performanceData}
        evolutionData={vm.dashboard.evolutionData}
        insights={vm.dashboard.insights}
      />

      <StatGrid
        totalInvested={vm.dashboard.totalInvested}
        monthlyContribution={vm.dashboard.monthlyContribution}
        rankedCount={vm.dashboard.rankedCount}
      />

      {/* 🔥 NOVA SEÇÃO — AÇÃO IMEDIATA */}
      <WhatToDoNowSection decisions={vm.ranking.decision} />

      <ContributionSection
        monthlyContribution={vm.contribution.monthlyContribution}
        contribution={vm.contribution.contribution}
        onContributionChange={vm.contribution.onMonthlyContributionChange}
      />

      <section className="content-grid" aria-label="Conteúdo principal">
        <PortfolioSection
          portfolio={vm.portfolio.portfolio}
          onUpsertPosition={vm.portfolio.onUpsertPosition}
          onRemovePosition={vm.portfolio.onRemovePosition}
        />

        <RankingSection
          ranking={vm.ranking.ranking}
          decision={vm.ranking.decision}
          filterType={vm.ranking.filterType}
          onFilterTypeChange={vm.ranking.onFilterTypeChange}
        />

        <RebalanceSection rebalance={vm.rebalance.rebalance} />
      </section>
    </main>
  );
};

export default App;"// test deploy" 
