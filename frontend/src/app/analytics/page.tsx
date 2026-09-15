"use client";

import { useMemo } from "react";
import { Panel, SectionHeader } from "@/components/shared/intel-primitives";

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
    <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
      <SectionHeader title="Advanced Analytics" description={`Last ${DAYS} days`} />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Panel title="Crime Volume Time Series" className="md:col-span-2" contentClassName="h-[300px]">
          {trends.loading && <Loading />}
          {trends.error && <ErrorState error={trends.error} onRetry={trends.refetch} />}
          {!trends.loading && !trends.error && <TimeSeriesChart data={timeSeries} />}
        </Panel>

        <Panel title="Model Confidence" contentClassName="h-[300px] flex items-center justify-center">
          {alerts.loading ? (
            <Loading />
          ) : alerts.error ? (
            <ErrorState error={alerts.error} onRetry={alerts.refetch} />
          ) : (
            <ConfidenceGauge score={confidence.score} sampleSize={confidence.sampleSize} />
          )}
        </Panel>

        <Panel title="Feature Importance" description="Top contributing factors (SHAP)" contentClassName="h-[300px]">
          {prediction.loading || complaints.loading ? (
            <Loading />
          ) : radarData.length === 0 ? (
            <EmptyState
              label="No SHAP data."
              hint="Train the models — the heuristic fallback has no feature importance."
            />
          ) : (
            <FeatureImportanceRadar data={radarData} />
          )}
        </Panel>

        <Panel title="Geographic Distribution" className="md:col-span-2" contentClassName="h-[300px]">
          {stats.loading ? (
            <Loading />
          ) : stats.error ? (
            <ErrorState error={stats.error} onRetry={stats.refetch} />
          ) : geoData.length === 0 ? (
            <EmptyState label="No complaints." hint="No complaints recorded yet." />
          ) : (
            <GeographicDistribution data={geoData} />
          )}
        </Panel>

        <Panel title="Predicted Hotspots Database" description="Ranked cash-out cluster registry" className="md:col-span-3">
          {hotspots.loading ? (
            <Loading />
          ) : hotspots.error ? (
            <ErrorState error={hotspots.error} onRetry={hotspots.refetch} />
          ) : (
            <HotspotTable hotspots={hotspots.data ?? []} />
          )}
        </Panel>

        <Panel title="AML Transaction Risk Analysis" className="md:col-span-3">
          <AmlTransactionPanel />
        </Panel>
      </div>
    </div>
  );
}
