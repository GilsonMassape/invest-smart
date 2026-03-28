import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { formatCurrency } from '../../../utils/formatters';

type DistributionByTypeItem = {
  name: string;
  value: number;
};

type DistributionByTypeChartProps = {
  data: DistributionByTypeItem[];
};

const COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#4b5563',
];

export function DistributionByTypeChart({
  data,
}: DistributionByTypeChartProps): JSX.Element {
  const chartData = Array.isArray(data) ? data : [];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`${entry.name}-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>

        <Tooltip formatter={(value) => formatCurrency(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}