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

type BreakdownValue = number | null | undefined;

interface ExplainabilityMetric {
  key: 'macro' | 'profile' | 'concentration';
  label: string;
  value: string;
}

const getRecommendationColor = (recommendation: string) => {
  const normalized = recommendation.trim().toLowerCase();

  if (normalized.includes('forte')) return '#16a34a';
  if (normalized.includes('compra')) return '#22c55e';
  if (normalized.includes('neutro')) return '#eab308';
  if (normalized.includes('reduzir')) return '#f97316';

  return '#6b7280';
};

const formatBreakdownValue = (value: BreakdownValue) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0.0';
  return value.toFixed(1);
};

const getConfidenceLabel = (confidence: string | null | undefined) => {
  if (!confidence?.trim()) return '—';
  return confidence;
};

const buildExplainabilityMetrics = (asset: RankedAsset): ExplainabilityMetric[] => {
  const breakdown = asset.score?.breakdown;

  return [
    {
      key: 'macro',
      label: 'Macro',
      value: formatBreakdownValue(breakdown?.macro),
    },
    {
      key: 'profile',
      label: 'Perfil',
      value: formatBreakdownValue(breakdown?.profile),
    },
    {
      key: 'concentration',
      label: 'Concentração',
      value: formatBreakdownValue(breakdown?.concentration),
    },
  ];
};

const buildAssetIdentity = (asset: RankedAsset) => ({
  ticker: asset.ticker,
  name: asset.name,
  typeLabel: getAssetTypeLabel(asset.type),
  sectorLabel: getSectorLabel(asset.sector),
});

const buildPortfolioSnapshot = (asset: RankedAsset) => ({
  allocation: toPercent(asset.currentAllocationPct),
  marketValue: toMoney(asset.currentMarketValue),
});

const buildDecisionSummary = (asset: RankedAsset) => ({
  finalScore: asset.score.finalScore.toFixed(2),
  recommendation: asset.score.recommendation,
  recommendationColor: getRecommendationColor(asset.score.recommendation),
  confidence: getConfidenceLabel(asset.score.confidence),
  rationale: asset.score.rationale ?? [],
  metrics: buildExplainabilityMetrics(asset),
});

const styles = {
  explainabilityContainer: {
    display: 'grid',
    gap: '0.625rem',
    minWidth: 320,
  } satisfies React.CSSProperties,
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.5rem',
  } satisfies React.CSSProperties,
  metricCard: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 10,
    padding: '0.625rem',
    background: 'rgba(255,255,255,0.02)',
  } satisfies React.CSSProperties,
  metricValue: {
    fontWeight: 700,
    fontSize: '0.95rem',
    lineHeight: 1.2,
    marginTop: '0.15rem',
  } satisfies React.CSSProperties,
  rationaleSection: {
    display: 'grid',
    gap: '0.35rem',
  } satisfies React.CSSProperties,
  rationaleList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  } satisfies React.CSSProperties,
  assetName: {
    display: 'inline-block',
    marginTop: '0.15rem',
  } satisfies React.CSSProperties,
  recommendation: {
    fontWeight: 600,
  } satisfies React.CSSProperties,
} as const;

interface RankingAssetIdentityCellProps {
  asset: RankedAsset;
}

const RankingAssetIdentityCell = ({ asset }: RankingAssetIdentityCellProps) => {
  const identity = buildAssetIdentity(asset);

  return (
    <>
      <strong>{identity.ticker}</strong>
      <br />
      <span className="muted" style={styles.assetName}>
        {identity.name}
      </span>
    </>
  );
};

interface RankingDecisionCellProps {
  asset: RankedAsset;
}

const RankingDecisionCell = ({ asset }: RankingDecisionCellProps) => {
  const decision = buildDecisionSummary(asset);

  return (
    <span
      style={{
        ...styles.recommendation,
        color: decision.recommendationColor,
      }}
    >
      {decision.recommendation}
    </span>
  );
};

interface RankingExplainabilityCellProps {
  asset: RankedAsset;
}

const RankingExplainabilityCell = ({ asset }: RankingExplainabilityCellProps) => {
  const decision = buildDecisionSummary(asset);

  return (
    <div style={styles.explainabilityContainer}>
      <div style={styles.metricsGrid}>
        {decision.metrics.map((metric) => (
          <div key={metric.key} style={styles.metricCard}>
            <div className="mini muted">{metric.label}</div>
            <div style={styles.metricValue}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div style={styles.rationaleSection}>
        <div className="mini muted">Fatores de decisão</div>

        <div className="rationale" style={styles.rationaleList}>
          {decision.rationale.length > 0 ? (
            decision.rationale.map((item, index) => (
              <span key={`${item}-${index}`} className="tag">
                {item}
              </span>
            ))
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
};

interface RankingRowProps {
  asset: RankedAsset;
  index: number;
}

const RankingRow = ({ asset, index }: RankingRowProps) => {
  const identity = buildAssetIdentity(asset);
  const snapshot = buildPortfolioSnapshot(asset);
  const decision = buildDecisionSummary(asset);

  return (
    <tr>
      <td>{index + 1}</td>

      <td>
        <RankingAssetIdentityCell asset={asset} />
      </td>

      <td>{identity.typeLabel}</td>

      <td>{identity.sectorLabel}</td>

      <td>
        <strong>{decision.finalScore}</strong>
      </td>

      <td>
        <RankingDecisionCell asset={asset} />
      </td>

      <td>
        <strong>{decision.confidence}</strong>
      </td>

      <td>{snapshot.allocation}</td>

      <td>{snapshot.marketValue}</td>

      <td>
        <RankingExplainabilityCell asset={asset} />
      </td>
    </tr>
  );
};

export const RankingSection = ({
  ranking,
  filterType,
  onFilterTypeChange,
}: Props) => {
  const safeRanking = useMemo<RankedAsset[]>(() => {
    if (!Array.isArray(ranking) || ranking.length === 0) return [];
    return ranking;
  }, [ranking]);

  const isEmpty = safeRanking.length === 0;

  return (
    <Card
      title="Ranking de ativos"
      subtitle="Classificação baseada em score multifatorial com transparência decisória"
      action={
        <select
          value={filterType}
          onChange={(e) =>
            onFilterTypeChange(e.target.value as AppState['filterType'])
          }
          aria-label="Filtrar ranking por tipo de ativo"
        >
          <option value="TODOS">Todos</option>
          <option value="AÇÃO">Ações</option>
          <option value="FII">FIIs</option>
          <option value="ETF">ETFs</option>
          <option value="BDR">BDRs</option>
        </select>
      }
    >
      {isEmpty ? (
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
                <th>Alocação</th>
                <th>Valor</th>
                <th>Camada explicável</th>
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