"use client";

import { MapPin } from "lucide-react";
import { PredictiveMap } from "@/components/dashboard/predictive-map";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { ComplaintFeed } from "@/components/dashboard/complaint-feed";
import { PredictionPanel } from "@/components/dashboard/prediction-panel";
import { useApiResource } from "@/hooks/useApiResource";
import { getComplaints, predictComplaint } from "@/lib/api";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";

const titleCase = (s: string) =>
  (s.charAt(0).toUpperCase() + s.slice(1)) as
    | "Critical"
    | "High"
    | "Medium"
    | "Low";

function LatestPrediction() {
  const complaints = useApiResource(() => getComplaints({ limit: 1 }), []);
  const newestId = complaints.data?.items[0]?.id;

  const prediction = useApiResource(
    () => predictComplaint(newestId as string),
    [newestId],
    { enabled: Boolean(newestId) },
  );

  if (complaints.loading || prediction.loading) return <Loading label="Scoring incident telemetry…" />;
  if (complaints.error)
    return <ErrorState error={complaints.error} onRetry={complaints.refetch} />;
  if (!newestId) return <EmptyState label="No complaints to score." />;
  if (prediction.error)
    return <ErrorState error={prediction.error} onRetry={prediction.refetch} />;
  if (!prediction.data) return <EmptyState label="No prediction available." />;

  const p = prediction.data;
  return (
    <PredictionPanel
      data={{
        id: p.id,
        riskLevel: titleCase(p.risk_level),
        locations: (p.predicted_locations ?? []).map((l) => ({
          name: l.atm_name ?? `Cluster ${p.hotspot_cluster_id ?? "?"}`,
          confidence: l.confidence,
        })),
        features: (p.feature_importance ?? []).map((f) => ({
          name: f.feature,
          value: f.importance,
        })),
      }}
    />
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* 4-KPI Telemetry Bar */}
      <StatsOverview />

      {/* Main Command Center Grid */}
      <div className="grid gap-6 lg:grid-cols-[62%_38%] xl:grid-cols-[64%_36%] items-start">
        {/* Left Column: Geospatial Operations Map */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col min-h-[660px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 leading-tight">Geospatial Threat & Hotspot Map</h3>
                <span className="text-[10px] text-slate-400 font-medium">India Cybercrime Operations Corridor</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                ATM Hotspots Active
              </span>
            </div>
          </div>
          <div className="flex-1 relative w-full min-h-[600px]">
            <div className="absolute inset-0">
              <PredictiveMap />
            </div>
          </div>
        </div>

        {/* Right Column: Threat Triage & Live Incident Feed */}
        <div className="flex flex-col gap-6">
          <LatestPrediction />
          <ComplaintFeed />
        </div>
      </div>
    </div>
  );
}
