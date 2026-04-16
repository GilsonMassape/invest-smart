import {
  lazy,
  Suspense,
  useCallback,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { AuthGate } from './AuthGate'
import { useAppViewModel } from './useAppViewModel'

import { StatGrid, type StatItem } from '../components/common/StatGrid'
import { ContributionSection } from '../components/contribution/ContributionSection'
import WhatToDoNowSection from '../components/decision/WhatToDoNowSection'
import { B3ImportButton } from '../components/import/B3ImportButton'
import { PortfolioSection } from '../components/portfolio/PortfolioSection'
import { RankingSection } from '../components/ranking/RankingSection'
import { RebalanceSection } from '../components/rebalance/RebalanceSection'

import type { MacroScenario, RiskProfile } from '../domain/types'
import { authService } from '../services/authService'

const Dashboard = lazy(async () => {
  const module = await import('../components/dashboard/Dashboard')
  return { default: module.Dashboard }
})

type SelectOption<T extends string> = Readonly<{
  value: T
  label: string
}>

type HeaderSelectProps<T extends string> = Readonly<{
  label: string
  value: T
  options: readonly SelectOption<T>[]
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
  minWidthClassName?: string
}>

type SurfaceCardProps = Readonly<{
  children: ReactNode
  className?: string
  bodyClassName?: string
}>

type MetricKind = 'currency' | 'percentage' | 'number'

type LooseMetric = Readonly<{
  label?: unknown
  value?: unknown
  type?: unknown
  kind?: unknown
  format?: unknown
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

const SURFACE_CARD_CLASS_NAME =
  'rounded-3xl border border-slate-200/50 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.035),0_8px_24px_rgba(0,0,0,0.05)] ring-1 ring-slate-100/50 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05),0_14px_36px_rgba(0,0,0,0.08)]'

function HeaderSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  minWidthClassName = 'min-w-[180px]',
}: HeaderSelectProps<T>) {
  return (
    <label className={`flex ${minWidthClassName} flex-col gap-1.5`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>

      <select
        value={value}
        onChange={onChange}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SurfaceCard({
  children,
  className = '',
  bodyClassName = 'p-5 md:p-6',
}: SurfaceCardProps) {
  return (
    <section className={`${SURFACE_CARD_CLASS_NAME} ${className}`}>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: Readonly<{
  eyebrow: string
  title: string
  description?: string
}>) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
    </div>
  )
}

function DashboardFallback() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      Carregando dashboard...
    </div>
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toMetricKind(value: unknown): MetricKind | null {
  if (value === 'currency' || value === 'percentage' || value === 'number') {
    return value
  }

  return null
}

function readNumber(
  source: Record<string, unknown>,
  ...keys: readonly string[]
): number | null {
  for (const key of keys) {
    const value = source[key]
    if (isFiniteNumber(value)) {
      return value
    }
  }

  return null
}

function readMetricItems(source: Record<string, unknown>): StatItem[] | null {
  const rawCandidates = [
    source.statItems,
    source.stats,
    source.metrics,
    source.performanceMetrics,
  ]

  for (const rawCandidate of rawCandidates) {
    if (!Array.isArray(rawCandidate)) {
      continue
    }

    const normalized = rawCandidate
      .map((entry): StatItem | null => {
        if (!entry || typeof entry !== 'object') {
          return null
        }

        const metric = entry as LooseMetric
        const label =
          typeof metric.label === 'string' && metric.label.trim().length > 0
            ? metric.label
            : null

        const value = metric.value
        const type =
          toMetricKind(metric.type) ??
          toMetricKind(metric.kind) ??
          toMetricKind(metric.format)

        if (!label || !isFiniteNumber(value) || !type) {
          return null
        }

        return {
          label,
          value,
          type,
        }
      })
      .filter((item): item is StatItem => item !== null)

    if (normalized.length > 0) {
      return normalized
    }
  }

  return null
}

function buildDashboardStatItems(
  dashboard: Record<string, unknown>
): StatItem[] {
  const metricItems = readMetricItems(dashboard)
  if (metricItems && metricItems.length > 0) {
    return metricItems
  }

  return [
    {
      label: 'Investido',
      value:
        readNumber(dashboard, 'totalInvested', 'invested', 'investedValue') ?? 0,
      type: 'currency',
    },
    {
      label: 'Patrimônio',
      value:
        readNumber(
          dashboard,
          'totalPatrimony',
          'patrimony',
          'currentValue',
          'portfolioValue'
        ) ?? 0,
      type: 'currency',
    },
    {
      label: 'Resultado',
      value: readNumber(dashboard, 'result', 'profitLoss', 'pnl') ?? 0,
      type: 'currency',
    },
    {
      label: 'Resultado %',
      value:
        readNumber(
          dashboard,
          'resultPercentage',
          'profitLossPercentage',
          'pnlPercentage'
        ) ?? 0,
      type: 'percentage',
    },
    {
      label: 'Rentabilidade mensal',
      value:
        readNumber(
          dashboard,
          'monthlyReturn',
          'monthlyReturnPercentage',
          'monthlyProfitability'
        ) ?? 0,
      type: 'percentage',
    },
    {
      label: 'Rentabilidade anual',
      value:
        readNumber(
          dashboard,
          'annualReturn',
          'annualReturnPercentage',
          'annualProfitability'
        ) ?? 0,
      type: 'percentage',
    },
    {
      label: 'Volatilidade',
      value: readNumber(dashboard, 'volatility', 'volatilityPercentage') ?? 0,
      type: 'percentage',
    },
  ]
}

const App = () => {
  const vm = useAppViewModel()
  const dashboardRecord = vm.dashboard as unknown as Record<string, unknown>
  const dashboardStatItems = buildDashboardStatItems(dashboardRecord)

  const handleRiskProfileChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      vm.header.onRiskProfileChange(event.target.value as RiskProfile)
    },
    [vm.header]
  )

  const handleMacroScenarioChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      vm.header.onMacroScenarioChange(event.target.value as MacroScenario)
    },
    [vm.header]
  )

  const handleSignOut = useCallback(async () => {
    await authService.signOut()
  }, [])

  return (
    <AuthGate>
      <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-5 md:gap-10 md:px-6 md:py-6 lg:px-8 lg:py-8">
          <header
            className={`${SURFACE_CARD_CLASS_NAME} bg-white/90 backdrop-blur-md`}
          >
            <div className="flex flex-col gap-5 px-5 py-5 md:px-6 md:py-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-sm">
                    IS
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                      Plataforma
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-[-0.03em] text-slate-950 md:text-3xl">
                        Invest Smart
                      </h1>

                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        Buy &amp; Hold
                      </span>
                    </div>

                    <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                      Motor inteligente para leitura da carteira, priorização de
                      aportes e rebalanceamento com foco em consistência.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 md:grid md:grid-cols-2 xl:w-auto xl:flex xl:flex-row xl:flex-wrap xl:items-end xl:justify-end xl:gap-4">
                <HeaderSelect<RiskProfile>
                  label="Perfil"
                  value={vm.header.riskProfile}
                  options={RISK_PROFILE_OPTIONS}
                  onChange={handleRiskProfileChange}
                />

                <HeaderSelect<MacroScenario>
                  label="Cenário macro"
                  value={vm.header.macroScenario}
                  options={MACRO_SCENARIO_OPTIONS}
                  onChange={handleMacroScenarioChange}
                  minWidthClassName="min-w-[200px]"
                />

                <div className="flex flex-col gap-2 sm:flex-row md:col-span-2 xl:pt-[23px]">
                  <div className="w-full sm:w-auto">
                    <B3ImportButton
                      currentPositions={vm.portfolio.currentPositions}
                      onConfirmImport={vm.portfolio.onImportFromB3}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-8 md:space-y-10">
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
              <div className="xl:col-span-8">
                <SurfaceCard className="h-full bg-white/95 backdrop-blur-sm">
                  <div className="space-y-5">
                    <SectionIntro
                      eyebrow="Primeira dobra"
                      title="Visão geral da carteira"
                      description="Resumo executivo da posição atual, leitura consolidada e base para decisão."
                    />

                    <Suspense fallback={<DashboardFallback />}>
                      <Dashboard {...vm.dashboard} />
                    </Suspense>
                  </div>
                </SurfaceCard>
              </div>

              <div className="xl:col-span-4">
                <div className="flex flex-col gap-6 lg:flex-row xl:flex-col">
                  <SurfaceCard className="bg-white/95 backdrop-blur-sm">
                    <div className="space-y-4">
                      <SectionIntro
                        eyebrow="Indicadores"
                        title="Resumo numérico"
                      />

                      <StatGrid items={dashboardStatItems} />
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className="bg-white/90 backdrop-blur-sm">
                    <div className="space-y-4">
                      <SectionIntro
                        eyebrow="Prioridade imediata"
                        title="O que fazer agora"
                      />

                      <WhatToDoNowSection decisions={vm.ranking.decision} />
                    </div>
                  </SurfaceCard>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
              <div className="xl:col-span-5">
                <SurfaceCard className="h-full">
                  <div className="space-y-4">
                    <SectionIntro
                      eyebrow="Simulação"
                      title="Aporte mensal"
                    />

                    <ContributionSection
                      monthlyContribution={vm.contribution.monthlyContribution}
                      contribution={vm.contribution.contribution}
                      onContributionChange={
                        vm.contribution.onMonthlyContributionChange
                      }
                    />
                  </div>
                </SurfaceCard>
              </div>

              <div className="xl:col-span-7">
                <div className="grid gap-6">
                  <SurfaceCard>
                    <div className="space-y-4">
                      <SectionIntro
                        eyebrow="Operação"
                        title="Carteira atual"
                      />

                      <PortfolioSection
                        portfolio={vm.portfolio.portfolio}
                        onUpsertPosition={vm.portfolio.onUpsertPosition}
                        onRemovePosition={vm.portfolio.onRemovePosition}
                      />
                    </div>
                  </SurfaceCard>

                  <SurfaceCard>
                    <div className="space-y-4">
                      <SectionIntro
                        eyebrow="Inteligência"
                        title="Ranking de ativos"
                      />

                      <RankingSection
                        ranking={vm.ranking.ranking}
                        decision={vm.ranking.decision}
                        filterType={vm.ranking.filterType}
                        onFilterTypeChange={vm.ranking.onFilterTypeChange}
                      />
                    </div>
                  </SurfaceCard>
                </div>
              </div>
            </section>

            <SurfaceCard>
              <div className="space-y-4">
                <SectionIntro
                  eyebrow="Balanceamento"
                  title="Rebalanceamento sugerido"
                />

                <RebalanceSection rebalance={vm.rebalance.rebalance} />
              </div>
            </SurfaceCard>
          </div>
        </div>
      </main>
    </AuthGate>
  )
}

export default App