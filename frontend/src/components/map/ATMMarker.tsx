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
    let colorClass = "text-[#5b9083] bg-[#201b14] border-[#5b9083]";
    if (risk_score > 0.7) {
      colorClass = "text-[#ff4b26] bg-[#201b14] border-[#ff4b26]";
    } else if (risk_score >= 0.3) {
      colorClass = "text-[#d98f2b] bg-[#201b14] border-[#d98f2b]";
    }

    const html = `
      <div class="flex items-center justify-center w-7 h-7 rounded-full border-2 shadow-md ${colorClass}">
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
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }, [risk_score]);

  const riskColor = risk_score > 0.7 ? "text-flare" : risk_score >= 0.3 ? "text-risk-review" : "text-verified";

  return (
    <Marker position={position} icon={icon}>
      <Popup>
        <div className="min-w-[200px]">
          <div className="mb-1.5 text-[10px] font-semibold label-caps text-verified">
            ATM / Withdrawal Location
          </div>
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{address}</p>
          <div className="my-2 h-px w-full bg-border" />
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Risk score</dt>
              <dd className={cn("font-mono font-medium", riskColor)}>{formatConfidence(risk_score)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Incidents</dt>
              <dd className="font-mono font-medium text-foreground">{incident_count}</dd>
            </div>
          </dl>
        </div>
      </Popup>
    </Marker>
  );
}
