"use client";

import { Download, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { HotspotGrid } from "@/components/intelligence/hotspot-grid";
import { TrendChart } from "@/components/intelligence/trend-chart";
import { StateBreakdown } from "@/components/intelligence/state-breakdown";
import { FraudRingGraph } from "@/components/intelligence/fraud-ring-graph";
import { CaseDossierModal } from "@/components/intelligence/case-dossier-modal";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";

import { useApiResource } from "@/hooks/useApiResource";
import { useState } from "react";
import {
  getFraudRings,
  getIntelligenceReport,
  getTrends,
  intelligenceReportExportUrl,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const DAYS = 7;

export default function IntelligenceReportPage() {
  const [dossierOpen, setDossierOpen] = useState(false);
  const report = useApiResource(() => getIntelligenceReport(DAYS), []);
  const trends = useApiResource(() => getTrends(30), []);
  const fraudRings = useApiResource(() => getFraudRings(30), []);
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Intelligence Report
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentDate} · last {DAYS} days
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              report.refetch();
              trends.refetch();
              fraudRings.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" className="gap-2" asChild>
            <a href={intelligenceReportExportUrl(DAYS)} download>
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </Button>
          <Button variant="default" size="sm" className="gap-2" onClick={() => setDossierOpen(true)}>
            <FileText className="h-4 w-4" /> Generate Police Dossier
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
          <CardDescription>
            Automated threat assessment generated from the last {DAYS} days of
            records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          {report.loading && <Loading />}
          {report.error && (
            <ErrorState error={report.error} onRetry={report.refetch} />
          )}
          {report.data && (
            <>
              <p>{report.data.summary}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
                <Stat
                  label="Complaints"
                  value={report.data.total_complaints.toLocaleString()}
                />
                <Stat
                  label="Total defrauded"
                  value={formatCurrency(report.data.total_defrauded_inr)}
                />
                <Stat
                  label="Active hotspots"
                  value={report.data.active_hotspots.length}
                />
                <Stat
                  label="Priority alerts"
                  value={report.data.high_priority_alerts.length}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Primary Threat Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {trends.loading ? (
              <Loading />
            ) : trends.error ? (
              <ErrorState error={trends.error} onRetry={trends.refetch} />
            ) : (
              <TrendChart trends={trends.data} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>State-wise Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {report.loading ? (
              <Loading />
            ) : (
              <StateBreakdown breakdown={report.data?.state_wise_breakdown} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identified Hotspots</CardTitle>
          <CardDescription>
            Highest-risk cash-out clusters in the reporting window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.loading ? (
            <Loading />
          ) : (
            <HotspotGrid hotspots={report.data?.active_hotspots} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Syndicate & Fraud Ring Network Analysis</CardTitle>
          <CardDescription>
            Graph co-occurrence clusters identifying coordinated mule accounts, banking nexus, and criminal rings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fraudRings.loading ? (
            <Loading label="Running graph analytics on complaint networks…" />
          ) : fraudRings.error ? (
            <ErrorState error={fraudRings.error} onRetry={fraudRings.refetch} />
          ) : (
            <FraudRingGraph rings={fraudRings.data ?? []} />
          )}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle>Actionable Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          {report.data && report.data.recommendations.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {report.data.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <EmptyState label="No recommendations." />
          )}
        </CardContent>
      </Card>

      <CaseDossierModal
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        report={report.data}
        fraudRings={fraudRings.data ?? []}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
