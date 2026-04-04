import type { ReactNode } from 'react'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type DashboardGenericPoint = {
  value: number
  type?: string
  ticker?: string
  label?: string
  name?: string
}

type DashboardMetricType = 'currency' | 'percentage' | 'number'

type DashboardMetricItem = {
  label: string
  value: number
  type: DashboardMetricType
}

export type DashboardProps = {
  totalPatrimony: number
  distributionByType: DashboardGenericPoint[]
  distributionByAsset: DashboardGenericPoint[]
  concentrationData: DashboardGenericPoint[]
  performanceData: DashboardGenericPoint[]
  evolutionData: DashboardGenericPoint[]
  insights: string[]
  statItems?: DashboardMetricItem[]
  stats?: DashboardMetricItem[]
  metrics?: DashboardMetricItem[]
  performanceMetrics?: DashboardMetricItem[]
  totalInvested?: number
  invested?: number
  investedValue?: number
  result?: number
  profitLoss?: number
  pnl?: number
  resultPercentage?: number
  profitLossPercentage?: number
  pnlPercentage?: number
  monthlyReturn?: number
  monthlyReturnPercentage?: number
  monthlyProfitability?: number
  annualReturn?: number
  annualReturnPercentage?: number
  annualProfitability?: number
  volatility?: number
  volatilityPercentage?: number
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

const compactNumberFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const CHART_COLORS = [
  '#2563eb',
  '#0f172a',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#dc2626',
]

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getPointLabel(point: DashboardGenericPoint): string {
  const label = point.type ?? point.ticker ?? point.label ?? point.name
  return typeof label === 'string' && label.trim().length > 0
    ? label
    : 'Item'
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(toSafeNumber(value))
}

function formatPercentage(value: number): string {
  return `${percentageFormatter.format(toSafeNumber(value))}%`
}

function formatNumber(value: number): string {
  return numberFormatter.format(toSafeNumber(value))
}

function formatMetricValue(value: number, type: DashboardMetricType): string {
  switch (type) {
    case 'currency':
      return formatCurrency(value)
    case 'percentage':
      return formatPercentage(value)
    case 'number':
      return formatNumber(value)
    default:
      return String(value)
  }
}

function isMetricType(value: unknown): value is DashboardMetricType {
  return value === 'currency' || value === 'percentage' || value === 'number'
}

function isMetricItem(value: unknown): value is DashboardMetricItem {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<DashboardMetricItem>

  return (
    typeof candidate.label === 'string' &&
    candidate.label.trim().length > 0 &&
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value) &&
    isMetricType(candidate.type)
  )
}

function readMetricItems(props: DashboardProps): DashboardMetricItem[] {
  const sources = [
    props.statItems,
    props.stats,
    props.metrics,
    props.performanceMetrics,
  ]

  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue
    }

    const validItems = source.filter(isMetricItem)
    if (validItems.length > 0) {
      return validItems
    }
  }

  return [
    {
      label: 'Investido',
      value: toSafeNumber(
        props.totalInvested ?? props.invested ?? props.investedValue
      ),
      type: 'currency',
    },
    {
      label: 'Patrimônio',
      value: toSafeNumber(props.totalPatrimony),
      type: 'currency',
    },
    {
      label: 'Resultado',
      value: toSafeNumber(props.result ?? props.profitLoss ?? props.pnl),
      type: 'currency',
    },
    {
      label: 'Resultado %',
      value: toSafeNumber(
        props.resultPercentage ??
          props.profitLossPercentage ??
          props.pnlPercentage
      ),
      type: 'percentage',
    },
    {
      label: 'Rentabilidade mensal',
      value: toSafeNumber(
        props.monthlyReturn ??
          props.monthlyReturnPercentage ??
          props.monthlyProfitability
      ),
      type: 'percentage',
    },
    {
      label: 'Rentabilidade anual',
      value: toSafeNumber(
        props.annualReturn ??
          props.annualReturnPercentage ??
          props.annualProfitability
      ),
      type: 'percentage',
    },
    {
      label: 'Volatilidade',
      value: toSafeNumber(props.volatility ?? props.volatilityPercentage),
      type: 'percentage',
    },
  ]
}

function getMetricToneClass(item: DashboardMetricItem): string {
  const normalizedLabel = item.label.trim().toLowerCase()
  const isDirectionalMetric =
    normalizedLabel === 'resultado' || normalizedLabel === 'resultado %'

  if (!isDirectionalMetric) {
    return 'text-slate-950'
  }

  if (item.value > 0) {
    return 'text-emerald-600'
  }

  if (item.value < 0) {
    return 'text-red-600'
  }

  return 'text-slate-950'
}

