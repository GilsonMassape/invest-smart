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

type PerformanceChartItem = {
  name: string;
  value: number;
};

type PerformanceChartProps = {
  data: PerformanceChartItem[];
};

export function PerformanceChart({
  data,
}: PerformanceChartProps): JSX.Element {
  const chartData = Array.isArray(data) ? data : [];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={formatCurrencyShort} />
        <Tooltip formatter={(value) => formatCurrency(value)} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}