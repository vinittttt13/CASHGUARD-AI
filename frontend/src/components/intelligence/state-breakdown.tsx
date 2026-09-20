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
  if (r >= 0.8) return "hsl(var(--flare))";
  if (r >= 0.5) return "hsl(var(--flare) / 0.7)";
  if (r >= 0.3) return "hsl(var(--risk-review))";
  return "hsl(var(--verified))";
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--hairline))" />
        <XAxis dataKey="state" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-35} textAnchor="end" height={60} axisLine={{ stroke: "hsl(var(--hairline))" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`${value} incidents`, "Count"]}
          contentStyle={{ borderRadius: 3, border: "1px solid hsl(var(--border))", background: "hsl(var(--surface-raised))", color: "hsl(var(--foreground))", fontSize: 12 }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          cursor={{ fill: "hsl(var(--surface-overlay))" }}
        />
        <Bar dataKey="incidents" radius={[2, 2, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={colorFor(entry.incidents, max)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default StateBreakdown;
