"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface GeographicDistributionProps {
  data: Array<{
    state: string;
    count: number;
    riskLevel: "Critical" | "High" | "Medium" | "Low";
  }>;
}

const RISK_COLOR: Record<string, string> = {
  Critical: "hsl(var(--flare))",
  High: "hsl(var(--flare) / 0.7)",
  Medium: "hsl(var(--risk-review))",
  Low: "hsl(var(--verified))",
};

export function GeographicDistribution({ data }: GeographicDistributionProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const total = sortedData.reduce((sum, item) => sum + item.count, 0);

  const getBarColor = (riskLevel: string) => RISK_COLOR[riskLevel] ?? "hsl(var(--ash))";

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const percentage = ((d.count / total) * 100).toFixed(1);
      return (
        <div className="min-w-[150px] border border-border bg-surface-raised p-3 shadow-lg">
          <p className="mb-1.5 text-xs font-semibold text-foreground">{d.state}</p>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Complaints</span>
            <span className="font-mono font-semibold text-foreground">{d.count}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Share</span>
            <span className="font-mono font-medium text-foreground">{percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const chartHeight = Math.max(300, sortedData.length * 40);

  return (
    <div className="w-full overflow-y-auto pr-2 scrollbar-thin" style={{ maxHeight: "400px" }}>
      <div style={{ height: `${chartHeight}px`, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={sortedData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--hairline))" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="state"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--surface-overlay))" }} />
            <Bar dataKey="count" radius={[0, 2, 2, 0]} barSize={18}>
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.riskLevel)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
