"use client";

import React from "react";

const SAMPLE_HOTSPOTS = [
  { id: 1, region: "Mumbai, Maharashtra", type: "Financial Fraud", risk: 92, trend: "↑", status: "Critical" },
  { id: 2, region: "Delhi NCR", type: "Phishing", risk: 85, trend: "↑", status: "High" },
  { id: 3, region: "Bengaluru, Karnataka", type: "Identity Theft", risk: 78, trend: "→", status: "High" },
  { id: 4, region: "Hyderabad, Telangana", type: "Online Scam", risk: 71, trend: "↓", status: "Medium" },
  { id: 5, region: "Chennai, Tamil Nadu", type: "Cyber Extortion", risk: 65, trend: "↑", status: "Medium" },
  { id: 6, region: "Kolkata, West Bengal", type: "Data Breach", risk: 58, trend: "→", status: "Medium" },
];

const riskColor = (risk: number) => {
  if (risk >= 85) return "text-red-500";
  if (risk >= 70) return "text-orange-500";
  return "text-yellow-500";
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    High: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  };
  return map[status] || "bg-gray-100 text-gray-700";
};

export function HotspotTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">#</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Region</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Crime Type</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Risk Score</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Trend</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_HOTSPOTS.map((h) => (
            <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-3 text-muted-foreground">{h.id}</td>
              <td className="py-3 px-3 font-medium">{h.region}</td>
              <td className="py-3 px-3 text-muted-foreground">{h.type}</td>
              <td className={`py-3 px-3 font-bold ${riskColor(h.risk)}`}>{h.risk}%</td>
              <td className="py-3 px-3">{h.trend}</td>
              <td className="py-3 px-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(h.status)}`}>
                  {h.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default HotspotTable;
