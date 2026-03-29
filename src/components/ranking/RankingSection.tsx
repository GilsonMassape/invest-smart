import { Card } from '../common/Card';
import type {
  Decision,
  FilterType,
  RankedAsset,
} from '../../domain/types';

interface Props {
  ranking: RankedAsset[];
  decision: Decision[];
  filterType: FilterType;
  onFilterTypeChange: (value: FilterType) => void;
}

const FILTER_OPTIONS: FilterType[] = ['TODOS', 'AÇÃO', 'FII', 'ETF', 'BDR'];

const formatNumber = (value: number) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getDecisionColor = (action: string): string => {
  switch (action) {
    case 'COMPRAR_FORTE':
      return '#16a34a';
    case 'COMPRAR':
      return '#2563eb';
    case 'REDUZIR':
      return '#d97706';
    case 'EVITAR':
      return '#dc2626';
    default:
      return '#6b7280';
  }
};

export const RankingSection = ({
  ranking,
  decision,
  filterType,
  onFilterTypeChange,
}: Props) => {
  const safeRanking = Array.isArray(ranking) ? ranking : [];
  const safeDecision = Array.isArray(decision) ? decision : [];

  const decisionMap = new Map(
    safeDecision.map((d) => [d.ticker, d]),
  );

  return (
    <Card
      title="Ranking de Ativos"
      subtitle="Ordenado por score ponderado, percentil e decisão final"
    >
      <div style={{ display: 'grid', gap: '1rem' }}>
        <label style={{ maxWidth: 200 }}>
          <span>Filtro</span>
          <select
            value={filterType}
            onChange={(e) =>
              onFilterTypeChange(e.target.value as FilterType)
            }
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ativo</th>
                <th>Score</th>
                <th>Percentil</th>
                <th>Alocação</th>
                <th>Decisão</th>
              </tr>
            </thead>

            <tbody>
              {safeRanking.map((asset) => {
                const d = decisionMap.get(asset.ticker);

                return (
                  <tr key={asset.ticker}>
                    <td>
                      <strong>{asset.ticker}</strong>
                    </td>

                    <td>{formatNumber(asset.score.finalScore)}</td>

                    <td>
                      {asset.percentile
                        ? `${formatNumber(asset.percentile)}`
                        : '—'}
                    </td>

                    <td>
                      {formatNumber(asset.currentAllocationPct)}%
                    </td>

                    <td>
                      {d ? (
                        <span
                          style={{
                            color: getDecisionColor(d.action),
                            fontWeight: 600,
                          }}
                        >
                          {d.action}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};