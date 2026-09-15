"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

interface ConfidenceGaugeProps {
  score: number; // 0 to 100
  sampleSize: number;
}

export function ConfidenceGauge({ score, sampleSize }: ConfidenceGaugeProps) {
  const getFillColor = (s: number) => {
    if (s >= 75) return "#22c55e"; // risk-low
    if (s >= 50) return "#f59e0b"; // risk-medium
    return "#ef4444"; // risk-critical
  };

  const data = [{ name: "Confidence", value: score, fill: getFillColor(score) }];

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-4">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={14}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background={{ fill: "hsl(var(--surface-overlay))" }} dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <div className="absolute left-1/2 top-[60%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <span className="font-mono text-2xl font-semibold tabular-nums" style={{ color: getFillColor(score) }}>
          {score.toFixed(1)}%
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Live Confidence Score
        </span>
        <span className="mt-2 text-xs text-subtle-foreground">
          Based on {sampleSize} recent prediction{sampleSize === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
