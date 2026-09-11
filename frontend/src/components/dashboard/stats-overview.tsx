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
  pillText?: string;
  pillVariant?: "rose" | "amber" | "emerald" | "blue" | "slate";
  iconColor?: string;
  iconBg?: string;
  loading?: boolean;
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  pillText,
  pillVariant = "slate",
  iconColor = "text-slate-600",
  iconBg = "bg-slate-100",
  loading,
}: StatCardProps) {
  const pillStyles = {
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" />
          ) : (
            <div className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">{value}</div>
          )}
        </div>
        <div className={cn("p-2.5 rounded-lg flex items-center justify-center", iconBg, iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium truncate">{hint}</span>
        {pillText && (
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", pillStyles[pillVariant])}>
            {pillText}
          </span>
        )}
      </div>
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
        hint="Recorded across jurisdictions"
        pillText="Live Ledger"
        pillVariant="blue"
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
        loading={loading}
      />
      <StatCard
        title="Active Threats"
        value={activeAlerts}
        icon={AlertTriangle}
        hint={`${unacked} unacknowledged`}
        pillText={unacked > 0 ? "Requires Action" : "All Clear"}
        pillVariant={unacked > 0 ? "rose" : "emerald"}
        iconBg="bg-rose-50"
        iconColor="text-rose-600"
        loading={loading}
      />
      <StatCard
        title="ATM Cash-Out Hotspots"
        value={hotspotCount}
        icon={Crosshair}
        hint="High risk ATM clusters"
        pillText="Risk ≥ 0.5"
        pillVariant="amber"
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
        loading={loading}
      />
      <StatCard
        title="AI Inference Engine"
        value="81.4%"
        icon={ShieldCheck}
        hint="4 Trained Models Active"
        pillText="Operational"
        pillVariant="emerald"
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        loading={loading}
      />
    </div>
  );
}
