"use client";

import React, { useState } from "react";
import { Activity, AlertCircle, ChevronDown, MapPin } from "lucide-react";
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useApiResource } from "@/hooks/useApiResource";
import { getComplaints, predictComplaint } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";

const categoryColor = (category: string) => {
  switch (category) {
    case "phishing":
      return "bg-blue-100 text-blue-800";
    case "vishing":
      return "bg-purple-100 text-purple-800";
    case "otp_fraud":
      return "bg-rose-100 text-rose-800";
    case "atm_fraud":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function ComplaintFeed() {
  const { toast } = useToast();
  const connected = useAppStore((s) => s.socketConnected);
  const { data, error, loading, refetch } = useApiResource(
    () => getComplaints({ limit: 15 }),
    [],
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [predictingId, setPredictingId] = useState<string | null>(null);

  const runPrediction = async (id: string) => {
    setPredictingId(id);
    try {
      const p = await predictComplaint(id);
      toast({
        title: `Prediction: ${p.risk_level.toUpperCase()} risk`,
        description: `${(p.confidence_score * 100).toFixed(0)}% confidence · model ${
          p.model_name ?? "n/a"
        }`,
      });
    } catch {
      toast({
        title: "Prediction failed",
        description: "Could not run the model for this complaint.",
        variant: "destructive",
      });
    } finally {
      setPredictingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 pb-3 border-b flex items-center justify-between">
        <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Live Complaint Feed
        </h3>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            connected
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500",
          )}
        >
          {connected ? "Connected" : "Offline"}
        </span>
      </div>

      <div className="p-0 flex-1 overflow-y-auto">
        {loading && <Loading label="Loading complaints…" />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && data && data.items.length === 0 && (
          <EmptyState label="No complaints yet." hint="Seed the database to see data." />
        )}
        {!loading && !error && data && data.items.length > 0 && (
          <div className="flex flex-col">
            {data.items.map((c) => {
              const ts = c.incident_date || c.created_at;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "border-b last:border-0 p-4 transition-all hover:bg-muted/50 cursor-pointer",
                    expandedId === c.id && "bg-muted/30",
                  )}
                  onClick={() =>
                    setExpandedId(expandedId === c.id ? null : c.id)
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            categoryColor(c.complaint_category),
                          )}
                        >
                          {c.complaint_category}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.city || c.district || c.state || "Unknown"}
                        </span>
                      </div>
                      <div className="font-medium text-sm">
                        {formatCurrency(c.amount_defrauded, c.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(ts)} · {c.complaint_number}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border border-muted-foreground/20 text-muted-foreground">
                        {c.status}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          expandedId === c.id && "rotate-180",
                        )}
                      />
                    </div>
                  </div>

                  {expandedId === c.id && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      <p className="text-muted-foreground mb-3">
                        {c.complaint_text}
                      </p>
                      <button
                        disabled={predictingId === c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          runPrediction(c.id);
                        }}
                        className="flex items-center justify-center w-full gap-2 bg-primary text-primary-foreground text-xs font-medium py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-60"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {predictingId === c.id
                          ? "Running…"
                          : "Run Prediction Model"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 border-t">
        <button
          onClick={refetch}
          className="w-full text-center text-sm text-primary font-medium py-1 hover:underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
