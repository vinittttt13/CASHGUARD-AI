"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ApiResource<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
}

interface Options {
  /** When false, the fetcher is not called. Default true. */
  enabled?: boolean;
}

/**
 * Minimal fetch-on-mount hook (no extra dependency). Re-runs when `deps`
 * change; guards against setState-after-unmount; surfaces errors instead of
 * throwing.
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  { enabled = true }: Options = {},
): ApiResource<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((res) => {
        if (!cancelled && mounted.current) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && mounted.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  return { data, error, loading, refetch };
}
