"use client";

import { Circle, Popup } from "react-leaflet";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeofenceZoneProps {
  id: string;
  center: [number, number];
  radius: number; // in meters
  priority: "critical" | "high" | "medium" | "low";
  title: string;
}

const ZONE_STYLE = {
  critical: { color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.22, weight: 2 },
  high: { color: "#f97316", fillColor: "#f97316", fillOpacity: 0.18, weight: 2 },
  medium: { color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15, weight: 1.5 },
  low: { color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.12, weight: 1.5 },
} as const;

export function GeofenceZone({ center, radius, priority, title }: GeofenceZoneProps) {
  const options = ZONE_STYLE[priority] ?? { color: "#8b9aaa", fillColor: "#8b9aaa", fillOpacity: 0.15, weight: 1 };
  const textColor = priority === "critical" ? "text-[#ef4444]" : priority === "high" ? "text-[#f97316]" : "text-[#f59e0b]";

  return (
    <Circle center={center} radius={radius} pathOptions={options}>
      <Popup>
        <div className="min-w-[190px]">
          <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", textColor)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {priority} Alert Zone
          </div>
          <div className="mt-1.5 text-sm font-medium text-slate-100">{title}</div>
          <div className="mt-1 text-xs text-slate-400">Radius: {(radius / 1000).toFixed(1)} km</div>
        </div>
      </Popup>
    </Circle>
  );
}
