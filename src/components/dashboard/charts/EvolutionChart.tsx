import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatCurrencyShort } from '../../../utils/formatters';

type EvolutionChartItem = {
  name: string;
  value: number;
};

type EvolutionChartProps = {
  data: EvolutionChartItem[];
};

export function EvolutionChart({
  data,
}: EvolutionChartProps): JSX.Element {
  const chartData = Array.isArray(data) ? data : [];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={formatCurrencyShort} />
        <Tooltip formatter={(value) => formatCurrency(value)} />
        <Area type="monotone" dataKey="value" />
      </AreaChart>
    </ResponsiveContainer>
  );
}