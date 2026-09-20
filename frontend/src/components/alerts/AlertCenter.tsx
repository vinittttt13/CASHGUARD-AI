"use client";

import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { AlertCard } from "./AlertCard";
import { useApiResource } from "@/hooks/useApiResource";
import { acknowledgeAlert, getAlerts } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";
import { cn } from "@/lib/utils";
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
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border/70 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Alert Feed</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <Filter className="mr-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
          {(["All", "Critical", "High", "Medium", "Low"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-raised text-muted-foreground hover:bg-surface-overlay hover:text-foreground"
              )}
            >
              {p}
              {p !== "All" && (
                <span className="ml-1.5 font-mono text-[10px] opacity-80">
                  {alerts.filter((a) => a.priority === p).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 scrollbar-thin">
        {loading && <Loading label="Loading alerts…" />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState label="No active threats" hint="No alerts match the current filters." />
        )}
        {!loading &&
          !error &&
          filtered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onAcknowledge={() => handleAcknowledge(alert.id)} />
          ))}
      </div>

      <div className="border-t border-border/70 p-2.5 text-center text-xs text-subtle-foreground">
        Showing {filtered.length} of {alerts.length} alerts
      </div>
    </div>
  );
}
