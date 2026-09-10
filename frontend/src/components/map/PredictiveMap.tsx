"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, LayersControl, LayerGroup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { HeatmapLayer } from "./HeatmapLayer";
import { ATMMarker } from "./ATMMarker";
import { GeofenceZone } from "./GeofenceZone";
import { formatConfidence } from "@/lib/utils";
import { useApiResource } from "@/hooks/useApiResource";
import { getHeatmapData, getHotspots } from "@/lib/api";

// Fix Leaflet default marker icons without touching the prototype
// (deleting from prototype causes hasOwnProperty crash in setOptions)
if (typeof window !== "undefined") {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

interface PredictiveMapProps {
  center?: [number, number];
  zoom?: number;
  predictions?: Array<{
    id: string;
    lat: number;
    lng: number;
    confidence: number;
    atmName: string;
    lastIncidentDate: string;
  }>;
  alerts?: Array<{
    id: string;
    lat: number;
    lng: number;
    radius: number;
    priority: "critical" | "high" | "medium" | "low";
    title: string;
  }>;
  atms?: Array<{
    id: string;
    lat: number;
    lng: number;
    name: string;
    address: string;
    risk_score: number;
    incident_count: number;
  }>;
  onAreaClick?: (lat: number, lng: number) => void;
}

function BoundsFitter({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds]);
  return null;
}

function MapEventsHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function PredictiveMap({
  center = [20.5937, 78.9629],
  zoom = 5,
  predictions,
  alerts = [],
  atms: atmsProp,
  onAreaClick,
}: PredictiveMapProps) {
  const heatmap = useApiResource(getHeatmapData, []);
  const hotspots = useApiResource(getHotspots, []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const heatmapData = useMemo(
    () =>
      (heatmap.data ?? []).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        intensity: p.weight,
      })),
    [heatmap.data],
  );

  // Predictions layer: use the prop if given, otherwise derive from hotspots.
  const predictionPoints = useMemo(() => {
    if (predictions && predictions.length) return predictions;
    return (hotspots.data ?? []).map((h) => ({
      id: h.cluster_id,
      lat: h.center[0],
      lng: h.center[1],
      confidence: h.risk_score,
      atmName: h.name,
      lastIncidentDate: `${h.incident_count} incidents`,
    }));
  }, [predictions, hotspots.data]);

  const atms = useMemo(() => {
    if (atmsProp && atmsProp.length) return atmsProp;
    return (hotspots.data ?? []).map((h) => ({
      id: h.cluster_id,
      lat: h.center[0],
      lng: h.center[1],
      name: h.name,
      address: `${h.incident_count} incidents · ${h.radius_km} km`,
      risk_score: h.risk_score,
      incident_count: h.incident_count,
    }));
  }, [atmsProp, hotspots.data]);

  const bounds = useMemo(() => {
    if (predictionPoints.length === 0) return null;
    const lats = predictionPoints.map((p) => p.lat);
    const lngs = predictionPoints.map((p) => p.lng);
    return L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    );
  }, [predictionPoints]);

  if (!mounted) return <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg" />;

  const getPredictionColor = (confidence: number) => {
    if (confidence > 0.8) return "#dc2626";
    if (confidence > 0.5) return "#d97706";
    return "#16a34a";
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-sm border">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
      >
        <MapEventsHandler onClick={onAreaClick} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <BoundsFitter bounds={bounds} />

        <LayersControl position="topright">
          <LayersControl.Overlay checked name="Heatmap">
            <LayerGroup>
              <HeatmapLayer data={heatmapData} />
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Predictions">
            <LayerGroup>
              {predictionPoints.map(pred => (
                <CircleMarker
                  key={pred.id}
                  center={[pred.lat, pred.lng]}
                  radius={12}
                  pathOptions={{
                    color: getPredictionColor(pred.confidence),
                    fillColor: getPredictionColor(pred.confidence),
                    fillOpacity: 0.6,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="p-1">
                      <h4 className="font-semibold">{pred.atmName}</h4>
                      <div className="text-sm mt-1">Confidence: {formatConfidence(pred.confidence)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Last Incident: {pred.lastIncidentDate}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="ATMs">
            <LayerGroup>
              {atms.map(atm => (
                <ATMMarker key={atm.id} position={[atm.lat, atm.lng]} {...atm} />
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Alert Zones">
            <LayerGroup>
              {alerts.map(alert => (
                <GeofenceZone
                  key={alert.id}
                  id={alert.id}
                  center={[alert.lat, alert.lng]}
                  radius={alert.radius}
                  priority={alert.priority}
                  title={alert.title}
                />
              ))}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-[400] bg-white p-3 rounded-md shadow-md border text-xs">
        <div className="font-semibold mb-2">Prediction Confidence</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-red-600 opacity-60"></div>
          <span>High (&gt; 80%)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-amber-500 opacity-60"></div>
          <span>Medium (50-80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600 opacity-60"></div>
          <span>Low (&lt; 50%)</span>
        </div>
      </div>
    </div>
  );
}
