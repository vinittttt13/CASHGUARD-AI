"use client";

import type { Hotspot } from "@/types";
import { EmptyState } from "@/components/shared/states";
import { normalizeRiskLevel, RISK_META, SeverityBadge } from "@/components/shared/intel-primitives";

function levelFor(risk: number): "critical" | "high" | "medium" | "low" {
  if (risk >= 85) return "critical";
  if (risk >= 70) return "high";
  if (risk >= 40) return "medium";
  return "low";
}

export function HotspotTable({ hotspots = [] }: { hotspots?: Hotspot[] }) {
  if (!hotspots.length) {
    return <EmptyState label="No high-risk hotspots." hint="No clusters currently exceed the risk threshold." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">#</th>
            <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Location</th>
            <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Incidents</th>
            <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Risk Score</th>
            <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Radius</th>
            <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {hotspots.map((h, i) => {
            const risk = Math.round(h.risk_score * 100);
            const level = levelFor(risk);
            const meta = RISK_META[normalizeRiskLevel(level)];
            return (
              <tr key={h.cluster_id} className="border-b border-border/70 last:border-0 hover:bg-surface-raised/60">
                <td className="px-3 py-2.5 font-mono text-subtle-foreground">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{h.name}</td>
                <td className="px-3 py-2.5 font-mono text-muted-foreground">{h.incident_count}</td>
                <td className={`px-3 py-2.5 font-mono font-semibold ${meta.text}`}>{risk}%</td>
                <td className="px-3 py-2.5 font-mono text-muted-foreground">{h.radius_km} km</td>
                <td className="px-3 py-2.5">
                  <SeverityBadge level={level} size="sm" />
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
