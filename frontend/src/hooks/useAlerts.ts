import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useAlerts = () => {
  const { data, error, mutate, isLoading } = useSWR('/api/intelligence/alerts', fetcher, {
    refreshInterval: 10000, // Poll every 10s as a fallback
  });

  return {
    alerts: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
};

export const acknowledgeAlert = async (id: string) => {
  const res = await fetch(`/api/intelligence/alerts/${id}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to acknowledge alert');
  return res.json();
};
