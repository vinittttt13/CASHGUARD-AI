"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { EmptyState, ErrorState, Loading } from "@/components/shared/states";
import { useApiResource } from "@/hooks/useApiResource";
import { useToast } from "@/hooks/use-toast";
import { getComplaints, updateComplaint } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Complaint, ComplaintStatus } from "@/types";

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  predicted: "Predicted",
  resolved: "Resolved",
};

const STATUS_BADGE: Record<ComplaintStatus, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  predicted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const STATUS_FILTERS: Array<ComplaintStatus | "all"> = [
  "all",
  "pending",
  "processing",
  "predicted",
  "resolved",
];

// A case's severity here is derived from the amount defrauded, since
// complaints don't carry a separate risk score — this is a queue-triage
// view, not the AML/hotspot risk models.
function severityFor(amount: number): "High" | "Medium" | "Low" {
  if (amount >= 500000) return "High";
  if (amount >= 50000) return "Medium";
  return "Low";
}

const SEVERITY_BADGE: Record<string, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Search by case #, bank, city, or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading label="Loading case queue…" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState label="No cases match your current filters." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Case #</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Received</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Severity</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Jurisdiction</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const severity = severityFor(c.amount_defrauded);
                const isUpdating = updatingId === c.id;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3 font-medium">{c.complaint_number}</td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 capitalize">{c.complaint_category.replace(/_/g, " ")}</td>
                    <td className="py-3 px-3">{formatCurrency(c.amount_defrauded)}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[severity]}`}>
                        {severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {[c.city, c.district, c.state].filter(Boolean).join(", ") || "Unknown"}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
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
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
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
