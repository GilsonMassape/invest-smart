import { useCallback, useMemo, useState, type ReactNode } from 'react'
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
  benchmarkValue?: number
}

type DashboardMetricType = 'currency' | 'percentage' | 'number'
type PriceStatus = 'idle' | 'loading' | 'success' | 'error'

type DashboardMetricItem = {
  label: string
  value: number
  type: DashboardMetricType
}

type EvolutionChartPoint = {
  name: string
  carteira: number
  benchmark?: number
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
  priceStatus?: PriceStatus
  priceError?: string | null
  lastPriceUpdateAt?: number | null
  onRefreshPrices?: () => Promise<void>
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

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
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

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePoint(input: unknown): DashboardGenericPoint | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as Partial<DashboardGenericPoint>
  const value = toSafeNumber(candidate.value)

  return {
    value,
    type: toSafeString(candidate.type) || undefined,
    ticker: toSafeString(candidate.ticker) || undefined,
    label: toSafeString(candidate.label) || undefined,
    name: toSafeString(candidate.name) || undefined,
    benchmarkValue:
      typeof candidate.benchmarkValue === 'number' &&
      Number.isFinite(candidate.benchmarkValue)
        ? candidate.benchmarkValue
        : undefined,
  }
}

function normalizePoints(points: DashboardGenericPoint[]): DashboardGenericPoint[] {
  if (!Array.isArray(points)) {
    return []
  }

  return points
    .map(normalizePoint)
    .filter((point): point is DashboardGenericPoint => point !== null)
}

