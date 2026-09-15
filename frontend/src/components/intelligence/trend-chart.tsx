"use client";

import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendsResponse } from "@/types";
import { EmptyState } from "@/components/shared/states";

export function TrendChart({ trends }: { trends?: TrendsResponse }) {
  const data = [
    ...(trends?.daily_counts ?? []).map((d) => ({
      date: d.date.slice(5),
      incidents: d.count,
      forecast: null as number | null,
    })),
    ...(trends?.forecast ?? []).map((d) => ({
      date: d.date.slice(5),
      incidents: null as number | null,
      forecast: d.predicted_count,
    })),
  ];

  if (!data.length) return <EmptyState label="NO TREND DATA" hint="No incident history in this window." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1b2a38" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b9aaa" }} minTickGap={24} axisLine={{ stroke: "#1b2a38" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8b9aaa" }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 6, border: "1px solid #1b2a38", background: "#111a24", color: "#e6edf3", fontSize: 12 }}
          labelStyle={{ color: "#e6edf3" }}
        />
        <Line
          type="monotone"
          dataKey="incidents"
          name="Incidents"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="#a78bfa"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default TrendChart;
