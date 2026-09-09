import { useState, useCallback } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useMap = () => {
  const [viewport, setViewport] = useState({
    latitude: 20.5937,
    longitude: 78.9629,
    zoom: 4,
  });

  const updateViewport = useCallback((newViewport: any) => {
    setViewport((prev) => ({ ...prev, ...newViewport }));
  }, []);

  return { viewport, updateViewport };
};

export const useHeatmapData = () => {
  const { data, error, isLoading } = useSWR('/api/map/heatmap', fetcher);
  return {
    heatmapData: data?.data || [],
    isLoading,
    isError: error,
  };
};

export const useHotspots = () => {
  const { data, error, isLoading } = useSWR('/api/map/hotspots', fetcher);
  return {
    hotspots: data?.data || [],
    isLoading,
    isError: error,
  };
};
