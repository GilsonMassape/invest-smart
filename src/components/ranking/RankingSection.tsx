import { useMemo } from 'react';
import { Card } from '../common/Card';
import type { AppState, RankedAsset } from '../../domain/types';
import { getAssetTypeLabel, getSectorLabel } from '../../utils/labels';
import { toMoney, toPercent } from '../../utils/number';

interface Props {
  ranking: RankedAsset[];
  filterType: AppState['filterType'];
  onFilterTypeChange: (value: AppState['filterType']) => void;
}

const getRecommendationColor = (recommendation: string) => {
  const normalized = recommendation.trim().toLowerCase();

  if (normalized.includes('forte')) return '#16a34a';
  if (normalized.includes('compra')) return '#22c55e';
  if (normalized.includes('neutro')) return '#eab308';
  if (normalized.includes('reduzir')) return '#f97316';

  return '#6b7280';
};

const getPercentileColor = (percentile?: number) => {
  if (!percentile) return '#6b7280';
  if (percentile >= 90) return '#16a34a';
  if (percentile >= 75) return '#22c55e';
  if (percentile >= 50) return '#eab308';
  return '#ef4444';
};

const RankingRow = ({ asset, index }: { asset: RankedAsset; index: number }) => {
  return (
    <tr>
      <td>{index + 1}</td>

      <td>
        <strong>{asset.ticker}</strong>
        <br />
        <span className="muted">{asset.name}</span>
      </td>

      <td>{getAssetTypeLabel(asset.type)}</td>

      <td>{getSectorLabel(asset.sector)}</td>

      <td>
        <strong>{asset.score.finalScore.toFixed(2)}</strong>
      </td>

      <td>
        <span
          style={{
            color: getRecommendationColor(asset.score.recommendation),
            fontWeight: 600,
          }}
        >
          {asset.score.recommendation}
        </span>
      </td>

      <td>
        <strong>{asset.score.confidence}</strong>
      </td>

      {/* 🔥 NOVO: Percentil */}
      <td>
        <span
          style={{
            color: getPercentileColor(asset.percentile),
            fontWeight: 700,
          }}
        >
          {asset.percentile?.toFixed(1) ?? '—'}%
        </span>
      </td>

      <td>{toPercent(asset.currentAllocationPct)}</td>

      <td>{toMoney(asset.currentMarketValue)}</td>

      <td>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {(asset.score.rationale ?? []).map((r, i) => (
            <span key={i} className="tag">
              {r}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
};

export const RankingSection = ({
  ranking,
  filterType,
  onFilterTypeChange,
}: Props) => {
  const safeRanking = useMemo(() => {
    if (!Array.isArray(ranking)) return [];
    return ranking;
  }, [ranking]);

  return (
    <Card
      title="Ranking de ativos"
      subtitle="Score multifatorial + força relativa (percentil)"
      action={
        <select
          value={filterType}
          onChange={(e) =>
            onFilterTypeChange(e.target.value as AppState['filterType'])
          }
        >
          <option value="TODOS">Todos</option>
          <option value="AÇÃO">Ações</option>
          <option value="FII">FIIs</option>
          <option value="ETF">ETFs</option>
          <option value="BDR">BDRs</option>
        </select>
      }
    >
      {safeRanking.length === 0 ? (
        <div className="empty-state">Nenhum ativo encontrado.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Ativo</th>
                <th>Tipo</th>
                <th>Setor</th>
                <th>Score</th>
                <th>Recomendação</th>
                <th>Confiança</th>
                <th>Percentil</th>
                <th>Alocação</th>
                <th>Valor</th>
                <th>Racional</th>
              </tr>
            </thead>

            <tbody>
              {safeRanking.map((asset, index) => (
                <RankingRow key={asset.ticker} asset={asset} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};