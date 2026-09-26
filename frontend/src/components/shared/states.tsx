"use client";

import { ShieldAlert, Inbox, Loader2, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function Loading({ label = "Retrieving intelligence data…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 p-8 text-xs text-muted-foreground"
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="label-caps">{label}</span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "Connection error",
}: {
  error: Error | { message?: string; response?: { status?: number } } | string;
  onRetry?: () => void;
  title?: string;
}) {
  const rawMessage =
    typeof error === "string" ? error : error?.message || "Unable to retrieve intelligence data.";
  const is429 =
    (typeof error !== "string" && (error as any)?.response?.status === 429) ||
    rawMessage.includes("429");

  const displayTitle = is429 ? "Rate limit exceeded" : title;
  const message = is429
    ? "Too many requests. Please pause a moment before retrying."
    : rawMessage;

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 border border-flare/30 bg-flare/5 p-8 text-center"
    >
      <ShieldAlert className="h-6 w-6 text-flare" aria-hidden="true" />
      <p className="label-caps text-sm font-semibold text-flare">{displayTitle}</p>
      <p className="max-w-sm text-xs text-muted-foreground">Failed to load data: {message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-1.5",
            "text-xs font-medium text-foreground transition-colors hover:bg-surface-overlay"
          )}
        >
          <RefreshCcw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  label = "No active threats",
  hint = "No incidents match the current filters.",
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 p-8 text-center">
      <Inbox className="h-6 w-6 text-subtle-foreground" aria-hidden="true" />
      <span className="label-caps text-sm font-semibold text-foreground">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
