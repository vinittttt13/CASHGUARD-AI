import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

const getWsUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    return `${protocol}//${host}/api/v1/ws/live-feed`;
  }
  return 'ws://localhost:8000/api/v1/ws/live-feed';
};

export const useWebSocket = (customToken?: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const isUnmounted = useRef<boolean>(false);

  const addAlert = useAppStore((state: any) => state.addAlert);
  const updatePredictionStatus = useAppStore((state: any) => state.updatePredictionStatus);
  const setConnected = useAppStore((state: any) => state.setSocketConnected);

  const connect = useCallback(() => {
    if (isUnmounted.current) return;

    try {
      const token =
        customToken ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('accessToken') || localStorage.getItem('token') || 'anonymous'
          : 'anonymous');

      const baseUrl = getWsUrl();
      const wsUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const type = message.type;
          const data = message.data || message.payload || message;

          if (type === 'new_alert') {
            addAlert(data);
          } else if (type === 'prediction_update') {
            updatePredictionStatus(data);
          }
        } catch {
          // Ignored non-json payloads (e.g. heartbeat pings)
        }
      };

      socket.onclose = (event) => {
        setConnected(false);
        if (!isUnmounted.current && event.code !== 1000) {
          // Exponential backoff with jitter: min 1s, max 16s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 16000);
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      // Reconnect on initial socket initialization error
      if (!isUnmounted.current) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    }
  }, [customToken, addAlert, updatePredictionStatus, setConnected]);

  useEffect(() => {
    isUnmounted.current = false;
    connect();

    return () => {
      isUnmounted.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  const send = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { socket: wsRef.current, send };
};

