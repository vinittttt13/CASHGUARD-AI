import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Alert } from "@/types";

interface CurrentUser {
  email: string;
  role: "admin" | "analyst";
}

interface PredictionUpdate {
  complaint_id: string;
  risk_level: string;
  confidence_score: number;
  model_version?: string;
}

interface AppState {
  // Auth user decoded from JWT
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;

  // Live alerts received over WebSocket
  alerts: Alert[];
  unreadAlertCount: number;
  addAlert: (alert: Alert) => void;
  clearUnread: () => void;
  clearAlerts: () => void;

  // Prediction updates received over WebSocket
  predictionUpdates: Record<string, PredictionUpdate>;
  updatePredictionStatus: (data: PredictionUpdate) => void;

  // WebSocket connection state
  socketConnected: boolean;
  setSocketConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),

      // Live alerts
      alerts: [],
      unreadAlertCount: 0,
      addAlert: (alert) =>
        set((state) => ({
          alerts: [alert, ...state.alerts].slice(0, 100), // cap at 100
          unreadAlertCount: state.unreadAlertCount + 1,
        })),
      clearUnread: () => set({ unreadAlertCount: 0 }),
      clearAlerts: () => set({ alerts: [], unreadAlertCount: 0 }),

      // Prediction updates
      predictionUpdates: {},
      updatePredictionStatus: (data) =>
        set((state) => ({
          predictionUpdates: {
            ...state.predictionUpdates,
            [data.complaint_id]: data,
          },
        })),

      // WebSocket
      socketConnected: false,
      setSocketConnected: (connected) => set({ socketConnected: connected }),
    }),
    {
      name: "cgai-store",
      // Only persist user identity and unread count; alerts refresh from API
      partialize: (state) => ({
        currentUser: state.currentUser,
        unreadAlertCount: state.unreadAlertCount,
      }),
    }
  )
);
