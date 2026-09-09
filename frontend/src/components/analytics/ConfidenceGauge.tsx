"use client";

import React from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { cn } from "@/lib/utils";

interface ConfidenceGaugeProps {
  score: number; // 0 to 100
  sampleSize: number;
}

export function ConfidenceGauge({ score, sampleSize }: ConfidenceGaugeProps) {
  const getFillColor = (s: number) => {
    if (s >= 75) return "#16a34a"; // green
    if (s >= 50) return "#f59e0b"; // amber
    return "#dc2626"; // red
  };

  const data = [
    {
      name: "Confidence",
      value: score,
      fill: getFillColor(score),
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full h-full relative">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="70%" 
            outerRadius="100%" 
            barSize={15} 
            data={data}
            startAngle={180} 
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: '#f3f4f6' }}
              dataKey="value"
              cornerRadius={10}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Absolute positioned text in the center of the half-circle */}
      <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center">
        <span className="text-3xl font-bold tracking-tight" style={{ color: getFillColor(score) }}>
          {score.toFixed(1)}%
        </span>
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1">
          Confidence
        </span>
        <span className="text-xs text-muted-foreground mt-2">
          Based on {sampleSize} recent predictions
        </span>
      </div>
    </div>
  );
}
