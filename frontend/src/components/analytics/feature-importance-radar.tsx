"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface FeatureImportanceRadarProps {
  data: Array<{
    feature: string;
    current: number;
    average: number;
  }>;
}

export function FeatureImportanceRadar({ data }: FeatureImportanceRadarProps) {
  const formatFeatureName = (name: string) =>
    name.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  const formattedData = data.map((item) => ({
    ...item,
    formattedName: formatFeatureName(item.feature),
  }));

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="58%" data={formattedData} margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
          <PolarGrid stroke="hsl(var(--hairline))" />
          <PolarAngleAxis dataKey="formattedName" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, "auto"]} tick={false} axisLine={false} />

          <Tooltip
            contentStyle={{
              borderRadius: 3,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--surface-raised) / var(--glass-opacity-raised))",
              backdropFilter: "blur(20px) saturate(150%)",
              color: "hsl(var(--foreground))",
              fontSize: 12,
            }}
            itemStyle={{ fontSize: 12 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />

          {/* Current event uses flare (it's this incident's live profile); the
              7-day average is a neutral reference line, not a risk signal. */}
          <Radar name="Current Event" dataKey="current" stroke="hsl(var(--flare))" fill="hsl(var(--flare))" fillOpacity={0.35} />
          <Radar name="7-Day Average" dataKey="average" stroke="hsl(var(--ash))" fill="hsl(var(--ash))" fillOpacity={0.15} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
