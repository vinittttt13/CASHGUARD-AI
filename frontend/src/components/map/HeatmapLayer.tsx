"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface HeatmapDataPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface HeatmapLayerProps {
  data: HeatmapDataPoint[];
}

export function HeatmapLayer({ data }: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    // leaflet.heat renders onto its own canvas layer and already clips to
    // the visible viewport internally — no need (and it's actively harmful)
    // to pre-filter points by map.getBounds() here. That bounds snapshot
    // was taken once at mount, before MapResizeHandler's deferred
    // setView/invalidateSize settles the container, and was never
    // recomputed on pan/zoom — so the heat layer could render empty on
    // load and then never update as the user moved the map. Feed it all
    // points and let it handle visibility.
    const points = data.map((p) => [p.lat, p.lng, p.intensity] as [number, number, number]);

    import("leaflet.heat").then(() => {
      if (cancelled) return;
      if (layerRef.current) {
        layerRef.current.setLatLngs(points);
      } else {
        // @ts-ignore - leaflet.heat adds heatLayer to L
        layerRef.current = (L as any).heatLayer(points, {
          radius: 22,
          blur: 18,
          maxZoom: 15,
          // Restrained risk-semantic gradient — cyan (baseline) through
          // amber/orange to critical red, no rainbow hues.
          gradient: {
            0.3: "#22d3ee",
            0.55: "#f59e0b",
            0.75: "#f97316",
            1.0: "#ef4444",
          },
        }).addTo(map);
      }
    });

    return () => {
      cancelled = true;
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, data]);

  return null;
}
