import { Card } from '../common/Card'
import type { ContributionSuggestion, TagKey } from '../../domain/types'

interface Props {
  monthlyContribution: number
  contribution: ContributionSuggestion[]
  onContributionChange: (value: number) => void
}

const TAG_UI: Record<TagKey, { label: string; color: string }> = {
  strongBuy: { label: 'Forte compra', color: '#16a34a' },
  highConfidence: { label: 'Alta confiança', color: '#2563eb' },
  underweight: { label: 'Subalocado', color: '#d97706' },
  overweight: { label: 'Sobrealocado', color: '#dc2626' },
  international: { label: 'Internacional', color: '#0891b2' },
  dividend: { label: 'Dividendos', color: '#65a30d' },
  quality: { label: 'Qualidade', color: '#0f766e' },
  growth: { label: 'Crescimento', color: '#7c3aed' },
  resilience: { label: 'Resiliência', color: '#2563eb' },
  balanced: { label: 'Balanceado', color: '#6b7280' },
  rebalance: { label: 'Rebalancear', color: '#7c3aed' },
  opportunity: { label: 'Oportunidade', color: '#dc2626' },
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function sanitizeContributionItem(
  item: ContributionSuggestion
): ContributionSuggestion | null {
  if (!item?.ticker || item.ticker.trim().length === 0) {
    return null
  }

  return {
    ...item,
    ticker: item.ticker.trim().toUpperCase(),
    suggestedAmount: toSafeNumber(item.suggestedAmount),
    suggestedShares:
      typeof item.suggestedShares === 'number' &&
      Number.isFinite(item.suggestedShares) &&
      item.suggestedShares >= 0
        ? item.suggestedShares
        : undefined,
    rationale:
      typeof item.rationale === 'string' && item.rationale.trim().length > 0
        ? item.rationale
        : typeof item.reason === 'string'
          ? item.reason
          : '',
    reason:
      typeof item.reason === 'string' && item.reason.trim().length > 0
        ? item.reason
        : typeof item.rationale === 'string'
          ? item.rationale
          : '',
    tags: Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is TagKey => tag in TAG_UI)
      : [],
  }
}

export const ContributionSection = ({
  monthlyContribution,
  contribution,
  onContributionChange,
}: Props) => {
  const safeContribution = Array.isArray(contribution)
    ? contribution
        .map(sanitizeContributionItem)
        .filter((item): item is ContributionSuggestion => item !== null)
    : []

  return (
    <Card
      title="Simulação de aporte"
      subtitle="Distribuição otimizada baseada em score, percentil e alocação atual."
    >
      <div
        style={{
          display: 'grid',
          gap: '1rem',
        }}
      >
        <label
          style={{
            display: 'grid',
            gap: '0.4rem',
            maxWidth: 240,
          }}
        >
          <span>Aporte mensal</span>
          <input
            type="number"
            min={0}
            step={100}
            value={monthlyContribution}
            onChange={(e) => onContributionChange(toSafeNumber(e.target.value))}
          />
        </label>

        {safeContribution.length === 0 ? (
          <div className="empty-state">Nenhuma sugestão encontrada.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th>Valor sugerido</th>
                  <th>Cotas</th>
                  <th>Racional</th>
                  <th>Tags</th>
                </tr>
              </thead>

              <tbody>
                {safeContribution.map((item) => (
                  <tr key={item.ticker}>
                    <td>
                      <strong>{item.ticker}</strong>
                    </td>

                    <td>{formatCurrency(item.suggestedAmount)}</td>

                    <td>{item.suggestedShares ?? '—'}</td>

                    <td>{item.rationale || item.reason || '—'}</td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                        }}
                      >
                        {(item.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className="tag"
                            style={{
                              borderColor: TAG_UI[tag].color,
                              color: TAG_UI[tag].color,
                            }}
                          >
                            {TAG_UI[tag].label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}