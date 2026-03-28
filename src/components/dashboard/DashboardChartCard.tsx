import type { ReactNode } from 'react';

type DashboardChartCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function DashboardChartCard({
  title,
  children,
  className = '',
}: DashboardChartCardProps) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow ${className}`}>
      <header className="mb-4">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      </header>

      <div className="min-h-[280px]">{children}</div>
    </section>
  );
}