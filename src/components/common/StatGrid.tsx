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
  return items
    .map((item) => ({
      label: normalizeLabel(item.label),
      value: toSafeNumber(item.value),
      type: item.type,
    }))
    .filter((item) => item.label.length > 0)
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

function splitCurrency(formattedValue: string): { prefix: string; amount: string } {
  const normalized = formattedValue.trim()

  if (!normalized.startsWith('R$')) {
    return {
      prefix: '',
      amount: normalized,
    }
  }

  return {
    prefix: 'R$',
    amount: normalized.replace(/^R\$\s*/, ''),
  }
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
      Nenhum indicador disponível.
    </div>
  )
}

function CurrencyValue({ value, toneClass }: { value: string; toneClass: string }) {
  const { prefix, amount } = splitCurrency(value)

  return (
    <div className="min-w-0">
      <div className="flex items-end gap-2">
        {prefix ? (
          <span className={`shrink-0 text-base font-semibold leading-none md:text-lg ${toneClass}`}>
            {prefix}
          </span>
        ) : null}

        <span
          className={`block min-w-0 whitespace-nowrap text-[clamp(1.55rem,2vw,2.15rem)] font-semibold leading-none tracking-tight tabular-nums ${toneClass}`}
          title={value}
        >
          {amount}
        </span>
      </div>
    </div>
  )
}

function DefaultValue({
  value,
  toneClass,
}: {
  value: string
  toneClass: string
}) {
  return (
    <p
      className={`whitespace-nowrap text-[clamp(1.45rem,1.8vw,2rem)] font-semibold leading-none tracking-tight tabular-nums ${toneClass}`}
      title={value}
    >
      {value}
    </p>
  )
}

function StatCard({ item }: { item: StatItem }) {
  const formattedValue = formatValue(item.value, item.type)
  const valueToneClass = getValueToneClass(item.label, item.value)

  return (
    <div className="group relative w-[190px] shrink-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)] ring-1 ring-slate-100/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05),0_12px_28px_rgba(0,0,0,0.08)] md:w-[210px] md:px-5 md:py-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-70" />

      <div className="flex min-h-[104px] flex-col justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            {item.label}
          </p>
        </div>

        <div className="space-y-2">
          {item.type === 'currency' ? (
            <CurrencyValue
              value={formattedValue}
              toneClass={valueToneClass}
            />
          ) : (
            <DefaultValue
              value={formattedValue}
              toneClass={valueToneClass}
            />
          )}

          <div className="h-1.5 w-10 rounded-full bg-slate-100 transition-colors duration-200 group-hover:bg-slate-200" />
        </div>
      </div>
    </div>
  )
}

export const StatGrid = ({ items }: Props) => {
  const normalizedItems = normalizeItems(items)

  if (normalizedItems.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-full gap-4">
        {normalizedItems.map((item) => (
          <StatCard
            key={`${item.label}-${item.type}`}
            item={item}
          />
        ))}
      </div>
    </div>
  )
}