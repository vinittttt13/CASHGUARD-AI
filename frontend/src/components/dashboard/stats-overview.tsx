"use client";

import React from "react";
import { Activity, AlertTriangle, Crosshair, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiResource } from "@/hooks/useApiResource";
import { getAlerts, getComplaintStats, getHotspots } from "@/lib/api";
import { ErrorState } from "@/components/shared/states";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  hint: string;
  alertLevel?: "normal" | "warning" | "critical";
  loading?: boolean;
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  alertLevel = "normal",
  loading,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "p-6 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col",
        alertLevel === "warning" && "border-amber-300 bg-amber-50/50",
        alertLevel === "critical" && "border-red-300 bg-red-50/50",
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <h3 className="tracking-tight text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        <Icon
          className={cn(
            "w-4 h-4 text-muted-foreground",
            alertLevel === "warning" && "text-amber-500",
            alertLevel === "critical" && "text-red-500",
          )}
        />
      </div>
      {loading ? (
        <div className="mt-1 h-8 w-20 animate-pulse rounded bg-muted" />
      ) : (
        <div className="text-2xl font-bold mt-1">{value}</div>
      )}
      <div className="mt-2 truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

export function StatsOverview() {
  const stats = useApiResource(getComplaintStats, []);
  const alerts = useApiResource(getAlerts, []);
  const hotspots = useApiResource(getHotspots, []);

  const error = stats.error || alerts.error || hotspots.error;
  const loading = stats.loading || alerts.loading || hotspots.loading;

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
    : 0;
  const activeAlerts = alerts.data?.total ?? 0;
  const unacked =
    alerts.data?.items.filter((a) => !a.is_acknowledged).length ?? 0;
  const hotspotCount = hotspots.data?.length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Complaints"
        value={totalComplaints.toLocaleString()}
        icon={Activity}
        hint="all statuses"
        loading={loading}
      />
      <StatCard
        title="Active Alerts"
        value={activeAlerts}
        icon={AlertTriangle}
        hint={`${unacked} unacknowledged`}
        alertLevel={activeAlerts > 10 ? "critical" : "normal"}
        loading={loading}
      />
      <StatCard
        title="High-Risk Hotspots"
        value={hotspotCount}
        icon={Crosshair}
        hint="risk score ≥ 0.5"
        alertLevel={hotspotCount > 5 ? "warning" : "normal"}
        loading={loading}
      />
      <StatCard
        title="Acknowledged"
        value={activeAlerts - unacked}
        icon={ShieldCheck}
        hint="of active alerts"
        loading={loading}
      />
    </div>
  );
}
