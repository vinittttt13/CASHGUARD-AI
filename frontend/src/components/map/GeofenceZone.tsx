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
  critical: { color: "#ff4b26", fillColor: "#ff4b26", fillOpacity: 0.22, weight: 2 },
  high: { color: "#ff4b26", fillColor: "#ff4b26", fillOpacity: 0.14, weight: 2 },
  medium: { color: "#d98f2b", fillColor: "#d98f2b", fillOpacity: 0.15, weight: 1.5 },
  low: { color: "#5b9083", fillColor: "#5b9083", fillOpacity: 0.12, weight: 1.5 },
} as const;

export function GeofenceZone({ center, radius, priority, title }: GeofenceZoneProps) {
  const options = ZONE_STYLE[priority] ?? { color: "#8b8375", fillColor: "#8b8375", fillOpacity: 0.15, weight: 1 };
  const textColor =
    priority === "critical" || priority === "high"
      ? "text-flare"
      : priority === "medium"
        ? "text-risk-review"
        : "text-verified";

  return (
    <Circle center={center} radius={radius} pathOptions={options}>
      <Popup>
        <div className="min-w-[190px]">
          <div className={cn("flex items-center gap-1.5 text-xs font-semibold label-caps", textColor)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {priority} alert zone
          </div>
          <div className="mt-1.5 text-sm font-medium text-foreground">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">Radius: {(radius / 1000).toFixed(1)} km</div>
        </div>
      </Popup>
    </Circle>
  );
}
