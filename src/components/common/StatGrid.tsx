import { toMoney } from '../../utils/number'

export type StatValueType = 'currency' | 'percentage' | 'number'

export interface StatItem {
  label: string
  value: number
  type: StatValueType
}

interface Props {
  items: StatItem[]
}

const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

function toSafeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeLabel(label: string): string {
  return label.trim()
}

function normalizeItems(items: StatItem[]): StatItem[] {
  return items.map((item) => ({
    label: normalizeLabel(item.label),
    value: toSafeNumber(item.value),
    type: item.type,
  }))
}

function formatPercentage(value: number): string {
  return `${percentageFormatter.format(toSafeNumber(value))}%`
}

function formatNumber(value: number): string {
  return numberFormatter.format(toSafeNumber(value))
}

function formatValue(value: number, type: StatValueType): string {
  switch (type) {
    case 'currency':
      return toMoney(toSafeNumber(value))
    case 'percentage':
      return formatPercentage(value)
    case 'number':
      return formatNumber(value)
    default:
      return String(value)
  }
}

function getValueToneClass(label: string, value: number): string {
  const normalizedLabel = label.trim().toLowerCase()
  const isDirectionalMetric =
    normalizedLabel === 'resultado' || normalizedLabel === 'resultado %'

  if (!isDirectionalMetric) {
    return 'text-slate-950'
  }

  if (value > 0) {
    return 'text-emerald-600'
  }

  if (value < 0) {
    return 'text-red-600'
  }

  return 'text-slate-950'
}

function getGridColumnsClass(itemCount: number): string {
  if (itemCount <= 1) return 'grid-cols-1'
  if (itemCount === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (itemCount === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  if (itemCount === 4) return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
  if (itemCount <= 6) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'

  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'
}

function StatCard({ item }: { item: StatItem }) {
  const formattedValue = formatValue(item.value, item.type)
  const valueToneClass = getValueToneClass(item.label, item.value)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)] ring-1 ring-slate-100/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05),0_12px_28px_rgba(0,0,0,0.08)] md:px-5 md:py-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-70" />

      <div className="flex min-h-[92px] flex-col justify-between gap-3 md:min-h-[104px]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            {item.label}
          </p>
        </div>

        <div className="space-y-1">
          <p
            className={`break-words text-xl font-semibold leading-tight tracking-tight md:text-2xl ${valueToneClass}`}
          >
            {formattedValue}
          </p>

          <div className="h-1.5 w-10 rounded-full bg-slate-100 transition-colors duration-200 group-hover:bg-slate-200" />
        </div>
      </div>
    </div>
  )
}

export const StatGrid = ({ items }: Props) => {
  const normalizedItems = normalizeItems(items)

  return (
    <div className={`grid gap-4 ${getGridColumnsClass(normalizedItems.length)}`}>
      {normalizedItems.map((item) => (
        <StatCard
          key={`${item.label}-${item.type}`}
          item={item}
        />
      ))}
    </div>
  )
}