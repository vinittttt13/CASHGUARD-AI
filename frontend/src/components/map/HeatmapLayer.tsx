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
    // Viewport filter: only include points inside current map bounds
    const bounds = map.getBounds();
    const visible = data.filter((p) => bounds.contains([p.lat, p.lng]));

    import("leaflet.heat").then(() => {
      const points = visible.map((p) => [p.lat, p.lng, p.intensity] as [number, number, number]);

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
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, data]);

  return null;
}
