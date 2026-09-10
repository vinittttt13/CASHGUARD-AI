"use client";

import { AlertTriangle, Inbox, Loader2, RefreshCcw } from "lucide-react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 p-8 text-sm text-muted-foreground"
    >
      <Loader2 className="h-6 w-6 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error | { message?: string } | string;
  onRetry?: () => void;
}) {
  const message =
    typeof error === "string" ? error : error?.message || "Something went wrong.";
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
    >
      <AlertTriangle className="h-7 w-7 text-destructive" />
      <p className="text-sm text-destructive">Failed to load data: {message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  label = "Nothing to show yet.",
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
      <Inbox className="h-7 w-7 opacity-40" />
      <span>{label}</span>
      {hint && <span className="text-xs opacity-70">{hint}</span>}
    </div>
  );
}
