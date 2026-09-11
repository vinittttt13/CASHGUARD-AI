"use client";

import React from "react";
import type { IntelligenceReport } from "@/types";
import { EmptyState } from "@/components/shared/states";

type ActiveHotspot = IntelligenceReport["active_hotspots"][number];

export function HotspotGrid({ hotspots = [] }: { hotspots?: ActiveHotspot[] }) {
  if (!hotspots.length) return <EmptyState label="No active hotspots." />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {hotspots.map((h) => {
        const score = Math.round(h.risk_score * 100);
        const color =
          score >= 80
            ? "text-red-500"
            : score >= 70
              ? "text-orange-500"
              : "text-yellow-500";
        const bar =
          score >= 80
            ? "bg-red-500"
            : score >= 70
              ? "bg-orange-500"
              : "bg-yellow-500";
        return (
          <div
            key={h.id}
            className="rounded-lg border p-4 space-y-2 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.lat.toFixed(3)}, {h.lng.toFixed(3)}
                </p>
              </div>
              <span className={`text-xl font-bold ${color}`}>{score}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {h.incident_count} {h.incident_count === 1 ? 'incident' : 'incidents'}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default HotspotGrid;
