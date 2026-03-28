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

const formatInteger = (value: number) => value.toLocaleString('pt-BR');

const sanitizeNumber = (value: number) =>
  Number.isFinite(value) ? value : 0;

export function Dashboard({
  totalPatrimony,
  distributionByType,
  distributionByAsset,
  concentrationData,
  performanceData,
  evolutionData,
}: DashboardProps) {
  const safeTotalPatrimony = sanitizeNumber(totalPatrimony);
  const safeDistributionByType = Array.isArray(distributionByType)
    ? distributionByType
    : [];
  const safeDistributionByAsset = Array.isArray(distributionByAsset)
    ? distributionByAsset
    : [];
  const safeConcentrationData = Array.isArray(concentrationData)
    ? concentrationData
    : [];
  const safePerformanceData = Array.isArray(performanceData)
    ? performanceData
    : [];
  const safeEvolutionData = Array.isArray(evolutionData) ? evolutionData : [];

  const hasAnyChartData =
    safeTotalPatrimony > 0 ||
    safeDistributionByType.length > 0 ||
    safeDistributionByAsset.length > 0 ||
    safeConcentrationData.length > 0 ||
    safePerformanceData.length > 0 ||
    safeEvolutionData.length > 0;

  if (!hasAnyChartData) {
    return (
      <section
        className="rounded-2xl bg-white p-6 shadow"
        aria-label="Dashboard"
      >
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="mt-4 text-center text-gray-500">
          Sem dados para exibir o dashboard.
        </p>
      </section>
    );
  }

  return (
    <section
      className="space-y-6 rounded-2xl bg-transparent"
      aria-label="Dashboard"
    >
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-gray-500">
          Visão consolidada da carteira, concentração e performance.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Patrimônio total</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            R$ {formatCurrency(safeTotalPatrimony)}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Resumo</div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Tipos</div>
              <div className="font-semibold text-slate-900">
                {formatInteger(safeDistributionByType.length)}
              </div>
            </div>

            <div>
              <div className="text-gray-500">Ativos</div>
              <div className="font-semibold text-slate-900">
                {formatInteger(safeDistributionByAsset.length)}
              </div>
            </div>

            <div>
              <div className="text-gray-500">Top concentração</div>
              <div className="font-semibold text-slate-900">
                {formatInteger(safeConcentrationData.length)}
              </div>
            </div>

            <div>
              <div className="text-gray-500">Performance</div>
              <div className="font-semibold text-slate-900">
                {formatInteger(safePerformanceData.length)}
              </div>
            </div>
          </div>
        </section>

        <DashboardChartCard title="Distribuição por tipo">
          <DistributionByTypeChart data={safeDistributionByType} />
        </DashboardChartCard>

        <DashboardChartCard title="Distribuição por ativo">
          <DistributionByAssetChart data={safeDistributionByAsset} />
        </DashboardChartCard>

        <DashboardChartCard title="Concentração">
          <ConcentrationChart data={safeConcentrationData} />
        </DashboardChartCard>

        <DashboardChartCard title="Performance">
          <PerformanceChart data={safePerformanceData} />
        </DashboardChartCard>

        <DashboardChartCard
          title="Evolução do patrimônio"
          className="md:col-span-2"
        >
          <EvolutionChart data={safeEvolutionData} />
        </DashboardChartCard>
      </div>
    </section>
  );
}