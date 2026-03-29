import { useMemo } from 'react';
import type { Decision } from '../../domain/types';

type Props = {
  decisions: Decision[];
};

const PRIORITY_ORDER: Record<string, number> = {
  COMPRAR: 1,
  AUMENTAR: 2,
  REDUZIR: 3,
};

const ACTIONABLE = new Set(['COMPRAR', 'AUMENTAR', 'REDUZIR']);

const ACTION_STYLE: Record<string, string> = {
  COMPRAR: 'text-green-400 border-green-400/30',
  AUMENTAR: 'text-blue-400 border-blue-400/30',
  REDUZIR: 'text-red-400 border-red-400/30',
};

const CONFIDENCE_STYLE: Record<string, string> = {
  ALTA: 'bg-green-500/20 text-green-400',
  MÉDIA: 'bg-yellow-500/20 text-yellow-400',
  BAIXA: 'bg-red-500/20 text-red-400',
};

const MAX_ITEMS = 5;

export default function WhatToDoNowSection({ decisions }: Props) {
  const topDecisions = useMemo(() => {
    if (!decisions) return [];

    return decisions
      .filter((d) => ACTIONABLE.has(d.action))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.action] ?? 99;
        const pb = PRIORITY_ORDER[b.action] ?? 99;
        return pa - pb;
      })
      .slice(0, MAX_ITEMS);
  }, [decisions]);

  if (!topDecisions.length) return null;

 return (
  <section className="card">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold tracking-tight">
  Próximas ações recomendadas
</h2>
      <span className="text-xs text-zinc-500">
        {topDecisions.length} oportunidades
      </span>
    </div>

    {topDecisions.length === 0 ? (
      <div className="mt-4 text-sm text-zinc-500">
        Sua carteira está equilibrada no momento.
      </div>
    ) : (
      <ul className="space-y-3 mt-3">
        {topDecisions.map((d) => (
          <li
            key={d.ticker}
            className={`rounded-xl p-3 border ${
              ACTION_STYLE[d.action] ?? 'border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{d.ticker}</span>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {d.action}
                </span>

                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    CONFIDENCE_STYLE[d.confidence ?? ''] ??
                    'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {d.confidence ?? '—'}
                </span>
              </div>
            </div>

            <p className="mt-2 text-sm text-zinc-400">
              {d.reason}
            </p>
          </li>
        ))}
      </ul>
    )}
  </section>
);
}