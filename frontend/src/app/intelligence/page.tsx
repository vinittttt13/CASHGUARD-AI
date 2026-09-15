"use client";

import { Download, Loader2, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, SectionHeader, TechnicalId } from "@/components/shared/intel-primitives";

import { HotspotGrid } from "@/components/intelligence/hotspot-grid";
import { TrendChart } from "@/components/intelligence/trend-chart";
import { StateBreakdown } from "@/components/intelligence/state-breakdown";
import { FraudRingGraph } from "@/components/intelligence/fraud-ring-graph";
import { CaseDossierModal } from "@/components/intelligence/case-dossier-modal";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";

import { useApiResource } from "@/hooks/useApiResource";
import { useState } from "react";
import {
  exportIntelligenceReport,
  getFraudRings,
  getIntelligenceReport,
  getTrends,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

const DAYS = 7;

export default function IntelligenceReportPage() {
  const { toast } = useToast();
  const [dossierOpen, setDossierOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-10">
      <SectionHeader
        title="Intelligence Report"
        description={`${currentDate} · last ${DAYS} days`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border bg-surface-raised text-xs"
              onClick={() => {
                report.refetch();
                trends.refetch();
                fraudRings.refetch();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await exportIntelligenceReport(DAYS);
                  toast({
                    title: "Report exported",
                    description: "The CSV download has started.",
                  });
                } catch {
                  toast({
                    variant: "destructive",
                    title: "Export failed",
                    description: "Could not generate the report. Please try again.",
                  });
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export CSV
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDossierOpen(true)}>
              <FileText className="h-3.5 w-3.5" /> Generate Police Dossier
            </Button>
          </div>
        }
      />

      <Panel
        title="Executive Summary"
        description={`Automated threat assessment generated from the last ${DAYS} days of records`}
      >
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          {report.loading && <Loading />}
          {report.error && <ErrorState error={report.error} onRetry={report.refetch} />}
          {report.data && (
            <>
              <p className="text-foreground">{report.data.summary}</p>
              <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                <Stat label="Complaints" value={report.data.total_complaints.toLocaleString()} />
                <Stat label="Total Defrauded" value={formatCurrency(report.data.total_defrauded_inr)} tone="text-risk-critical" />
                <Stat label="Active Hotspots" value={report.data.active_hotspots.length} />
                <Stat label="Priority Alerts" value={report.data.high_priority_alerts.length} tone="text-risk-medium" />
              </div>
            </>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Primary Threat Trends" description="Primary threat volume, 30-day window" contentClassName="h-[300px]">
          {trends.loading ? (
            <Loading />
          ) : trends.error ? (
            <ErrorState error={trends.error} onRetry={trends.refetch} />
          ) : (
            <TrendChart trends={trends.data} />
          )}
        </Panel>

        <Panel title="State-wise Breakdown" contentClassName="h-[300px]">
          {report.loading ? <Loading /> : <StateBreakdown breakdown={report.data?.state_wise_breakdown} />}
        </Panel>
      </div>

      <Panel title="Identified Hotspots" description="Highest-risk cash-out clusters in the reporting window">
        {report.loading ? <Loading /> : <HotspotGrid hotspots={report.data?.active_hotspots} />}
      </Panel>

      <Panel
        title="Syndicate & Fraud Ring Network Analysis"
        description="Graph co-occurrence clusters identifying coordinated mule accounts, banking nexus, and criminal rings"
      >
        {fraudRings.loading ? (
          <Loading label="Running graph analytics on complaint networks…" />
        ) : fraudRings.error ? (
          <ErrorState error={fraudRings.error} onRetry={fraudRings.refetch} />
        ) : (
          <FraudRingGraph rings={fraudRings.data ?? []} />
        )}
      </Panel>

      <Panel title="Actionable Recommendations" className="border-l-2 border-l-primary">
        {report.data && report.data.recommendations.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {report.data.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : (
          <EmptyState label="No recommendations." hint="No actions generated for this window." />
        )}
      </Panel>

      <CaseDossierModal
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        report={report.data}
        fraudRings={fraudRings.data ?? []}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-overlay p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-base font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
