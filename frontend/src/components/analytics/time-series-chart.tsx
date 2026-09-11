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
        <div className="bg-white border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-sm mb-2">{formatDateStr(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground capitalize">{entry.name}:</span>
              <span className="font-semibold">{entry.value}</span>
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
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDateStr}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={36} iconType="circle" />
          
          {/* Forecast Area (Confidence Interval could use area bounds if supported, but here just filling under forecast) */}
          <Area 
            type="monotone" 
            dataKey="forecast" 
            name="Forecast"
            stroke="#8b5cf6" 
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
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorActual)" 
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
