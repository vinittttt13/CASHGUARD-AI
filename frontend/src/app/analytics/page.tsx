"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { TimeSeriesChart } from "@/components/analytics/time-series-chart";
import { GeographicDistribution } from "@/components/analytics/geographic-distribution";
import { ConfidenceGauge } from "@/components/analytics/confidence-gauge";
import { FeatureImportanceRadar } from "@/components/analytics/feature-importance-radar";
import { HotspotTable } from "@/components/analytics/hotspot-table";
import { AmlTransactionPanel } from "@/components/analytics/aml-transaction-panel";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";

import { useApiResource } from "@/hooks/useApiResource";
import {
  getAlerts,
  getComplaints,
  getComplaintStats,
  getHotspots,
  getTrends,
  predictComplaint,
} from "@/lib/api";

const DAYS = 30;

function riskBucket(pct: number): "Critical" | "High" | "Medium" | "Low" {
  if (pct >= 0.4) return "Critical";
  if (pct >= 0.25) return "High";
  if (pct >= 0.1) return "Medium";
  return "Low";
}

export default function AnalyticsPage() {
  const trends = useApiResource(() => getTrends(DAYS), []);
  const stats = useApiResource(getComplaintStats, []);
  const alerts = useApiResource(getAlerts, []);
  const hotspots = useApiResource(getHotspots, []);
  const complaints = useApiResource(() => getComplaints({ limit: 1 }), []);

  const newestId = complaints.data?.items[0]?.id;
  const prediction = useApiResource(
    () => predictComplaint(newestId as string),
    [newestId],
    { enabled: Boolean(newestId) },
  );

  const timeSeries = useMemo(() => {
    if (!trends.data) return [];
    const actual = trends.data.daily_counts.map((d) => ({
      date: d.date,
      actual: d.count as number | null,
      forecast: null as number | null,
    }));
    const forecast = trends.data.forecast.map((d) => ({
      date: d.date,
      actual: null as number | null,
      forecast: d.predicted_count as number | null,
    }));
    return [...actual, ...forecast];
  }, [trends.data]);

  const geoData = useMemo(() => {
    if (!stats.data) return [];
    const entries = Object.entries(stats.data.by_state);
    const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
    return entries
      .map(([state, count]) => ({
        state,
        count,
        riskLevel: riskBucket(count / total),
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats.data]);

  const confidence = useMemo(() => {
    const items = alerts.data?.items ?? [];
    const scores = items
      .map((a) => a.confidence_score)
      .filter((s): s is number => s != null);
    const mean = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    return { score: mean * 100, sampleSize: items.length };
  }, [alerts.data]);

  const radarData = useMemo(() => {
    const fi = prediction.data?.feature_importance ?? [];
    return fi.slice(0, 8).map((f) => ({
      feature: f.feature,
      current: Math.abs(f.importance),
      average: Math.abs(f.importance) * 0.8,
    }));
  }, [prediction.data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Advanced Analytics</h2>
        <span className="text-sm text-muted-foreground">
          Last {DAYS} days
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Crime Volume Time Series</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {trends.loading && <Loading />}
            {trends.error && (
              <ErrorState error={trends.error} onRetry={trends.refetch} />
            )}
            {!trends.loading && !trends.error && (
              <TimeSeriesChart data={timeSeries} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Confidence</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {alerts.loading ? (
              <Loading />
            ) : alerts.error ? (
              <ErrorState error={alerts.error} onRetry={alerts.refetch} />
            ) : (
              <ConfidenceGauge
                score={confidence.score}
                sampleSize={confidence.sampleSize}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature Importance</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {prediction.loading || complaints.loading ? (
              <Loading />
            ) : radarData.length === 0 ? (
              <EmptyState
                label="No SHAP data."
                hint="Train the models (heuristic fallback has no feature importance)."
              />
            ) : (
              <FeatureImportanceRadar data={radarData} />
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.loading ? (
              <Loading />
            ) : stats.error ? (
              <ErrorState error={stats.error} onRetry={stats.refetch} />
            ) : geoData.length === 0 ? (
              <EmptyState label="No complaints." />
            ) : (
              <GeographicDistribution data={geoData} />
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Predicted Hotspots Database</CardTitle>
          </CardHeader>
          <CardContent>
            {hotspots.loading ? (
              <Loading />
            ) : hotspots.error ? (
              <ErrorState error={hotspots.error} onRetry={hotspots.refetch} />
            ) : (
              <HotspotTable hotspots={hotspots.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>AML Transaction Risk Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <AmlTransactionPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
