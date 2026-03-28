import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatCurrencyShort } from '../../../utils/formatters';

type DistributionByAssetItem = {
  symbol: string;
  value: number;
  percentage: number;
};

type DistributionByAssetChartProps = {
  data: DistributionByAssetItem[];
};

export function DistributionByAssetChart({
  data,
}: DistributionByAssetChartProps): JSX.Element {
  const chartData = Array.isArray(data) ? data.slice(0, 10) : [];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="symbol" />
        <YAxis tickFormatter={formatCurrencyShort} />
        <Tooltip formatter={(value) => formatCurrency(value)} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}