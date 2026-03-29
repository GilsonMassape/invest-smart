import { useMemo } from 'react';
import { DashboardChartCard } from './DashboardChartCard';
import { DistributionByTypeChart } from './charts/DistributionByTypeChart';
import { DistributionByAssetChart } from './charts/DistributionByAssetChart';
import { ConcentrationChart } from './charts/ConcentrationChart';
import { PerformanceChart } from './charts/PerformanceChart';
import { EvolutionChart } from './charts/EvolutionChart';

export type DashboardTypePoint = {
  name: string;
  value: number;
};

export type DashboardAssetPoint = {
  symbol: string;
  value: number;
  percentage: number;
};

export type DashboardMetricPoint = {
  name: string;
  value: number;
};

export type DashboardInsight = {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
};

type DashboardProps = {
  totalPatrimony: number;
  distributionByType: DashboardTypePoint[];
  distributionByAsset: DashboardAssetPoint[];
  concentrationData: DashboardAssetPoint[];
  performanceData: DashboardMetricPoint[];
  evolutionData: DashboardMetricPoint[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const sanitize = (value: number) =>
  Number.isFinite(value) ? value : 0;

// 🔥 ENGINE LOCAL DE INSIGHTS
const generateInsights = (
  total: number,
  assets: DashboardAssetPoint[],
): DashboardInsight[] => {
  const insights: DashboardInsight[] = [];

  if (total <= 0 || assets.length === 0) {
    return insights;
  }

  const sorted = [...assets].sort((a, b) => b.percentage - a.percentage);
  const top = sorted[0];

  // 🔴 Concentração alta
  if (top && top.percentage > 25) {
    insights.push({
      id: 'high_concentration',
      message: `Alta concentração em ${top.symbol} (${top.percentage.toFixed(
        1,
      )}%)`,
      severity: 'critical',
    });
  }

  // 🟡 Baixa diversificação
  if (assets.length < 5) {
    insights.push({
      id: 'low_diversification',
      message: 'Carteira pouco diversificada',
      severity: 'warning',
    });
  }

  // 🟢 Carteira saudável
  if (insights.length === 0) {
    insights.push({
      id: 'healthy',
      message: 'Carteira equilibrada',
      severity: 'info',
    });
  }

  return insights;
};

const getInsightColor = (severity: DashboardInsight['severity']) => {
  if (severity === 'critical') return '#ef4444';
  if (severity === 'warning') return '#eab308';
  return '#16a34a';
};

export function Dashboard({
  totalPatrimony,
  distributionByType,
  distributionByAsset,
  concentrationData,
  performanceData,
  evolutionData,
}: DashboardProps) {
  const safeTotal = sanitize(totalPatrimony);
  const safeAssets = Array.isArray(distributionByAsset)
    ? distributionByAsset
    : [];

  const insights = useMemo(
    () => generateInsights(safeTotal, safeAssets),
    [safeTotal, safeAssets],
  );

  return (
    <section className="space-y-6" aria-label="Dashboard">
      <header>
        <h2 className="text-xl font-semibold">Dashboard</h2>
      </header>

      {/* 🔥 INSIGHTS */}
      {insights.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="text-sm text-gray-500 mb-2">
            Insights automáticos
          </div>

          <div className="space-y-2">
            {insights.map((insight) => (
              <div
                key={insight.id}
                style={{
                  borderLeft: `4px solid ${getInsightColor(
                    insight.severity,
                  )}`,
                  paddingLeft: '8px',
                  fontWeight: 500,
                }}
              >
                {insight.message}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* KPIs */}
      <section className="rounded-2xl bg-white p-4 shadow">
        <div className="text-sm text-gray-500">Patrimônio total</div>
        <div className="mt-2 text-2xl font-bold">
          R$ {formatCurrency(safeTotal)}
        </div>
      </section>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DashboardChartCard title="Distribuição por tipo">
          <DistributionByTypeChart data={distributionByType} />
        </DashboardChartCard>

        <DashboardChartCard title="Distribuição por ativo">
          <DistributionByAssetChart data={distributionByAsset} />
        </DashboardChartCard>

        <DashboardChartCard title="Concentração">
          <ConcentrationChart data={concentrationData} />
        </DashboardChartCard>

        <DashboardChartCard title="Performance">
          <PerformanceChart data={performanceData} />
        </DashboardChartCard>

        <DashboardChartCard title="Evolução" className="md:col-span-2">
          <EvolutionChart data={evolutionData} />
        </DashboardChartCard>
      </div>
    </section>
  );
}