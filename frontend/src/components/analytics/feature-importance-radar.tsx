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
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={formattedData}>
          <PolarGrid stroke="#1b2a38" />
          <PolarAngleAxis dataKey="formattedName" tick={{ fill: "#8b9aaa", fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, "auto"]} tick={false} axisLine={false} />

          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: "1px solid #1b2a38",
              background: "#111a24",
              color: "#e6edf3",
              fontSize: 12,
            }}
            itemStyle={{ fontSize: 12 }}
            labelStyle={{ color: "#e6edf3" }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, color: "#8b9aaa" }} />

          <Radar name="Current Event" dataKey="current" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.4} />
          <Radar name="7-Day Average" dataKey="average" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
