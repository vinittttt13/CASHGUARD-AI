"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const DATA = [
  { state: "MH", incidents: 1240, color: "#ef4444" },
  { state: "DL", incidents: 980, color: "#f97316" },
  { state: "KA", incidents: 750, color: "#f97316" },
  { state: "TG", incidents: 620, color: "#eab308" },
  { state: "GJ", incidents: 540, color: "#eab308" },
  { state: "WB", incidents: 480, color: "#84cc16" },
  { state: "TN", incidents: 430, color: "#84cc16" },
  { state: "RJ", incidents: 390, color: "#84cc16" },
];

export function StateBreakdown() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="state" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value} incidents`, "Count"]} />
        <Bar dataKey="incidents" radius={[4, 4, 0, 0]}>
          {DATA.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default StateBreakdown;
