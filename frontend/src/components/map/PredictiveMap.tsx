"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, LayersControl, LayerGroup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { HeatmapLayer } from "./HeatmapLayer";
import { ATMMarker } from "./ATMMarker";
import { GeofenceZone } from "./GeofenceZone";
import { Compass } from "lucide-react";
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

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [8.0, 68.0],
  [37.0, 97.5],
];
const INDIA_CENTER: [number, number] = [22.5, 78.9];

function BoundsFitter({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
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

// Leaflet measures its container once at init. Inside a scrollable dashboard
// layout the container can still be settling (fonts, sibling cards, grid
// reflow) at that point, so tiles never get requested for the area the
// container later grows into — it just renders blank/grey there. Re-measure
// whenever the container's actual size changes, and once shortly after mount.
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    const timeout = setTimeout(() => {
      map.invalidateSize();
      map.setView(INDIA_CENTER, 5);
    }, 250);
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [map]);
  return null;
}

function IndiaResetControl() {
  const map = useMap();
  return (
    <div className="absolute right-14 top-3 z-[400]">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          map.setView(INDIA_CENTER, 5);
        }}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-surface-overlay"
        title="Reset map to India view"
      >
        <Compass className="h-3.5 w-3.5 text-primary" />
        <span>Reset</span>
      </button>
    </div>
  );
}

export default function PredictiveMap({
  center = INDIA_CENTER,
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
    // Filter points strictly to India's geographical boundaries
    const valid = predictionPoints.filter(
      (p) => p.lat >= 8.0 && p.lat <= 37.0 && p.lng >= 68.0 && p.lng <= 97.5
    );
    if (valid.length === 0) return null;
    const lats = valid.map((p) => p.lat);
    const lngs = valid.map((p) => p.lng);
    return L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    );
  }, [predictionPoints]);

  if (!mounted) return <div className="h-full w-full animate-pulse rounded-lg bg-surface-overlay" />;

  const getPredictionColor = (confidence: number) => {
    if (confidence > 0.8) return "hsl(var(--flare))";
    if (confidence > 0.5) return "hsl(var(--risk-review))";
    return "hsl(var(--verified))";
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={4}
        maxZoom={18}
        maxBounds={[
          [5.0, 65.0],
          [38.5, 100.0],
        ]}
        className="h-full w-full"
      >
        <IndiaResetControl />
        <MapEventsHandler onClick={onAreaClick} />
        <MapResizeHandler />
        {/* CARTO's free anonymous basemap tier now requires an API key (every
            tile renders an "API KEY REQUIRED" watermark without one) — using
            the standard no-key OSM tile server instead, with a CSS filter to
            match the dark identity. See .map-tile-dark in globals.css. */}
        <TileLayer
          className="map-tile-dark"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains="abc"
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
                    <div className="min-w-[190px]">
                      <div className="mb-1.5 text-[10px] font-semibold label-caps text-verified">
                        Predicted Hotspot
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{pred.atmName}</h4>
                      <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Confidence</dt>
                          <dd className="font-mono font-medium text-foreground">
                            {formatConfidence(pred.confidence)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Last Event</dt>
                          <dd className="font-mono text-foreground">{pred.lastIncidentDate}</dd>
                        </div>
                      </dl>
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
      <div className="absolute bottom-4 left-4 z-[400] rounded-lg border border-border bg-surface-raised/95 p-3 text-xs backdrop-blur">
        <div className="mb-2 text-[10px] font-semibold label-caps text-muted-foreground">
          Prediction Confidence
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-risk-critical" />
          <span className="text-foreground">Critical (&gt; 80%)</span>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-risk-medium" />
          <span className="text-foreground">Medium (50–80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-risk-low" />
          <span className="text-foreground">Low (&lt; 50%)</span>
        </div>
      </div>
    </div>
  );
}
