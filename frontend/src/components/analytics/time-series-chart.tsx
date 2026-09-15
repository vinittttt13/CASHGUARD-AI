"use client";

import React from "react";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns"; // Assuming date-fns is available, fallback to manual if not
// Wait, I will use a simple formatter instead of date-fns to avoid missing dependency

interface TimeSeriesChartProps {
  data: Array<{
    date: string;
    actual: number | null;
    forecast: number | null;
    lowerBound?: number;
    upperBound?: number;
  }>;
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const formatDateStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md border border-[#1b2a38] bg-[#111a24] p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-[#e6edf3]">{formatDateStr(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="capitalize text-[#8b9aaa]">{entry.name}:</span>
              <span className="font-mono font-semibold text-[#e6edf3]">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 25 }}
        >
          <defs>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1b2a38" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateStr}
            tick={{ fontSize: 11, fill: '#8b9aaa' }}
            tickMargin={10}
            minTickGap={30}
            axisLine={{ stroke: '#1b2a38' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#8b9aaa' }}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, color: '#8b9aaa' }} />

          {/* Forecast Area (Confidence Interval could use area bounds if supported, but here just filling under forecast) */}
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorForecast)"
          />

          {/* Actual Line */}
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual Complaints"
            stroke="#22d3ee"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorActual)"
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
