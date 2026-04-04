import { useMemo } from 'react'
import type { Decision } from '../../domain/types'

type Props = {
  decisions: Decision[]
}

const PRIORITY_ORDER: Record<string, number> = {
  COMPRAR: 1,
  AUMENTAR: 2,
  REDUZIR: 3,
}

const ACTIONABLE = new Set(['COMPRAR', 'AUMENTAR', 'REDUZIR'])

const ACTION_LABEL: Record<string, string> = {
  COMPRAR: 'Comprar',
  AUMENTAR: 'Aumentar posição',
  REDUZIR: 'Reduzir posição',
}

const ACTION_STYLE: Record<string, string> = {
  COMPRAR: 'bg-green-500/10 text-green-500 border-green-500/30',
  AUMENTAR: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  REDUZIR: 'bg-red-500/10 text-red-500 border-red-500/30',
}

const CONFIDENCE_STYLE: Record<string, string> = {
  ALTA: 'bg-green-500/20 text-green-500',
  MÉDIA: 'bg-yellow-500/20 text-yellow-500',
  BAIXA: 'bg-red-500/20 text-red-500',
}

const MAX_ITEMS = 5

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string
  subtitle?: string
  count?: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm leading-6 text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {typeof count === 'number' && (
        <span className="text-xs font-medium text-slate-500">
          {count} oportunidade{count > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

function DecisionCard({ decision }: { decision: Decision }) {
  const actionStyle =
    ACTION_STYLE[decision.action] ??
    'bg-slate-100 text-slate-700 border-slate-200'

  const confidenceStyle =
    CONFIDENCE_STYLE[decision.confidence ?? ''] ??
    'bg-slate-200 text-slate-600'

  const actionLabel =
    ACTION_LABEL[decision.action] ?? decision.action

  return (
    <li className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05),0_12px_28px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-slate-950">
            {decision.ticker}
          </span>

          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${actionStyle}`}
          >
            {actionLabel}
          </span>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${confidenceStyle}`}
        >
          {decision.confidence ?? '—'}
        </span>
      </div>

      {decision.reason && (
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {decision.reason}
        </p>
      )}
    </li>
  )
}

export default function WhatToDoNowSection({ decisions }: Props) {
  const topDecisions = useMemo(() => {
    if (!decisions) return []

    return decisions
      .filter((d) => ACTIONABLE.has(d.action))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.action] ?? 99
        const pb = PRIORITY_ORDER[b.action] ?? 99
        return pa - pb
      })
      .slice(0, MAX_ITEMS)
  }, [decisions])

  return (
    <section className="space-y-4">
      <SectionHeader
        title="O que fazer agora"
        subtitle="Ações priorizadas com base no seu perfil e cenário atual."
        count={topDecisions.length}
      />

      {topDecisions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Sua carteira está equilibrada no momento.
        </div>
      ) : (
        <ul className="space-y-3">
          {topDecisions.map((decision) => (
            <DecisionCard
              key={decision.ticker}
              decision={decision}
            />
          ))}
        </ul>
      )}
    </section>
  )
}