function getPointLabel(point: DashboardGenericPoint): string {
  const label = point.type ?? point.ticker ?? point.label ?? point.name
  return toSafeString(label) || 'Item'
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

function formatLastUpdate(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'Ainda não atualizado'
  }

  return dateTimeFormatter.format(new Date(value))
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

function normalizeEvolutionData(
  evolutionData: DashboardGenericPoint[]
): EvolutionChartPoint[] {
  const normalized = normalizePoints(evolutionData)
    .map((item, index) => {
      const label = getPointLabel(item) || `Ponto ${index + 1}`

      return {
        name: label,
        carteira: toSafeNumber(item.value),
        benchmark:
          typeof item.benchmarkValue === 'number' &&
          Number.isFinite(item.benchmarkValue)
            ? item.benchmarkValue
            : undefined,
      }
    })
    .filter((item) => item.name.trim().length > 0)

  if (normalized.length === 0) {
    return []
  }

  if (normalized.length === 1) {
    const single = normalized[0]

    return [
      {
        name: single.name,
        carteira: single.carteira,
        benchmark: single.benchmark,
      },
      {
        name: 'Atual',
        carteira: single.carteira,
        benchmark: single.benchmark,
      },
    ]
  }

  return normalized
}

function normalizeInsights(insights: string[]): string[] {
  if (!Array.isArray(insights)) {
    return []
  }

  return insights
    .map((insight) => toSafeString(insight))
    .filter((insight) => insight.length > 0)
}

function SectionHeader({
  title,
  subtitle,
  aside,
}: {
  title: string
  subtitle?: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-slate-950">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-sm leading-6 text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      {aside ? <div className="shrink-0">{aside}</div> : null}
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

function EmptyState({
  title,
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
      {title ? (
        <p className="mb-1 font-semibold text-slate-700">{title}</p>
      ) : null}
      <p>{message}</p>
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

function EvolutionHighlight({
  points,
}: {
  points: EvolutionChartPoint[]
}) {
  const latestPoint = points[points.length - 1]
  const previousPoint = points.length > 1 ? points[points.length - 2] : null
  const delta = previousPoint ? latestPoint.carteira - previousPoint.carteira : 0

  const deltaClass =
    delta > 0
      ? 'text-emerald-600'
      : delta < 0
        ? 'text-red-600'
        : 'text-slate-500'

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">
          Último patrimônio
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
          {formatCurrency(latestPoint.carteira)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Referência: {latestPoint.name}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">
          Variação recente
        </p>
        <p className={`mt-1 text-lg font-semibold tracking-tight ${deltaClass}`}>
          {previousPoint ? formatCurrency(delta) : 'Sem base comparativa'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {previousPoint
            ? `${previousPoint.name} → ${latestPoint.name}`
            : 'Necessário histórico adicional'}
        </p>
      </div>
    </div>
  )
}

function hasBenchmarkSeries(points: EvolutionChartPoint[]): boolean {
  return points.some(
    (point) =>
      typeof point.benchmark === 'number' && Number.isFinite(point.benchmark)
  )
}

function PriceStatusBadge({
  priceStatus,
}: {
  priceStatus: PriceStatus
}) {
  const ui =
    priceStatus === 'loading'
      ? {
          label: 'Atualizando preços',
          className: 'border-blue-200 bg-blue-50 text-blue-700',
        }
      : priceStatus === 'error'
        ? {
            label: 'Falha na atualização',
            className: 'border-red-200 bg-red-50 text-red-700',
          }
        : priceStatus === 'success'
          ? {
              label: 'Preços atualizados',
              className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            }
          : {
              label: 'Aguardando preços',
              className: 'border-slate-200 bg-slate-50 text-slate-600',
            }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${ui.className}`}
    >
      {ui.label}
    </span>
  )
}

function PriceStatusPanel({
  priceStatus,
  priceError,
  lastPriceUpdateAt,
}: {
  priceStatus: PriceStatus
  priceError: string | null
  lastPriceUpdateAt: number | null
}) {
  const message =
    priceStatus === 'loading'
      ? 'Buscando cotações mais recentes para recalcular patrimônio e métricas.'
      : priceStatus === 'error'
        ? 'Não foi possível concluir a atualização automática dos preços.'
        : priceStatus === 'success'
          ? 'Os preços mais recentes já foram incorporados ao painel.'
          : 'O painel ainda não recebeu uma atualização de preços nesta sessão.'

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-800">{message}</p>
          <p className="text-xs text-slate-500">
            Última atualização: {formatLastUpdate(lastPriceUpdateAt)}
          </p>
        </div>

        <PriceStatusBadge priceStatus={priceStatus} />
      </div>

      {priceError ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {priceError}
        </p>
      ) : null}
    </div>
  )
}

export function Dashboard(props: DashboardProps) {
  const [isManualRefreshRunning, setIsManualRefreshRunning] = useState(false)

  const priceStatus = props.priceStatus ?? 'idle'
  const priceError = props.priceError ?? null
  const lastPriceUpdateAt = props.lastPriceUpdateAt ?? null

  const distributionByType = useMemo(
    () => normalizePoints(props.distributionByType),
    [props.distributionByType]
  )

  const distributionByAsset = useMemo(
    () => normalizePoints(props.distributionByAsset),
    [props.distributionByAsset]
  )

  const concentrationData = useMemo(
    () => normalizePoints(props.concentrationData),
    [props.concentrationData]
  )

  const insights = useMemo(
    () => normalizeInsights(props.insights),
    [props.insights]
  )

  const safeTotalPatrimony = toSafeNumber(props.totalPatrimony)
  const metricItems = useMemo(() => readMetricItems(props), [props])

  const topAssets = useMemo(() => distributionByAsset.slice(0, 8), [distributionByAsset])

  const topConcentration = useMemo(
    () => concentrationData.slice(0, 5),
    [concentrationData]
  )

  const normalizedEvolutionPoints = useMemo(
    () => normalizeEvolutionData(props.evolutionData),
    [props.evolutionData]
  )

  const hasBenchmark = hasBenchmarkSeries(normalizedEvolutionPoints)
  const hasTypeDistribution = distributionByType.length > 0
  const hasTopAssets = topAssets.length > 0
  const hasTopConcentration = topConcentration.length > 0
  const hasMetricItems = metricItems.length > 0
  const hasEvolutionData = normalizedEvolutionPoints.length > 0
  const hasComparableEvolution = normalizedEvolutionPoints.length > 1

  const isRefreshDisabled =
    isManualRefreshRunning || priceStatus === 'loading' || !props.onRefreshPrices

  const handleRefreshPrices = useCallback(async () => {
    if (!props.onRefreshPrices || isManualRefreshRunning) {
      return
    }

    setIsManualRefreshRunning(true)

    try {
      await props.onRefreshPrices()
    } finally {
      setIsManualRefreshRunning(false)
    }
  }, [props.onRefreshPrices, isManualRefreshRunning])

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <SectionHeader
          title="Visão estratégica da carteira"
          subtitle="Leitura consolidada de alocação, concentração e indicadores-chave."
          aside={
            <button
              type="button"
              onClick={() => {
                void handleRefreshPrices()
              }}
              disabled={isRefreshDisabled}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isManualRefreshRunning || priceStatus === 'loading'
                ? 'Atualizando...'
                : 'Atualizar preços'}
            </button>
          }
        />

        <PriceStatusPanel
          priceStatus={priceStatus}
          priceError={priceError}
          lastPriceUpdateAt={lastPriceUpdateAt}
        />
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
              <EmptyState
                title="Nenhum insight disponível"
                message="Assim que houver sinais relevantes na carteira, eles aparecerão aqui."
              />
            )}
          </div>
        </SurfaceBlock>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {hasMetricItems ? (
            metricItems.map((item) => (
              <MetricCard
                key={item.label}
                item={item}
              />
            ))
          ) : (
            <div className="sm:col-span-2 lg:col-span-4 xl:col-span-7">
              <EmptyState
                title="Indicadores indisponíveis"
                message="Ainda não há dados suficientes para montar o resumo executivo."
              />
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
                    data={distributionByType.map((item) => ({
                      ...item,
                      label: getPointLabel(item),
                    }))}
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
              <EmptyState
                title="Nenhum ativo disponível"
                message="Cadastre posições na carteira para visualizar a distribuição por ativo."
              />
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
              <EmptyState
                title="Sem concentração relevante"
                message="A concentração aparecerá aqui quando houver patrimônio distribuído entre ativos."
              />
            )}
          </div>
        </SurfaceBlock>

        <SurfaceBlock>
          <SectionHeader
            title="Evolução patrimonial"
            subtitle="Leitura visual da trajetória recente da carteira."
          />

          <div className="mt-4 space-y-4">
            {hasEvolutionData ? (
              <>
                <EvolutionHighlight points={normalizedEvolutionPoints} />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-slate-400">
                        Evolução recente
                      </p>
                      <p className="text-xs text-slate-500">
                        {hasComparableEvolution
                          ? `${normalizedEvolutionPoints.length} pontos no histórico`
                          : 'Exibindo histórico disponível'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                        Carteira
                      </span>

                      {hasBenchmark ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                          Benchmark
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={normalizedEvolutionPoints}
                        margin={{ top: 8, right: 12, bottom: 8, left: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          stroke="#94a3b8"
                          minTickGap={24}
                        />
                        <YAxis
                          width={72}
                          tickFormatter={(value) =>
                            compactNumberFormatter.format(Number(value))
                          }
                          tick={{ fontSize: 11 }}
                          stroke="#94a3b8"
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            const label =
                              name === 'benchmark' ? 'Benchmark' : 'Carteira'
                            return [formatCurrency(Number(value ?? 0)), label]
                          }}
                          labelFormatter={(label) => `Período: ${String(label)}`}
                        />
                        <Legend
                          formatter={(value) =>
                            value === 'benchmark' ? 'Benchmark' : 'Carteira'
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="carteira"
                          name="carteira"
                          stroke="#0f172a"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                        {hasBenchmark ? (
                          <Line
                            type="monotone"
                            dataKey="benchmark"
                            name="benchmark"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                          />
                        ) : null}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title="Histórico insuficiente"
                message="À medida que o patrimônio for sendo registrado, a evolução aparecerá aqui."
              />
            )}
          </div>
        </SurfaceBlock>
      </div>
    </section>
  )
}