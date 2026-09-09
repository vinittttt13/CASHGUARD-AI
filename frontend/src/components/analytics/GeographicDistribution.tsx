"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface GeographicDistributionProps {
  data: Array<{
    state: string;
    count: number;
    riskLevel: "Critical" | "High" | "Medium" | "Low";
  }>;
}

export function GeographicDistribution({ data }: GeographicDistributionProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const total = sortedData.reduce((sum, item) => sum + item.count, 0);

  const getBarColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "Critical": return "#dc2626";
      case "High": return "#f97316";
      case "Medium": return "#f59e0b";
      case "Low": return "#22c55e";
      default: return "#9ca3af";
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.count / total) * 100).toFixed(1);
      
      return (
        <div className="bg-white border p-3 rounded-lg shadow-lg min-w-[150px]">
          <p className="font-semibold text-sm mb-1">{data.state}</p>
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-muted-foreground">Complaints:</span>
            <span className="font-bold">{data.count}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Adjust height based on number of items to make it scrollable/look good
  const chartHeight = Math.max(300, sortedData.length * 40);

  return (
    <div className="w-full overflow-y-auto pr-2" style={{ maxHeight: '400px' }}>
      <div style={{ height: `${chartHeight}px`, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={sortedData}
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="state" 
              type="category" 
              axisLine={false} 
              tickLine={false}
              tick={{ fontSize: 12, fill: '#4b5563' }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
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
