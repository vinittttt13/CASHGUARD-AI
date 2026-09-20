"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/shared/states";

const colorFor = (n: number, max: number) => {
  const r = max ? n / max : 0;
  if (r >= 0.8) return "#ef4444";
  if (r >= 0.5) return "#f97316";
  if (r >= 0.3) return "#f59e0b";
  return "#22c55e";
};

export function StateBreakdown({
  breakdown = {},
}: {
  breakdown?: Record<string, number>;
}) {
  const data = Object.entries(breakdown)
    .map(([state, incidents]) => ({ state, incidents }))
    .sort((a, b) => b.incidents - a.incidents)
    .slice(0, 12);

  if (!data.length) return <EmptyState label="No state data" hint="No jurisdiction breakdown available." />;

  const max = Math.max(...data.map((d) => d.incidents));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1b2a38" />
        <XAxis dataKey="state" tick={{ fontSize: 11, fill: "#8b9aaa" }} interval={0} angle={-35} textAnchor="end" height={60} axisLine={{ stroke: "#1b2a38" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8b9aaa" }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`${value} incidents`, "Count"]}
          contentStyle={{ borderRadius: 6, border: "1px solid #1b2a38", background: "#111a24", color: "#e6edf3", fontSize: 12 }}
          labelStyle={{ color: "#e6edf3" }}
          cursor={{ fill: "#141f2a" }}
        />
        <Bar dataKey="incidents" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={colorFor(entry.incidents, max)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default StateBreakdown;
