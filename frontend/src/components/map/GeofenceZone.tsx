"use client";

import { useEffect, useState } from "react";
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

export function GeofenceZone({ id, center, radius, priority, title }: GeofenceZoneProps) {
  const getZoneOptions = () => {
    switch (priority) {
      case "critical":
        return { color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.3, weight: 2 };
      case "high":
        return { color: "#ea580c", fillColor: "#ea580c", fillOpacity: 0.25, weight: 2 };
      case "medium":
        return { color: "#d97706", fillColor: "#d97706", fillOpacity: 0.2, weight: 1.5 };
      case "low":
        return { color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.15, weight: 1.5 };
      default:
        return { color: "#6b7280", fillColor: "#6b7280", fillOpacity: 0.2, weight: 1 };
    }
  };

  return (
    <Circle center={center} radius={radius} pathOptions={getZoneOptions()}>
      <Popup className="geofence-popup">
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className={cn("w-4 h-4", priority === 'critical' ? 'text-red-600' : 'text-orange-500')} />
            <span className="capitalize text-sm">{priority} Alert Zone</span>
          </div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">
            Radius: {(radius / 1000).toFixed(1)} km
          </div>
        </div>
      </Popup>
    </Circle>
  );
}
