"use client";

import { MapPin, Clock, CheckCircle2 } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { normalizeRiskLevel, RISK_META, SeverityBadge, TechnicalId } from "@/components/shared/intel-primitives";
import { GoldenHourCountdown } from "./golden-hour-countdown";

interface AlertCardProps {
  alert: {
    id: string;
    priority: "Critical" | "High" | "Medium" | "Low";
    type: string;
    title: string;
    description: string;
    location: string;
    timestamp: string;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
  };
  onAcknowledge: () => void;
}

export function AlertCard({ alert, onAcknowledge }: AlertCardProps) {
  const level = normalizeRiskLevel(alert.priority);
  const meta = RISK_META[level];
  const Icon = meta.icon;

  return (
    <div className="flex gap-3 rounded-md border border-border bg-surface p-3">
      <span className={cn("mt-0.5 h-full w-0.5 shrink-0 self-stretch rounded-full", meta.dot)} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.text)} aria-hidden="true" />
            <h3 className="truncate text-sm font-medium text-foreground">{alert.title}</h3>
            <SeverityBadge level={level} size="sm" />
          </div>
          {!alert.acknowledged && (level === "critical" || level === "high") && (
            <GoldenHourCountdown incidentTimestamp={alert.timestamp} className="shrink-0" />
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{alert.description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-subtle-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <TechnicalId>{alert.location}</TechnicalId>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(alert.timestamp)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
          <span className="text-[11px] font-medium label-caps text-subtle-foreground">
            {alert.type?.replace(/_/g, " ")}
          </span>
          {alert.acknowledged ? (
            <span className="flex items-center gap-1.5 rounded-md border border-risk-low/30 bg-risk-low/10 px-2.5 py-1 text-xs font-medium text-risk-low">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Acknowledged
            </span>
          ) : (
            <button
              onClick={onAcknowledge}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
