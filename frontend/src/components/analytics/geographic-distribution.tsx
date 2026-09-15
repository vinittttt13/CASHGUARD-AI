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
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#f59e0b",
  Low: "#22c55e",
};

export function GeographicDistribution({ data }: GeographicDistributionProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const total = sortedData.reduce((sum, item) => sum + item.count, 0);

  const getBarColor = (riskLevel: string) => RISK_COLOR[riskLevel] ?? "#5e6e7e";

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const percentage = ((d.count / total) * 100).toFixed(1);
      return (
        <div className="min-w-[150px] rounded-md border border-[#1b2a38] bg-[#111a24] p-3 shadow-lg">
          <p className="mb-1.5 text-xs font-semibold text-[#e6edf3]">{d.state}</p>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-[#8b9aaa]">Complaints</span>
            <span className="font-mono font-semibold text-[#e6edf3]">{d.count}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8b9aaa]">Share</span>
            <span className="font-mono font-medium text-[#e6edf3]">{percentage}%</span>
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
            <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#1b2a38" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="state"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#8b9aaa" }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#141f2a" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
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
