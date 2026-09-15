"use client";

import { Radar } from "lucide-react";
import { PredictiveMap } from "@/components/dashboard/predictive-map";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { ComplaintFeed } from "@/components/dashboard/complaint-feed";
import { PredictionPanel } from "@/components/dashboard/prediction-panel";
import { useApiResource } from "@/hooks/useApiResource";
import { getComplaints, predictComplaint } from "@/lib/api";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";
import { SectionHeader } from "@/components/shared/intel-primitives";

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
    <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
      <SectionHeader
        title="Operations Overview"
        description="What is happening right now across monitored jurisdictions"
      />

      <StatsOverview />

      <div className="grid items-start gap-5 lg:grid-cols-[62%_38%] xl:grid-cols-[64%_36%]">
        <div className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Radar className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Live Threat Map</h3>
                <span className="text-[10px] text-subtle-foreground">India cybercrime operations corridor</span>
              </div>
            </div>
          </div>
          <div className="relative min-h-[560px] flex-1">
            <div className="absolute inset-0">
              <PredictiveMap />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <LatestPrediction />
          <ComplaintFeed />
        </div>
      </div>
    </div>
  );
}
