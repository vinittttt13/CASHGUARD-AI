"use client";

import { useState } from "react";
import { Activity, AlertCircle, ChevronDown, MapPin, RefreshCw } from "lucide-react";
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useApiResource } from "@/hooks/useApiResource";
import { getComplaints, predictComplaint } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";
import { Panel, StatusIndicator, TechnicalId } from "@/components/shared/intel-primitives";

const CATEGORY_STYLE: Record<string, string> = {
  phishing: "border-secondary/30 bg-secondary/10 text-secondary",
  vishing: "border-risk-analytic/30 bg-risk-analytic/10 text-risk-analytic",
  otp_fraud: "border-risk-critical/30 bg-risk-critical/10 text-risk-critical",
  atm_fraud: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
};
const categoryStyle = (category: string) =>
  CATEGORY_STYLE[category?.toLowerCase()] ?? "border-border bg-surface-overlay text-muted-foreground";

export function ComplaintFeed() {
  const { toast } = useToast();
  const connected = useAppStore((s) => s.socketConnected);
  const { data, error, loading, refetch } = useApiResource(() => getComplaints({ limit: 15 }), []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [predictingId, setPredictingId] = useState<string | null>(null);

  const runPrediction = async (id: string) => {
    setPredictingId(id);
    try {
      const p = await predictComplaint(id);
      toast({
        title: `Threat Triage: ${p.risk_level.toUpperCase()} Risk`,
        description: `${(p.confidence_score * 100).toFixed(1)}% model confidence · ${p.model_name ?? "XGBoost"}`,
      });
    } catch {
      toast({
        title: "Prediction failed",
        description: "Could not execute model inference for this incident.",
        variant: "destructive",
      });
    } finally {
      setPredictingId(null);
    }
  };

  return (
    <Panel
      title="Live incident feed"
      description="Real-time complaint reporting"
      contentClassName="p-0"
      action={
        <StatusIndicator
          state={connected ? "online" : "offline"}
          label={connected ? "Feed connected" : "Feed offline"}
        />
      }
    >
      <div className="max-h-[380px] flex-1 overflow-y-auto scrollbar-thin">
        {loading && <Loading label="Loading incident feed…" />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && data && data.items.length === 0 && (
          <EmptyState label="No active threats" hint="No complaints recorded yet." />
        )}
        {!loading && !error && data && data.items.length > 0 && (
          <div className="flex flex-col divide-y divide-border/70">
            {data.items.map((c) => {
              const ts = c.incident_date || c.created_at;
              const isExpanded = expandedId === c.id;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "cursor-pointer p-3 transition-colors hover:bg-surface-raised/60",
                    isExpanded && "bg-surface-raised/60"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "label-caps rounded border px-1.5 py-0.5 text-[11px] font-medium",
                            categoryStyle(c.complaint_category)
                          )}
                        >
                          {c.complaint_category?.replace(/_/g, " ")}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 text-subtle-foreground" />
                          {c.city || c.district || c.state || "India"}
                        </span>
                      </div>
                      <div className="font-mono text-sm font-semibold text-foreground">
                        {formatCurrency(c.amount_defrauded, c.currency)}
                      </div>
                      <TechnicalId>
                        {formatRelativeTime(ts)} · {c.complaint_number}
                      </TechnicalId>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="label-caps rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {c.status}
                      </span>
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 text-subtle-foreground transition-transform", isExpanded && "rotate-180")}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t border-border/70 pt-3">
                      <p className="mb-3 rounded-md border border-border bg-surface-overlay p-2.5 text-xs leading-relaxed text-muted-foreground">
                        {c.complaint_text}
                      </p>
                      <button
                        type="button"
                        disabled={predictingId === c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          runPrediction(c.id);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {predictingId === c.id ? "Running model inference…" : "Score with CASHGUARD AI"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border/70 p-1.5">
        <button
          type="button"
          onClick={refetch}
          className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh incident stream
        </button>
      </div>
    </Panel>
  );
}
