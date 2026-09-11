import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/use-toast';
import { playAlertChime } from '@/lib/sound';
import { getToken } from '@/lib/auth';
import { getRuntimeEnv } from '@/lib/runtime-env';

const WS_PATH = '/api/v1/ws/live-feed';

// NEXT_PUBLIC_WS_URL (via getRuntimeEnv — see lib/runtime-env.ts for why) is
// documented (README, .env.example) as the backend *origin* — e.g.
// "ws://localhost:8000" — matching how NEXT_PUBLIC_API_URL is used as a base
// for arbitrary paths elsewhere. Always append the fixed WS path; never
// return the env var (or a fallback origin) verbatim.
const getWsUrl = (): string => {
  const configured = getRuntimeEnv('NEXT_PUBLIC_WS_URL', '');
  if (configured) {
    return `${configured.replace(/\/+$/, '')}${WS_PATH}`;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    return `${protocol}//${host}${WS_PATH}`;
  }
  return `ws://localhost:8000${WS_PATH}`;
};

export const useWebSocket = (customToken?: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const isUnmounted = useRef<boolean>(false);

  const addAlert = useAppStore((state: any) => state.addAlert);
  const soundEnabled = useAppStore((state: any) => state.soundEnabled);
  const { toast } = useToast();
  const updatePredictionStatus = useAppStore((state: any) => state.updatePredictionStatus);
  const setConnected = useAppStore((state: any) => state.setSocketConnected);

  const connect = useCallback(() => {
    if (isUnmounted.current) return;

    try {
      const token = customToken || getToken();
      if (!token) {
        // No authenticated session yet — do not open an unauthenticated socket.
        return;
      }

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
            if (soundEnabled) playAlertChime(data.priority || 'high');
            toast({
              title: `Alert: ${data.title || 'New Threat'}`,
              description: data.predicted_location ? `Predicted: ${data.predicted_location}` : data.description || '',
              variant: data.priority === 'critical' ? 'destructive' : 'default',
            });
          } else if (type === 'PREDICTION' || type === 'prediction_update') {
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
          if (reconnectAttempts.current > 5) {
            console.error("WebSocket max reconnect attempts exceeded; giving up.");
            reconnectAttempts.current = 0; // reset for next session
            return; // dead-letter: stop reconnecting
          }
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
  }, [customToken, addAlert, updatePredictionStatus, setConnected, soundEnabled, toast]);

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

