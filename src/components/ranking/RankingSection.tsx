import { useMemo } from 'react'
import { Card } from '../common/Card'
import type {
  Decision,
  FilterType,
  RankedAsset,
} from '../../domain/types'

interface Props {
  ranking: RankedAsset[]
  decision: Decision[]
  filterType: FilterType
  onFilterTypeChange: (value: FilterType) => void
}

const FILTER_OPTIONS: FilterType[] = [
  'TODOS',
  'AÇÃO',
  'FII',
  'ETF',
  'BDR',
]

const formatNumber = (value: number) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const ACTION_LABEL: Record<string, string> = {
  COMPRAR_FORTE: 'Compra forte',
  COMPRAR: 'Comprar',
  REDUZIR: 'Reduzir',
  EVITAR: 'Evitar',
}

const ACTION_STYLE: Record<string, string> = {
  COMPRAR_FORTE:
    'bg-green-500/15 text-green-600 border-green-500/30',
  COMPRAR: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  REDUZIR:
    'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  EVITAR: 'bg-red-500/15 text-red-600 border-red-500/30',
}

function DecisionBadge({ action }: { action?: string }) {
  if (!action) return <span className="text-slate-400">—</span>

  const label = ACTION_LABEL[action] ?? action
  const style =
    ACTION_STYLE[action] ??
    'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  )
}

function TableHeader() {
  return (
    <thead>
      <tr className="text-left text-xs uppercase tracking-[0.24em] text-slate-400">
        <th className="px-4 py-3">Ativo</th>
        <th className="px-4 py-3">Score</th>
        <th className="px-4 py-3">Percentil</th>
        <th className="px-4 py-3">Alocação</th>
        <th className="px-4 py-3">Decisão</th>
      </tr>
    </thead>
  )
}

function RankingRow({
  asset,
  decision,
}: {
  asset: RankedAsset
  decision?: Decision
}) {
  return (
    <tr className="border-t border-slate-200/60 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-950">
            {asset.ticker}
          </span>
        </div>
      </td>

      <td className="px-4 py-3 text-sm font-medium text-slate-900">
        {formatNumber(asset.score.finalScore)}
      </td>

      <td className="px-4 py-3 text-sm text-slate-600">
        {asset.percentile
          ? `${formatNumber(asset.percentile)}`
          : '—'}
      </td>

      <td className="px-4 py-3 text-sm text-slate-600">
        {formatNumber(asset.currentAllocationPct)}%
      </td>

      <td className="px-4 py-3">
        <DecisionBadge action={decision?.action} />
      </td>
    </tr>
  )
}

export const RankingSection = ({
  ranking,
  decision,
  filterType,
  onFilterTypeChange,
}: Props) => {
  const safeRanking = Array.isArray(ranking) ? ranking : []
  const safeDecision = Array.isArray(decision) ? decision : []

  const decisionMap = useMemo(
    () => new Map(safeDecision.map((d) => [d.ticker, d])),
    [safeDecision]
  )

  return (
    <Card
      title="Ranking de ativos"
      subtitle="Ordenado por score, priorização e decisão sugerida"
    >
      <div className="space-y-4">
        {/* FILTRO */}
        <div className="flex flex-col gap-1 max-w-[220px]">
          <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-slate-400">
            Filtro
          </span>

          <select
            value={filterType}
            onChange={(e) =>
              onFilterTypeChange(e.target.value as FilterType)
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* TABELA */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/60">
          <table className="w-full border-collapse">
            <TableHeader />

            <tbody>
              {safeRanking.map((asset) => (
                <RankingRow
                  key={asset.ticker}
                  asset={asset}
                  decision={decisionMap.get(asset.ticker)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}