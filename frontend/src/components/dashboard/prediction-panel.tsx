"use client";

import { AlertCircle, Map, FileText, ShieldAlert } from "lucide-react";
import { cn, formatConfidence } from "@/lib/utils";
import Link from "next/link";
import { normalizeRiskLevel, RISK_META, SeverityBadge } from "@/components/shared/intel-primitives";
import { RiskGauge } from "@/components/shared/risk-gauge";

interface PredictionData {
  id: string;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  confidenceScore?: number;
  locations: { name: string; confidence: number }[];
  features: { name: string; value: number }[];
}

export function PredictionPanel({ data, loading }: { data?: PredictionData; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-overlay" />
        <div className="mt-2 h-20 w-full animate-pulse rounded bg-surface-overlay" />
        <div className="mt-2 h-20 w-full animate-pulse rounded bg-surface-overlay" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface p-8 text-center">
        <AlertCircle className="h-6 w-6 text-subtle-foreground" />
        <p className="label-caps text-sm font-semibold text-foreground">No prediction selected</p>
        <span className="text-xs text-muted-foreground">Select a complaint from the live feed to score it.</span>
      </div>
    );
  }

  const level = normalizeRiskLevel(data.riskLevel);
  const meta = RISK_META[level];

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface">
      <header className="border-b border-border/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <div>
              <h3 className="label-caps text-sm font-semibold text-foreground">
                Why this incident was flagged
              </h3>
              <span className="text-[10px] text-subtle-foreground">XGBoost + Random Forest</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <SeverityBadge level={level} />
            {typeof data.confidenceScore === "number" && (
              <RiskGauge value={data.confidenceScore} size={56} strokeWidth={5} />
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="label-caps text-xs font-semibold text-muted-foreground">
              Predicted cash-out targets
            </h4>
            <span className="text-[10px] text-subtle-foreground">Confidence</span>
          </div>

          <div className="space-y-2">
            {data.locations.slice(0, 4).map((loc, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md border border-border/70 bg-surface-overlay p-2">
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[9px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{loc.name}</span>
                  </div>
                  <span className="shrink-0 font-mono font-semibold text-foreground">
                    {formatConfidence(loc.confidence)}
                  </span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", meta.dot)}
                    style={{ width: `${Math.max(loc.confidence * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.locations.length === 0 && (
              <p className="text-xs text-muted-foreground">No predicted locations returned by the model.</p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 p-4">
        <h4 className="label-caps mb-3 text-xs font-semibold text-muted-foreground">
          Top contributing factors
        </h4>
        <div className="space-y-2.5">
          {data.features.slice(0, 5).map((feat, i) => {
            const isPositive = feat.value >= 0;
            return (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span
                  className={cn("shrink-0 font-mono text-[10px] font-semibold", isPositive ? "text-risk-critical" : "text-risk-low")}
                >
                  {isPositive ? "+" : "−"}
                </span>
                <span className="min-w-0 flex-1 truncate capitalize text-muted-foreground" title={feat.name}>
                  {feat.name.replace(/_/g, " ")}
                </span>
                <div className="flex w-28 shrink-0 items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-overlay">
                    <div
                      className={cn("h-full rounded-full", isPositive ? "bg-risk-critical" : "bg-risk-low")}
                      style={{ width: `${Math.min(Math.abs(feat.value) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] font-semibold text-foreground">
                    {feat.value.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
          {data.features.length === 0 && (
            <p className="text-xs text-muted-foreground">No feature-importance data returned by the model.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border/70 p-3">
        <button
          type="button"
          onClick={() => {
            const mapEl = document.querySelector(".leaflet-container");
            mapEl?.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-overlay"
        >
          <Map className="h-3.5 w-3.5" aria-hidden="true" />
          Focus on map
        </button>
        <Link
          href="/intelligence"
          className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Open dossier
        </Link>
      </div>
    </div>
  );
}
