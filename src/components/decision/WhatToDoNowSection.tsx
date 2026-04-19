import { useCallback, useMemo, useState } from 'react'
import type { Decision } from '../../domain/types'

type Props = {
  decisions: Decision[]
}

const PRIORITY_ORDER: Record<string, number> = {
  COMPRAR_FORTE: 1,
  COMPRAR: 2,
  REDUZIR: 3,
  EVITAR: 4,
}

const ACTIONABLE = new Set<string>(['COMPRAR_FORTE', 'COMPRAR', 'REDUZIR'])

const ACTION_LABEL: Record<string, string> = {
  COMPRAR_FORTE: 'Compra forte',
  COMPRAR: 'Comprar',
  REDUZIR: 'Reduzir posição',
  EVITAR: 'Evitar',
}

const ACTION_STYLE: Record<string, string> = {
  COMPRAR_FORTE:
    'border-emerald-400/30 bg-emerald-500/12 text-emerald-300',
  COMPRAR: 'border-blue-400/30 bg-blue-500/12 text-blue-300',
  REDUZIR: 'border-amber-400/30 bg-amber-500/12 text-amber-300',
  EVITAR: 'border-red-400/30 bg-red-500/12 text-red-300',
}

const CONFIDENCE_STYLE: Record<string, string> = {
  ALTA: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-300',
  MÉDIA: 'border-amber-400/30 bg-amber-500/12 text-amber-300',
  BAIXA: 'border-red-400/30 bg-red-500/12 text-red-300',
}

const MAX_ITEMS = 5

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function sanitizeDecision(decision: Decision): Decision | null {
  if (!decision || typeof decision.ticker !== 'string') {
    return null
  }

  const ticker = normalizeTicker(decision.ticker)

  if (!ticker) {
    return null
  }

  return {
    ...decision,
    ticker,
    reason:
      typeof decision.reason === 'string' && decision.reason.trim().length > 0
        ? decision.reason.trim()
        : undefined,
  }
}

function buildSafeDecisions(decisions: Decision[]): Decision[] {
  if (!Array.isArray(decisions)) {
    return []
  }

  return decisions
    .map(sanitizeDecision)
    .filter((decision): decision is Decision => decision !== null)
}

function HeaderMeta({
  subtitle,
  count,
}: {
  subtitle?: string
  count?: number
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        {subtitle ? (
          <p className="text-sm leading-6 text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      {typeof count === 'number' ? (
        <span className="shrink-0 text-xs font-medium text-slate-500">
          {count} oportunidade{count > 1 ? 's' : ''}
        </span>
      ) : null}
    </div>
  )
}

function DecisionCard({
  decision,
  isOpen,
  onToggle,
}: {
  decision: Decision
  isOpen: boolean
  onToggle: () => void
}) {
  const actionStyle =
    ACTION_STYLE[decision.action] ??
    'border-slate-500/30 bg-slate-500/10 text-slate-200'

  const confidenceStyle =
    CONFIDENCE_STYLE[decision.confidence ?? ''] ??
    'border-slate-500/30 bg-slate-500/10 text-slate-200'

  const actionLabel = ACTION_LABEL[decision.action] ?? decision.action
  const hasReason = Boolean(decision.reason)

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-800 bg-[#071634] shadow-[0_2px_10px_rgba(2,6,23,0.2)] ring-1 ring-slate-800/80">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasReason}
        aria-expanded={hasReason ? isOpen : undefined}
        className="flex w-full items-start justify-between gap-4 bg-[#071634] p-4 text-left transition hover:bg-[#0a1b42] disabled:cursor-default"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xl font-bold tracking-tight text-white">
              {decision.ticker}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${actionStyle}`}
            >
              {actionLabel}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceStyle}`}
            >
              {decision.confidence ?? '—'}
            </span>

            {hasReason ? (
              <span className="text-xs font-medium text-slate-300">
                {isOpen ? 'Ocultar motivo' : 'Ver motivo'}
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">
                Sem motivo detalhado
              </span>
            )}
          </div>
        </div>

        {hasReason ? (
          <span className="shrink-0 pt-1 text-lg font-semibold text-slate-300">
            {isOpen ? '−' : '+'}
          </span>
        ) : null}
      </button>

      {hasReason && isOpen ? (
        <div className="border-t border-white/10 bg-[#0a1b42] px-4 pb-4 pt-3">
          <p className="text-sm leading-6 text-slate-200">{decision.reason}</p>
        </div>
      ) : null}
    </li>
  )
}

export default function WhatToDoNowSection({ decisions }: Props) {
  const [openTicker, setOpenTicker] = useState<string | null>(null)

  const topDecisions = useMemo(() => {
    const safeDecisions = buildSafeDecisions(decisions)

    return safeDecisions
      .filter((decision) => ACTIONABLE.has(decision.action))
      .sort((left, right) => {
        const leftPriority = PRIORITY_ORDER[left.action] ?? 99
        const rightPriority = PRIORITY_ORDER[right.action] ?? 99

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }

        return left.ticker.localeCompare(right.ticker, 'pt-BR')
      })
      .slice(0, MAX_ITEMS)
  }, [decisions])

  const handleToggle = useCallback((ticker: string) => {
    setOpenTicker((current) => (current === ticker ? null : ticker))
  }, [])

  return (
    <section className="space-y-4">
      <HeaderMeta
        subtitle="Clique em cada indicação para ver o motivo."
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
              isOpen={openTicker === decision.ticker}
              onToggle={() => handleToggle(decision.ticker)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}