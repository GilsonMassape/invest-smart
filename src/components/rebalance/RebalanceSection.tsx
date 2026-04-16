import { Card } from '../common/Card'
import type { RebalanceSuggestion } from '../../domain/types'
import { toMoney, toPercent } from '../../utils/number'

type Props = {
  rebalance: RebalanceSuggestion[]
}

const getActionMeta = (
  action: RebalanceSuggestion['action']
): { label: string; color: string; background: string } => {
  switch (action) {
    case 'COMPRAR':
      return {
        label: 'Comprar',
        color: '#166534',
        background: '#f0fdf4',
      }
    case 'REDUZIR':
      return {
        label: 'Reduzir',
        color: '#b45309',
        background: '#fffbeb',
      }
    default:
      return {
        label: 'Manter',
        color: '#475569',
        background: '#f8fafc',
      }
  }
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sanitizeRebalanceItem(
  item: RebalanceSuggestion
): RebalanceSuggestion | null {
  if (!item?.ticker || item.ticker.trim().length === 0) {
    return null
  }

  return {
    ...item,
    ticker: item.ticker.trim().toUpperCase(),
    currentValue: toSafeNumber(item.currentValue),
    currentPct: toSafeNumber(item.currentPct),
    targetValue:
      typeof item.targetValue === 'number' && Number.isFinite(item.targetValue)
        ? item.targetValue
        : undefined,
    targetPct: toSafeNumber(item.targetPct),
    diffValue: toSafeNumber(item.diffValue),
    deltaValue:
      typeof item.deltaValue === 'number' && Number.isFinite(item.deltaValue)
        ? item.deltaValue
        : undefined,
  }
}

const getDiffTone = (value: number) => {
  if (value > 0) {
    return '#166534'
  }

  if (value < 0) {
    return '#b45309'
  }

  return '#64748b'
}

export const RebalanceSection = ({ rebalance }: Props) => {
  const safeRebalance = Array.isArray(rebalance)
    ? rebalance
        .map(sanitizeRebalanceItem)
        .filter((item): item is RebalanceSuggestion => item !== null)
    : []

  const hasData = safeRebalance.length > 0

  const actionableCount = safeRebalance.filter(
    (item) => item.action !== 'MANTER'
  ).length

  const buyTotal = safeRebalance
    .filter((item) => item.action === 'COMPRAR' && item.diffValue > 0)
    .reduce((sum, item) => sum + item.diffValue, 0)

  const reduceTotal = safeRebalance
    .filter((item) => item.action === 'REDUZIR' && item.diffValue < 0)
    .reduce((sum, item) => sum + Math.abs(item.diffValue), 0)

  return (
    <Card
      title="Rebalanceamento"
      subtitle="Ajustes sugeridos para aproximar a carteira da alocação-alvo"
    >
      {!hasData ? (
        <p className="muted">Nenhuma sugestão de rebalanceamento disponível.</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
                background: '#fff',
              }}
            >
              <div className="muted" style={{ marginBottom: 4 }}>
                Ações necessárias
              </div>
              <strong style={{ fontSize: 24 }}>{actionableCount}</strong>
            </div>

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
                background: '#fff',
              }}
            >
              <div className="muted" style={{ marginBottom: 4 }}>
                Total a comprar
              </div>
              <strong style={{ fontSize: 24 }}>{toMoney(buyTotal)}</strong>
            </div>

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
                background: '#fff',
              }}
            >
              <div className="muted" style={{ marginBottom: 4 }}>
                Total a reduzir
              </div>
              <strong style={{ fontSize: 24 }}>{toMoney(reduceTotal)}</strong>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th>Valor atual</th>
                  <th>Alocação atual</th>
                  <th>Alocação-alvo</th>
                  <th>Diferença</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {safeRebalance.map((item) => {
                  const actionMeta = getActionMeta(item.action)
                  const pctGap = item.targetPct - item.currentPct

                  return (
                    <tr key={item.ticker}>
                      <td>
                        <strong>{item.ticker}</strong>
                      </td>

                      <td>{toMoney(item.currentValue)}</td>

                      <td>{toPercent(item.currentPct / 100)}</td>

                      <td>{toPercent(item.targetPct / 100)}</td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              color: getDiffTone(item.diffValue),
                              fontWeight: 600,
                            }}
                          >
                            {item.diffValue > 0 ? '+' : ''}
                            {toMoney(item.diffValue)}
                          </span>

                          <span className="muted" style={{ fontSize: 12 }}>
                            {pctGap > 0 ? '+' : ''}
                            {pctGap.toFixed(2)} p.p.
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: actionMeta.background,
                            color: actionMeta.color,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {actionMeta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}