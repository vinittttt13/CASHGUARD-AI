"use client";

import React, { useMemo, useState } from "react";
import { Filter, ShieldAlert } from "lucide-react";
import { AlertCard } from "./AlertCard";
import { useApiResource } from "@/hooks/useApiResource";
import { acknowledgeAlert, getAlerts } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";
import type { Alert as ApiAlert } from "@/types";

type Priority = "All" | "Critical" | "High" | "Medium" | "Low";

const titleCasePriority = (p: string) =>
  (p.charAt(0).toUpperCase() + p.slice(1)) as
    | "Critical"
    | "High"
    | "Medium"
    | "Low";

function toCardAlert(a: ApiAlert) {
  const loc =
    a.latitude != null && a.longitude != null
      ? `${a.latitude.toFixed(3)}, ${a.longitude.toFixed(3)}`
      : a.alert_type;
  return {
    id: a.id,
    priority: titleCasePriority(a.priority),
    type: a.alert_type,
    title: a.title,
    description: a.description ?? "",
    location: loc,
    timestamp: a.created_at,
    acknowledged: a.is_acknowledged,
    acknowledgedBy: a.acknowledged_by ?? undefined,
  };
}

export function AlertCenter({ searchQuery = "" }: { searchQuery?: string }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Priority>("All");
  const { data, error, loading, refetch } = useApiResource(getAlerts, []);
  const liveAlerts = useAppStore((s) => s.alerts) as ApiAlert[];

  const alerts = useMemo(() => {
    const fetched = data?.items ?? [];
    const byId = new Map<string, ApiAlert>();
    // WS-delivered alerts first, then fetched — de-dupe by id.
    for (const a of [...liveAlerts, ...fetched]) {
      if (a && a.id && !byId.has(a.id)) byId.set(a.id, a);
    }
    return Array.from(byId.values()).map(toCardAlert);
  }, [data, liveAlerts]);

  const filtered = alerts.filter((a) => {
    if (filter !== "All" && a.priority !== filter) return false;
    if (
      searchQuery &&
      !a.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAlert(id);
      toast({ title: "Alert acknowledged" });
      refetch();
    } catch {
      toast({ title: "Failed to acknowledge", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Alert Center</h2>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-muted-foreground mr-1 flex-shrink-0" />
          {(["All", "Critical", "High", "Medium", "Low"] as Priority[]).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  filter === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {p}
                {p !== "All" && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                    {alerts.filter((a) => a.priority === p).length}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
        {loading && <Loading label="Loading alerts…" />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && filtered.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
            <p>No alerts match your current filters.</p>
          </div>
        )}
        {!loading &&
          !error &&
          filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={() => handleAcknowledge(alert.id)}
            />
          ))}
      </div>

      <div className="p-3 border-t bg-card text-xs text-center text-muted-foreground">
        Showing {filtered.length} of {alerts.length} alerts
      </div>
    </div>
  );
}
