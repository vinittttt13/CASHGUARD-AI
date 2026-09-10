"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (complaints.loading || prediction.loading) return <Loading label="Scoring latest complaint…" />;
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
    <div className="flex flex-col gap-6">
      <StatsOverview />

      <div className="grid gap-6 md:grid-cols-[60%_40%] xl:grid-cols-[65%_35%]">
        <Card className="flex flex-col min-h-[500px]">
          <CardHeader>
            <CardTitle>Live Predictive Map</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 relative">
            <div className="absolute inset-0 m-6 mt-0 border rounded-md overflow-hidden bg-muted/50">
              <PredictiveMap />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 h-full">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Threat Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <LatestPrediction />
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Recent Complaints</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ComplaintFeed />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
