import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts'

type DashboardGenericPoint = {
  value: number
  type?: string
  ticker?: string
  label?: string
  name?: string
}

type DashboardProps = {
  totalPatrimony: number
  distributionByType: DashboardGenericPoint[]
  distributionByAsset: DashboardGenericPoint[]
  concentrationData: DashboardGenericPoint[]
  performanceData: DashboardGenericPoint[]
  evolutionData: DashboardGenericPoint[]
  insights: string[]
}

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})

const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1
})

const chartColors = [
  '#2563eb',
  '#0f172a',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#dc2626'
]

function getPointLabel(point: DashboardGenericPoint): string {
  return point.type ?? point.ticker ?? point.label ?? point.name ?? 'Item'
}

export function Dashboard({
  totalPatrimony,
  distributionByType,
  distributionByAsset,
  concentrationData,
  performanceData,
  evolutionData,
  insights
}: DashboardProps) {
  const summaryItems = [
    {
      label: 'Patrimônio total',
      value: numberFormatter.format(totalPatrimony)
    },
    {
      label: 'Tipos',
      value: String(distributionByType.length)
    },
    {
      label: 'Ativos',
      value: String(distributionByAsset.length)
    },
    {
      label: 'Top concentração',
      value: String(concentrationData.length)
    },
    {
      label: 'Performance',
      value: String(performanceData.length)
    }
  ]

  const topAssets = distributionByAsset.slice(0, 8)
  const topConcentration = concentrationData.slice(0, 5)
  const hasTypeDistribution = distributionByType.length > 0

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-sm leading-6 text-slate-600">
          Visão consolidada da carteira, concentração e performance.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Insights automáticos
          </h3>

          <div className="mt-4 space-y-3">
            {insights.length > 0 ? (
              insights.map((insight, index) => (
                <div
                  key={`${insight}-${index}`}
                  className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm"
                >
                  {insight}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Nenhum insight disponível no momento.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Distribuição por tipo
          </h3>

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
                    label={(entry) => getPointLabel(entry as DashboardGenericPoint)}
                  >
                    {distributionByType.map((entry, index) => (
                      <Cell
                        key={`${getPointLabel(entry)}-${index}`}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => numberFormatter.format(Number(value ?? 0))}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as
                        | DashboardGenericPoint
                        | undefined

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
              <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Nenhuma distribuição por tipo disponível.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Distribuição por ativo
          </h3>

          <div className="mt-4 space-y-4">
            {topAssets.length > 0 ? (
              topAssets.map((item, index) => {
                const label = getPointLabel(item)
                const widthPct =
                  totalPatrimony > 0 ? (item.value / totalPatrimony) * 100 : 0

                return (
                  <div key={`${label}-${index}`}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{label}</span>
                      <span className="text-slate-500">
                        {numberFormatter.format(item.value)}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-slate-900"
                        style={{
                          width: `${Math.max(0, Math.min(widthPct, 100))}%`
                        }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Nenhum ativo disponível para exibição.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Top concentração
          </h3>

          <div className="mt-4 space-y-4">
            {topConcentration.length > 0 ? (
              topConcentration.map((item, index) => {
                const label = getPointLabel(item)
                const pct =
                  totalPatrimony > 0 ? (item.value / totalPatrimony) * 100 : 0

                return (
                  <div
                    key={`${label}-${index}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {numberFormatter.format(item.value)}
                      </p>
                    </div>

                    <span className="text-sm font-bold text-slate-900">
                      {percentageFormatter.format(pct)}%
                    </span>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Nenhum dado de concentração disponível.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Indicadores de performance
          </h3>

          <div className="mt-4 space-y-3">
            {performanceData.length > 0 || evolutionData.length > 0 ? (
              [...performanceData, ...evolutionData].slice(0, 8).map((item, index) => {
                const label = getPointLabel(item)

                return (
                  <div
                    key={`${label}-${index}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {label}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {numberFormatter.format(item.value)}
                    </span>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Nenhum indicador disponível.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}