function calculateAllocationPct(value: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.max(0, Math.min((toSafeNumber(value) / total) * 100, 100))
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold tracking-tight text-slate-950">
        {title}
      </h3>
      {subtitle ? (
        <p className="text-sm leading-6 text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  )
}

function SurfaceBlock({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/50 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      {message}
    </div>
  )
}

function MetricCard({ item }: { item: DashboardMetricItem }) {
  return (
    <div className="rounded-2xl border border-slate-200/50 bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100/50">
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-slate-400">
          {item.label}
        </p>
        <p
          className={`break-words text-xl font-semibold tracking-tight md:text-2xl ${getMetricToneClass(item)}`}
        >
          {formatMetricValue(item.value, item.type)}
        </p>
      </div>
    </div>
  )
}

export function Dashboard(props: DashboardProps) {
  const {
    totalPatrimony,
    distributionByType,
    distributionByAsset,
    concentrationData,
    evolutionData,
    insights,
  } = props

  const safeTotalPatrimony = toSafeNumber(totalPatrimony)
  const metricItems = readMetricItems(props)

  const topAssets = distributionByAsset.slice(0, 8)
  const topConcentration = concentrationData.slice(0, 5)
  const latestEvolutionPoints = evolutionData.slice(-6)

  const hasTypeDistribution = distributionByType.length > 0
  const hasTopAssets = topAssets.length > 0
  const hasTopConcentration = topConcentration.length > 0
  const hasMetricItems = metricItems.length > 0
  const hasEvolutionChart = latestEvolutionPoints.length > 1
  const hasSingleEvolutionPoint = latestEvolutionPoints.length === 1

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Visão estratégica da carteira
        </h2>
        <p className="text-sm leading-6 text-slate-500">
          Leitura consolidada de alocação, concentração e indicadores-chave.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
        <SurfaceBlock className="h-full">
          <SectionHeader
            title="Insights automáticos"
            subtitle="Leitura objetiva dos sinais mais relevantes da carteira."
          />

          <div className="mt-4 space-y-3">
            {insights.length > 0 ? (
              insights.map((insight, index) => (
                <div
                  key={`${insight}-${index}`}
                  className="rounded-2xl border border-emerald-200/60 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800"
                >
                  {insight}
                </div>
              ))
            ) : (
              <EmptyState message="Nenhum insight disponível." />
            )}
          </div>
        </SurfaceBlock>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {hasMetricItems ? (
            metricItems.map((item) => <MetricCard key={item.label} item={item} />)
          ) : (
            <div className="sm:col-span-2 lg:col-span-4 xl:col-span-7">
              <EmptyState message="Nenhum indicador disponível." />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceBlock>
          <SectionHeader
            title="Distribuição por tipo"
            subtitle="Composição da carteira por classe de ativo."
          />

          <div className="mt-4 h-[320px]">
            {hasTypeDistribution ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionByType}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {distributionByType.map((_, index) => (
                      <Cell
                        key={`type-cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]
                        ?.payload as DashboardGenericPoint | undefined
                      return item ? getPointLabel(item) : ''
                    }}
                  />

                  <Legend
                    formatter={(_, entry) => {
                      const payload = entry?.payload as
                        | DashboardGenericPoint
                        | undefined
                      return payload ? getPointLabel(payload) : ''
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                Sem dados disponíveis.
              </div>
            )}
          </div>
        </SurfaceBlock>

        <SurfaceBlock>
          <SectionHeader
            title="Distribuição por ativo"
            subtitle="Participação relativa dos principais ativos na carteira."
          />

          <div className="mt-4 space-y-4">
            {hasTopAssets ? (
              topAssets.map((item, index) => {
                const label = getPointLabel(item)
                const widthPct = calculateAllocationPct(
                  item.value,
                  safeTotalPatrimony
                )

                return (
                  <div key={`${label}-${index}`}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-700">
                        {label}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {formatCurrency(item.value)}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-slate-900 transition-[width]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyState message="Nenhum ativo disponível." />
            )}
          </div>
        </SurfaceBlock>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SurfaceBlock>
          <SectionHeader
            title="Top concentração"
            subtitle="Itens com maior peso relativo dentro do patrimônio."
          />

          <div className="mt-4 space-y-4">
            {hasTopConcentration ? (
              topConcentration.map((item, index) => {
                const label = getPointLabel(item)
                const pct = calculateAllocationPct(
                  item.value,
                  safeTotalPatrimony
                )

                return (
                  <div
                    key={`${label}-${index}`}
                    className="flex justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(item.value)}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-bold text-slate-900">
                      {formatPercentage(pct)}
                    </span>
                  </div>
                )
              })
            ) : (
              <EmptyState message="Nenhum dado de concentração disponível." />
            )}
          </div>
        </SurfaceBlock>

        <SurfaceBlock>
          <SectionHeader
            title="Evolução patrimonial"
            subtitle="Leitura visual da trajetória recente da carteira."
          />

          <div className="mt-4">
            {hasEvolutionChart ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-slate-400">
                    Evolução recente
                  </p>
                </div>

                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={latestEvolutionPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          compactNumberFormatter.format(Number(value))
                        }
                        tick={{ fontSize: 11 }}
                        stroke="#94a3b8"
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#0f172a"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : hasSingleEvolutionPoint ? (
              <div className="flex justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-700">
                  Histórico • {latestEvolutionPoints[0].name}
                </span>

                <span className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatCurrency(latestEvolutionPoints[0].value)}
                </span>
              </div>
            ) : (
              <EmptyState message="Sem histórico suficiente para exibir evolução." />
            )}
          </div>
        </SurfaceBlock>
      </div>
    </section>
  )
}