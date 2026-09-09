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

    // Dynamically import leaflet.heat only on the client
    import("leaflet.heat").then(() => {
      const points = data.map((p) => [p.lat, p.lng, p.intensity] as [number, number, number]);

      if (layerRef.current) {
        layerRef.current.setLatLngs(points);
      } else {
        // @ts-ignore - leaflet.heat adds heatLayer to L
        layerRef.current = (L as any).heatLayer(points, {
          radius: 25,
          blur: 15,
          maxZoom: 15,
          gradient: {
            0.4: "blue",
            0.6: "cyan",
            0.7: "lime",
            0.8: "yellow",
            1.0: "red",
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
