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

  if (!data.length) return <EmptyState label="No trend data." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
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
          stroke="#8b5cf6"
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
