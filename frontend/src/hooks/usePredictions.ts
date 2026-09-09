import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const usePredictions = (query?: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    `/api/predictions${query ? `?${query}` : ''}`,
    fetcher
  );

  return {
    predictions: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
};

export const createPrediction = async (payload: any) => {
  const res = await fetch('/api/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create prediction');
  return res.json();
};

export const batchPredict = async (payloads: any[]) => {
  const res = await fetch('/api/predictions/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: payloads }),
  });
  if (!res.ok) throw new Error('Failed to run batch predictions');
  return res.json();
};
