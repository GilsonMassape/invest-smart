import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPercentage } from '../../../utils/formatters';

type ConcentrationChartItem = {
  symbol: string;
  value: number;
  percentage: number;
};

type ConcentrationChartProps = {
  data: ConcentrationChartItem[];
};

export function ConcentrationChart({
  data,
}: ConcentrationChartProps): JSX.Element {
  const chartData = Array.isArray(data) ? data.slice(0, 10) : [];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickFormatter={(value) => formatPercentage(value, 1)}
        />
        <YAxis
          type="category"
          dataKey="symbol"
          width={80}
        />
        <Tooltip formatter={(value) => formatPercentage(value, 2)} />
        <Bar
          dataKey="percentage"
          radius={[0, 8, 8, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}