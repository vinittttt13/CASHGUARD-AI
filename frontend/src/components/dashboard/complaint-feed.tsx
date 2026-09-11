"use client";

import React, { useState } from "react";
import { Activity, AlertCircle, ChevronDown, MapPin, RefreshCw } from "lucide-react";
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useApiResource } from "@/hooks/useApiResource";
import { getComplaints, predictComplaint } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";

const categoryColor = (category: string) => {
  switch (category?.toLowerCase()) {
    case "phishing":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "vishing":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "otp_fraud":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "atm_fraud":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
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
        title: `Threat Triage: ${p.risk_level.toUpperCase()} Risk`,
        description: `${(p.confidence_score * 100).toFixed(1)}% AI confidence score · ${p.model_name ?? "XGBoost"}`,
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
    <div className="flex flex-col h-full rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">Live Cybercrime Ledger</h3>
            <span className="text-[10px] text-slate-400 font-medium">Real-time incident reporting</span>
          </div>
        </div>
        <span
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1.5",
            connected
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-50 text-slate-500 border-slate-200",
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400")}></span>
          {connected ? "Feed Connected" : "Feed Offline"}
        </span>
      </div>

      <div className="p-0 flex-1 overflow-y-auto max-h-[380px]">
        {loading && <Loading label="Loading cybercrime feed…" />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && data && data.items.length === 0 && (
          <EmptyState label="No complaints recorded yet." hint="Seed the database to see live data." />
        )}
        {!loading && !error && data && data.items.length > 0 && (
          <div className="flex flex-col divide-y divide-slate-100">
            {data.items.map((c) => {
              const ts = c.incident_date || c.created_at;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "p-3.5 transition-colors hover:bg-slate-50 cursor-pointer",
                    expandedId === c.id && "bg-slate-50/80",
                  )}
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                            categoryColor(c.complaint_category),
                          )}
                        >
                          {c.complaint_category}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {c.city || c.district || c.state || "India"}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 mt-0.5">
                        {formatCurrency(c.amount_defrauded, c.currency)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {formatRelativeTime(ts)} · {c.complaint_number}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {c.status}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-slate-400 transition-transform",
                          expandedId === c.id && "rotate-180",
                        )}
                      />
                    </div>
                  </div>

                  {expandedId === c.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <p className="mb-3 leading-relaxed bg-white p-2.5 rounded-md border border-slate-200">
                        {c.complaint_text}
                      </p>
                      <button
                        type="button"
                        disabled={predictingId === c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          runPrediction(c.id);
                        }}
                        className="flex items-center justify-center w-full gap-2 bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-xs"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {predictingId === c.id
                          ? "Running ML Inference Pipeline…"
                          : "Score with CashGuard AI"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={refetch}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium py-1.5 hover:text-slate-900 transition-colors"
        >
          <RefreshCw className="w-3 h-3 text-slate-400" />
          Refresh Incident Stream
        </button>
      </div>
    </div>
  );
}
