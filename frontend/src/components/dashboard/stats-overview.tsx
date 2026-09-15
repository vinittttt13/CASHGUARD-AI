"use client";

import { Activity, ShieldAlert, Crosshair, Cpu } from "lucide-react";
import { useApiResource } from "@/hooks/useApiResource";
import { getAlerts, getComplaintStats, getHotspots, getModelStatus } from "@/lib/api";
import { ErrorState } from "@/components/shared/states";
import { MetricCard } from "@/components/shared/intel-primitives";

export function StatsOverview() {
  const stats = useApiResource(getComplaintStats, []);
  const alerts = useApiResource(getAlerts, []);
  const hotspots = useApiResource(getHotspots, []);
  const model = useApiResource(getModelStatus, []);

  const error = stats.error || alerts.error || hotspots.error;

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          stats.refetch();
          alerts.refetch();
          hotspots.refetch();
        }}
      />
    );
  }

  const totalComplaints = stats.data
    ? Object.values(stats.data.by_status).reduce((a, b) => a + b, 0)
    : undefined;
  const activeAlerts = alerts.data?.total;
  const unacked = alerts.data?.items.filter((a) => !a.is_acknowledged).length ?? 0;
  const hotspotCount = hotspots.data?.length;
  const accuracy = model.data?.metrics?.metrics?.test_accuracy;
  const modelVersion = model.data?.manifest?.version ?? model.data?.metrics?.version;
  const modelsLoaded = model.data?.total_loaded;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Complaints"
        value={totalComplaints !== undefined ? totalComplaints.toLocaleString() : "—"}
        icon={Activity}
        tone="system"
        meta="Across all jurisdictions"
      />
      <MetricCard
        label="Active Threats"
        value={activeAlerts !== undefined ? activeAlerts : "—"}
        icon={ShieldAlert}
        tone={unacked > 0 ? "critical" : "low"}
        meta={`${unacked} unacknowledged`}
      />
      <MetricCard
        label="Monitored Hotspots"
        value={hotspotCount !== undefined ? hotspotCount : "—"}
        icon={Crosshair}
        tone="medium"
        meta="High-risk ATM clusters"
      />
      <MetricCard
        label="Model Confidence"
        value={accuracy !== undefined ? `${(accuracy * 100).toFixed(1)}%` : "—"}
        icon={Cpu}
        tone="system"
        meta={modelVersion ? `v${modelVersion} · ${modelsLoaded ?? 0} loaded` : undefined}
      />
    </div>
  );
}
