"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";
import { SeverityBadge } from "@/components/shared/intel-primitives";
import { useApiResource } from "@/hooks/useApiResource";
import { useToast } from "@/hooks/use-toast";
import { getComplaints, updateComplaint } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import type { Complaint, ComplaintStatus } from "@/types";

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  predicted: "Predicted",
  resolved: "Resolved",
};

const STATUS_BADGE: Record<ComplaintStatus, string> = {
  pending: "border-border text-muted-foreground",
  processing: "border-foreground/30 bg-foreground/10 text-foreground",
  predicted: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
  resolved: "border-risk-low/30 bg-risk-low/10 text-risk-low",
};

const STATUS_FILTERS: Array<ComplaintStatus | "all"> = ["all", "pending", "processing", "predicted", "resolved"];

// A case's severity here is derived from the amount defrauded, since
// complaints don't carry a separate risk score — this is a queue-triage
// view, not the AML/hotspot risk models.
function severityFor(amount: number): "critical" | "high" | "medium" | "low" {
  if (amount >= 1000000) return "critical";
  if (amount >= 500000) return "high";
  if (amount >= 50000) return "medium";
  return "low";
}

export function CaseQueueTable({ onReview }: { onReview?: (c: Complaint) => void }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiResource(
    () =>
      getComplaints({
        limit: 50,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    [statusFilter],
  );

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.complaint_number.toLowerCase().includes(q) ||
        (c.bank_name ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.state ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const handleStatusChange = async (c: Complaint, status: ComplaintStatus) => {
    setUpdatingId(c.id);
    try {
      await updateComplaint(c.id, { status });
      toast({ title: "Case updated", description: `${c.complaint_number} → ${STATUS_LABEL[status]}` });
      refetch();
    } catch {
      toast({
        title: "Update failed",
        description: "Could not update case status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-subtle-foreground" />
          <input
            className="flex h-8 w-full rounded-md border border-border bg-surface-overlay py-1 pl-8 pr-3 text-xs text-foreground placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Search by case #, bank, city, or state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-raised text-muted-foreground hover:bg-surface-overlay hover:text-foreground"
              )}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading label="Loading case queue…" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState label="No cases found" hint="No cases match the current filters." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Case ID</th>
                <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Received</th>
                <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Category</th>
                <th className="px-3 py-2 text-right font-medium label-caps text-muted-foreground">Amount</th>
                <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Severity</th>
                <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Jurisdiction</th>
                <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left font-medium label-caps text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const severity = severityFor(c.amount_defrauded);
                const isUpdating = updatingId === c.id;
                return (
                  <tr key={c.id} className="border-b border-border/70 last:border-0 hover:bg-surface-raised/60">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-foreground">{c.complaint_number}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{c.complaint_category.replace(/_/g, " ")}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-medium text-foreground">
                      {formatCurrency(c.amount_defrauded)}
                    </td>
                    <td className="px-3 py-2">
                      <SeverityBadge level={severity} size="sm" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {[c.city, c.district, c.state].filter(Boolean).join(", ") || "Unknown"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium label-caps", STATUS_BADGE[c.status])}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {onReview && (
                          <button
                            type="button"
                            onClick={() => onReview(c)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Review
                          </button>
                        )}
                        {c.status !== "resolved" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(c, "resolved")}
                            className="inline-flex items-center gap-1 text-xs font-medium text-risk-low hover:underline disabled:opacity-50"
                          >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CaseQueueTable;
