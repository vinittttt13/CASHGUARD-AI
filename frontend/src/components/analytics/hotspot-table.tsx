"use client";

import React from "react";
import type { Hotspot } from "@/types";
import { EmptyState } from "@/components/shared/states";

const riskColor = (risk: number) => {
  if (risk >= 85) return "text-red-500";
  if (risk >= 70) return "text-orange-500";
  return "text-yellow-500";
};

const statusFor = (risk: number) =>
  risk >= 85 ? "Critical" : risk >= 70 ? "High" : "Medium";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    High: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Medium:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  };
  return map[status] || "bg-gray-100 text-gray-700";
};

export function HotspotTable({ hotspots = [] }: { hotspots?: Hotspot[] }) {
  if (!hotspots.length) {
    return <EmptyState label="No high-risk hotspots." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">#</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Location</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Incidents</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Risk Score</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Radius</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {hotspots.map((h, i) => {
            const risk = Math.round(h.risk_score * 100);
            const status = statusFor(risk);
            return (
              <tr
                key={h.cluster_id}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 px-3 text-muted-foreground">{i + 1}</td>
                <td className="py-3 px-3 font-medium">{h.name}</td>
                <td className="py-3 px-3 text-muted-foreground">{h.incident_count}</td>
                <td className={`py-3 px-3 font-bold ${riskColor(risk)}`}>{risk}%</td>
                <td className="py-3 px-3 text-muted-foreground">{h.radius_km} km</td>
                <td className="py-3 px-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(status)}`}
                  >
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default HotspotTable;
