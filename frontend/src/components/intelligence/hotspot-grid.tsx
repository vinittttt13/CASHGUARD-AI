"use client";

import type { IntelligenceReport } from "@/types";
import { EmptyState } from "@/components/shared/states";
import { RiskScore, TechnicalId } from "@/components/shared/intel-primitives";

type ActiveHotspot = IntelligenceReport["active_hotspots"][number];

export function HotspotGrid({ hotspots = [] }: { hotspots?: ActiveHotspot[] }) {
  if (!hotspots.length) return <EmptyState label="NO ACTIVE HOTSPOTS" hint="No cash-out clusters in this window." />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hotspots.map((h) => (
        <div key={h.id} className="space-y-2 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:bg-surface-raised/60">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{h.name}</p>
              <TechnicalId>
                {h.lat.toFixed(3)}, {h.lng.toFixed(3)}
              </TechnicalId>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {h.incident_count} {h.incident_count === 1 ? "incident" : "incidents"}
            </span>
          </div>
          <RiskScore score={h.risk_score * 100} />
        </div>
      ))}
    </div>
  );
}

export default HotspotGrid;
