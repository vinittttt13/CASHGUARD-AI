import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/store/useAppStore';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  
  // Dispatches to Zustand
  const addAlert = useAppStore((state: any) => state.addAlert);
  const updatePredictionStatus = useAppStore((state: any) => state.updatePredictionStatus);
  const setConnected = useAppStore((state: any) => state.setSocketConnected);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      reconnectionDelayMax: 10000,
      reconnection: true,
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('new_alert', (alertData: any) => {
      addAlert(alertData);
    });

    socket.on('prediction_update', (data: any) => {
      updatePredictionStatus(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [addAlert, updatePredictionStatus, setConnected]);

  return socketRef.current;
};
