"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const DATA = [
  { month: "Jan", phishing: 420, fraud: 380, scam: 290 },
  { month: "Feb", phishing: 390, fraud: 410, scam: 310 },
  { month: "Mar", phishing: 460, fraud: 430, scam: 280 },
  { month: "Apr", phishing: 510, fraud: 470, scam: 320 },
  { month: "May", phishing: 490, fraud: 520, scam: 350 },
  { month: "Jun", phishing: 560, fraud: 540, scam: 370 },
  { month: "Jul", phishing: 600, fraud: 590, scam: 410 },
];

export function TrendChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={DATA} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="phishing" stroke="#ef4444" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="fraud" stroke="#f97316" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="scam" stroke="#eab308" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default TrendChart;
