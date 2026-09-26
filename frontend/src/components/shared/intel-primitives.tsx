"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types/api";
import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------
 * Risk semantics — single source of truth for color/label per RiskLevel.
 * Every place that renders risk MUST go through this map, never ad-hoc color.
 * ---------------------------------------------------------------------- */

export const RISK_META: Record<
  RiskLevel,
  { label: string; text: string; bg: string; border: string; dot: string; icon: LucideIcon }
> = {
  low: {
    label: "Clear",
    text: "text-risk-low",
    bg: "bg-risk-low/10",
    border: "border-risk-low/30",
    dot: "bg-risk-low",
    icon: ShieldCheck,
  },
  medium: {
    label: "Review",
    text: "text-risk-medium",
    bg: "bg-risk-medium/10",
    border: "border-risk-medium/30",
    dot: "bg-risk-medium",
    icon: AlertTriangle,
  },
  high: {
    label: "High",
    text: "text-risk-high",
    bg: "bg-risk-high/10",
    border: "border-risk-high/30",
    dot: "bg-risk-high",
    icon: ShieldAlert,
  },
  critical: {
    label: "Critical",
    text: "text-risk-critical",
    bg: "bg-risk-critical/10",
    border: "border-risk-critical/30",
    dot: "bg-risk-critical",
    icon: Flame,
  },
};

/** Normalizes loosely-typed backend strings into a RiskLevel key. */
export function normalizeRiskLevel(value?: string | null): RiskLevel {
  const v = (value || "").toLowerCase();
  if (v === "critical") return "critical";
  if (v === "high") return "high";
  if (v === "medium" || v === "moderate") return "medium";
  return "low";
}

/* -------------------------------------------------------------------------
 * SeverityBadge — text + color + icon, never color alone (a11y requirement)
 * ---------------------------------------------------------------------- */

export function SeverityBadge({
  level,
  className,
  size = "md",
}: {
  level: RiskLevel | string;
  className?: string;
  size?: "sm" | "md";
}) {
  const meta = RISK_META[normalizeRiskLevel(level)];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-mono font-medium uppercase tracking-wide",
        meta.bg,
        meta.border,
        meta.text,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/* -------------------------------------------------------------------------
 * RiskScore — numeric score + severity label + slim linear indicator.
 * No giant circular gauges (per design brief).
 * ---------------------------------------------------------------------- */

export function RiskScore({
  score,
  level,
  max = 100,
  className,
  showBar = true,
}: {
  /** 0-100 (or 0-1 probability, auto-detected) */
  score: number;
  level?: RiskLevel | string;
  max?: number;
  className?: string;
  showBar?: boolean;
}) {
  const normalized = score <= 1 ? score * 100 : score;
  const pct = Math.max(0, Math.min(100, (normalized / max) * 100));
  const resolvedLevel = normalizeRiskLevel(
    level ?? (normalized >= 81 ? "critical" : normalized >= 61 ? "high" : normalized >= 31 ? "medium" : "low")
  );
  const meta = RISK_META[resolvedLevel];
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-mono text-lg font-semibold tabular-nums", meta.text)}>
          {normalized.toFixed(0)}
        </span>
        <span className="text-[10px] font-medium label-caps text-muted-foreground">
          / {max}
        </span>
        <span className={cn("ml-auto text-[10px] font-semibold label-caps", meta.text)}>
          {meta.label}
        </span>
      </div>
      {showBar && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-overlay" aria-hidden="true">
          <div
            className={cn("h-full rounded-full", meta.dot)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * StatusIndicator — LIVE / OPERATIONAL style dot + label, subtle pulse.
 * ---------------------------------------------------------------------- */

export function StatusIndicator({
  state,
  label,
  className,
}: {
  state: "online" | "offline" | "degraded" | "reconnecting";
  label: string;
  className?: string;
}) {
  const color =
    state === "online"
      ? "bg-risk-low"
      : state === "degraded" || state === "reconnecting"
        ? "bg-risk-medium"
        : "bg-risk-critical";
  // "online" pulses to show a healthy live connection; "reconnecting" blinks
  // faster/harder to read as active-but-troubled, distinct from a flat dead
  // "offline" dot — a viewer should be able to tell "still trying" from
  // "given up" at a glance.
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground", className)}>
      <span className="relative flex h-1.5 w-1.5">
        {state === "online" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />
        )}
        {state === "reconnecting" && (
          <span className={cn("absolute inline-flex h-full w-full animate-pulse rounded-full opacity-80", color)} />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", color)} />
      </span>
      <span className="label-caps">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Panel — the base surface for every dashboard block.
 * ---------------------------------------------------------------------- */

export function Panel({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-xs font-semibold tracking-wide text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------
 * MetricCard — compact KPI panel with value, label, trend, meta.
 * ---------------------------------------------------------------------- */

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  meta,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  /** signed delta already computed by caller — no fabricated percentages */
  trend?: { value: string; direction: "up" | "down" | "flat"; positiveIsGood?: boolean };
  meta?: React.ReactNode;
  tone?: "neutral" | "low" | "medium" | "high" | "critical" | "system";
  className?: string;
}) {
  const toneText =
    tone === "neutral"
      ? "text-foreground"
      : tone === "system"
      ? "text-risk-system"
      : RISK_META[tone as RiskLevel]?.text ?? "text-foreground";

  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium label-caps text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-3.5 w-3.5 text-subtle-foreground" aria-hidden="true" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn("font-mono text-2xl font-semibold tabular-nums", toneText)}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {trend ? (
          <span
            className={cn(
              "text-[11px] font-medium",
              trend.direction === "flat"
                ? "text-muted-foreground"
                : (trend.direction === "up") === (trend.positiveIsGood ?? true)
                ? "text-risk-low"
                : "text-risk-critical"
            )}
          >
            {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "—"} {trend.value}
          </span>
        ) : (
          <span />
        )}
        {meta && <span className="text-[11px] text-subtle-foreground">{meta}</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * SectionHeader — page/section title with contextual description.
 * ---------------------------------------------------------------------- */

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * ConfidenceIndicator — model confidence, compact linear meter.
 * ---------------------------------------------------------------------- */

export function ConfidenceIndicator({
  value,
  label = "Model confidence",
  className,
}: {
  /** 0-1 or 0-100 */
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = value <= 1 ? value * 100 : value;
  const tone = pct >= 80 ? "bg-risk-low" : pct >= 50 ? "bg-risk-medium" : "bg-risk-critical";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium label-caps">{label}</span>
        <span className="font-mono tabular-nums text-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Monospace identifier helper — for IDs, hashes, coordinates, timestamps.
 * ---------------------------------------------------------------------- */

export function TechnicalId({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs text-muted-foreground", className)}>{children}</span>;
}
