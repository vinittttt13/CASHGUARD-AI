"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel, SectionHeader, StatusIndicator } from "@/components/shared/intel-primitives";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { CaseQueueTable } from "@/components/alerts/CaseQueueTable";
import { useToast } from "@/hooks/use-toast";
import { useApiResource } from "@/hooks/useApiResource";
import { acknowledgeAlert, getAlerts } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function SummaryStat({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number | string;
  tone: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3.5">
      <span className="text-[11px] font-medium label-caps text-muted-foreground">{label}</span>
      {loading ? (
        <div className="mt-2 h-6 w-10 animate-pulse rounded bg-surface-overlay" />
      ) : (
        <div className={`mt-1 font-mono text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { data, loading, refetch } = useApiResource(getAlerts, []);
  const clearUnread = useAppStore((s) => s.clearUnread);

  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  const items = data?.items ?? [];
  const count = (p: string) => items.filter((a) => a.priority === p).length;

  const handleBulkAcknowledge = async () => {
    const unacked = items.filter((a) => !a.is_acknowledged);
    if (unacked.length === 0) {
      toast({ title: "Nothing to acknowledge" });
      return;
    }
    await Promise.allSettled(unacked.map((a) => acknowledgeAlert(a.id)));
    toast({
      title: "Alerts acknowledged",
      description: `${unacked.length} alert(s) marked as acknowledged.`,
    });
    refetch();
  };

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
      <SectionHeader
        title="Alert Center"
        description="Live security incident console"
        action={<StatusIndicator state="online" label={`${data?.total ?? 0} active`} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Total Active" value={data?.total ?? 0} tone="text-foreground" loading={loading} />
        <SummaryStat label="Critical" value={count("critical")} tone="text-risk-critical" loading={loading} />
        <SummaryStat label="High" value={count("high")} tone="text-risk-high" loading={loading} />
        <SummaryStat label="Medium" value={count("medium")} tone="text-risk-medium" loading={loading} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-subtle-foreground" />
            <Input
              placeholder="Search alerts by location or type…"
              className="border-border bg-surface-overlay pl-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 border-border bg-surface-raised text-xs">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </Button>
        </div>
        <Button size="sm" onClick={handleBulkAcknowledge} className="gap-1.5 text-xs">
          <CheckCircle className="h-3.5 w-3.5" />
          Acknowledge All
        </Button>
      </div>

      <AlertCenter searchQuery={searchQuery} />

      <Panel title="Case Queue">
        <CaseQueueTable />
      </Panel>
    </div>
  );
}
