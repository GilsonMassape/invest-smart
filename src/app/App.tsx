import type { ChangeEvent } from 'react'
import { AuthGate } from './AuthGate'

import { Dashboard } from '../components/dashboard/Dashboard'
import { StatGrid } from '../components/common/StatGrid'
import { ContributionSection } from '../components/contribution/ContributionSection'
import { B3ImportButton } from '../components/import/B3ImportButton'
import { PortfolioSection } from '../components/portfolio/PortfolioSection'
import { RankingSection } from '../components/ranking/RankingSection'
import { RebalanceSection } from '../components/rebalance/RebalanceSection'
import WhatToDoNowSection from '../components/decision/WhatToDoNowSection'

import type { MacroScenario, RiskProfile } from '../domain/types'
import { useAppViewModel } from './useAppViewModel'
import { authService } from '../services/authService'

type SelectOption<T extends string> = Readonly<{
  value: T
  label: string
}>

const RISK_PROFILE_OPTIONS: readonly SelectOption<RiskProfile>[] = [
  { value: 'CONSERVADOR', label: 'Conservador' },
  { value: 'EQUILIBRADO', label: 'Equilibrado' },
  { value: 'ARROJADO', label: 'Arrojado' },
]

const MACRO_SCENARIO_OPTIONS: readonly SelectOption<MacroScenario>[] = [
  { value: 'NEUTRO', label: 'Neutro' },
  { value: 'JUROS_ALTOS', label: 'Juros altos' },
  { value: 'CRESCIMENTO', label: 'Crescimento' },
  { value: 'INFLACAO', label: 'Inflação' },
]

const App = () => {
  const vm = useAppViewModel()

  const handleRiskProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    vm.header.onRiskProfileChange(event.target.value as RiskProfile)
  }

  const handleMacroScenarioChange = (event: ChangeEvent<HTMLSelectElement>) => {
    vm.header.onMacroScenarioChange(event.target.value as MacroScenario)
  }

  const handleSignOut = async () => {
    await authService.signOut()
  }

  return (
    <AuthGate>
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
          <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Invest Smart
                </p>

                <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
                  Decisão de aportes com ranking, proteção de concentração e
                  persistência local
                </h1>

                <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
                  App modular em React + TypeScript, com engine separada,
                  simulação de aporte, rebalanceamento e sincronização em nuvem.
                </p>
              </div>

              <div className="flex w-full flex-col gap-4 xl:max-w-md">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Perfil
                    </span>
                    <select
                      value={vm.header.riskProfile}
                      onChange={handleRiskProfileChange}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    >
                      {RISK_PROFILE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Cenário macro
                    </span>
                    <select
                      value={vm.header.macroScenario}
                      onChange={handleMacroScenarioChange}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    >
                      {MACRO_SCENARIO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <B3ImportButton
                      currentPositions={vm.portfolio.currentPositions}
                      onConfirmImport={vm.portfolio.onImportFromB3}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </header>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Dashboard {...vm.dashboard} />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <StatGrid
              totalInvested={vm.dashboard.totalInvested}
              monthlyContribution={vm.dashboard.monthlyContribution}
              rankedCount={vm.dashboard.rankedCount}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <WhatToDoNowSection decisions={vm.ranking.decision} />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <ContributionSection
              monthlyContribution={vm.contribution.monthlyContribution}
              contribution={vm.contribution.contribution}
              onContributionChange={vm.contribution.onMonthlyContributionChange}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <PortfolioSection
                portfolio={vm.portfolio.portfolio}
                onUpsertPosition={vm.portfolio.onUpsertPosition}
                onRemovePosition={vm.portfolio.onRemovePosition}
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <RankingSection
                ranking={vm.ranking.ranking}
                decision={vm.ranking.decision}
                filterType={vm.ranking.filterType}
                onFilterTypeChange={vm.ranking.onFilterTypeChange}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <RebalanceSection rebalance={vm.rebalance.rebalance} />
          </section>
        </div>
      </main>
    </AuthGate>
  )
}

export default App