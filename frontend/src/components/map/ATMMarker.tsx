"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Landmark } from "lucide-react";
import { cn, formatConfidence } from "@/lib/utils";

interface ATMMarkerProps {
  id: string;
  position: [number, number];
  name: string;
  address: string;
  risk_score: number;
  incident_count: number;
}

export function ATMMarker({ id, position, name, address, risk_score, incident_count }: ATMMarkerProps) {
  const icon = useMemo(() => {
    let colorClass = "text-green-600 bg-green-100 border-green-500";
    if (risk_score > 0.7) {
      colorClass = "text-red-600 bg-red-100 border-red-500";
    } else if (risk_score >= 0.3) {
      colorClass = "text-amber-600 bg-amber-100 border-amber-500";
    }

    const html = `
      <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-md ${colorClass}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-landmark">
          <line x1="3" x2="21" y1="22" y2="22"/>
          <line x1="6" x2="6" y1="18" y2="11"/>
          <line x1="10" x2="10" y1="18" y2="11"/>
          <line x1="14" x2="14" y1="18" y2="11"/>
          <line x1="18" x2="18" y1="18" y2="11"/>
          <polygon points="12 2 20 7 4 7"/>
        </svg>
      </div>
    `;

    return L.divIcon({
      html,
      className: "custom-atm-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }, [risk_score]);

  return (
    <Marker position={position} icon={icon}>
      <Popup>
        <div className="flex flex-col gap-2 min-w-[200px]">
          <h3 className="font-semibold text-base">{name}</h3>
          <p className="text-xs text-muted-foreground">{address}</p>
          <div className="h-px w-full bg-border my-1" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Risk Score</span>
              <span className={cn(
                "font-medium",
                risk_score > 0.7 ? "text-red-600" : risk_score >= 0.3 ? "text-amber-600" : "text-green-600"
              )}>
                {formatConfidence(risk_score)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Incidents</span>
              <span className="font-medium">{incident_count}</span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
