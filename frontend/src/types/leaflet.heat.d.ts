import * as L from 'leaflet';

declare module 'leaflet' {
  interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: number]: string };
  }

  type HeatLatLngTuple = [number, number, number] | [number, number];

  interface HeatLayer extends L.Layer {
    setOptions(options: HeatMapOptions): this;
    addLatLng(latlng: HeatLatLngTuple | L.LatLng): this;
    setLatLngs(latlngs: (HeatLatLngTuple | L.LatLng)[]): this;
    redraw(): this;
  }

  function heatLayer(latlngs: (HeatLatLngTuple | L.LatLng)[], options?: HeatMapOptions): HeatLayer;
}

declare module 'leaflet.heat' {
  const heatLayer: any;
  export = heatLayer;
}
