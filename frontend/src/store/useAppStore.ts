import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  alerts: any[];
  socketConnected: boolean;
  addAlert: (alert: any) => void;
  updatePredictionStatus: (data: any) => void;
  setSocketConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      alerts: [],
      socketConnected: false,
      addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
      updatePredictionStatus: (data) => console.log('Prediction status updated', data),
      setSocketConnected: (connected) => set({ socketConnected: connected }),
    }),
    {
      name: 'cgai-store',
    }
  )
);
