# 🛡️ Technical Audit: Frontend Architecture, UX & Real-Time

| Audit Scope | Severity | Affected Files | Status |
| :--- | :--- | :--- | :--- |
| **WebSocket Reconnect & State** | `🔴 CRITICAL` | `frontend/src/hooks/useWebSocket.ts` (Likely missing); `frontend/src/store/useAppStore.ts` (L81) | ⚠️ Action Required |
| **TypeScript Schema Contracts** | `🟠 HIGH` | `frontend/src/types/index.ts` | ⚠️ Action Required |
| **Map Performance / Heatmap** | `🟠 HIGH` | `frontend/src/components/map/HeatmapLayer.tsx`; `ATMMarker.tsx` | ⚠️ Review Needed |
| **Error Boundary States** | `🟠 HIGH` | `frontend/src/components/shared/ErrorBoundary.tsx` | ⚠️ Review Needed |
| **Zustand Persistence** | `🟡 MEDIUM` | `frontend/src/store/useAppStore.ts` | ⚠️ Review Needed |

---

## 1. Executive Summary

The Next.js 14 frontend is architecturally sound (App Router, Tailwind, Radix, Zustand, Leaflet) but operationally incomplete: `useWebSocket.ts` is absent or lacks reconnect logic, `types/index.ts` does not export interfaces matching backend Pydantic schemas, the map renders all points without viewport filtering, and `ErrorBoundary` has no fallback UI. These gaps break real-time intelligence feeds and degrade performance with large geospatial datasets.

---

## 2. Identified Flaws & Vulnerabilities

### 2.1 WebSocket Hook — No Reconnect or Message Handling
- **Severity**: `CRITICAL`
- **Affected File(s)**: `frontend/src/hooks/useWebSocket.ts` (Not present / unimplemented); `frontend/src/store/useAppStore.ts` (Lines 81-89)
- **Root Cause Analysis**: The docs reference `useWebSocket.ts`, but no reconnect logic (exponential backoff, heartbeat handling) exists. `useAppStore` has no `websocket` slice and no message handler for `new_alert`, `heartbeat`, or `initial_state` events described in `BACKEND_API_REFERENCE.md`.
- **Potential Impact**: Real-time alert banners fail silently; users never receive critical predictions; WebSocket disconnects are permanent until page reload.

#### Proposed Code Fix / Implementation
```typescript
// frontend/src/hooks/useWebSocket.ts — Complete reconnect + message handling
import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useWebSocket(token: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const setAlerts = useAppStore(s => s.setActiveAlerts);

  const connect = useCallback(() => {
    if (!token || ws.current?.readyState === WebSocket.OPEN) return;
    ws.current = new WebSocket(`wss://localhost:8000/api/v1/ws/live-feed?token=${token}`);

    ws.current.onopen = () => { reconnectDelay.current = 1000; };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'new_alert') setAlerts(msg.data);
      if (msg.type === 'heartbeat') console.debug('WS heartbeat', msg.timestamp);
    };

    ws.current.onclose = () => {
      setTimeout(connect, reconnectDelay.current);
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
    };
  }, [token, setAlerts]);

  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);
}
```

---

### 2.2 TypeScript Interfaces — Missing Backend Contracts
- **Severity**: `HIGH`
- **Affected File(s)**: `frontend/src/types/index.ts`; `frontend/src/components/dashboard/prediction-panel.tsx`; `frontend/src/components/analytics/feature-importance-radar.tsx`
- **Root Cause Analysis**: No exported interfaces for `PredictionResponse`, `ComplaintResponse`, `BatchPredictionResponse`, `AlertResponse`, or `IntelligenceReport`. Components likely cast `any` or use hardcoded props, causing build failures when backend schemas evolve.
- **Potential Impact**: Type mismatches cause runtime errors; refactoring backend Pydantic schemas breaks frontend without compile-time errors.

#### Proposed Code Fix / Implementation
```typescript
// frontend/src/types/index.ts — Add complete contracts
export interface PredictionResponse {
  id: string;
  complaint_id: string;
  predicted_latitude: number;
  predicted_longitude: number;
  confidence_score: number;
  predicted_locations: Array<{ lat: number; lng: number; atm_name?: string; confidence: number }>;
  hotspot_cluster_id?: number;
  model_version?: string;
  model_name?: string;
  feature_importance?: Array<{ feature: string; importance: number }>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  prediction_radius_km?: number;
  created_at: string;
}

export interface ComplaintResponse {
  id: string;
  complaint_number: string;
  victim_name_masked: string;
  victim_phone_masked: string;
  complaint_text: string;
  complaint_category: string;
  amount_defrauded: number;
  state: string;
  latitude?: number;
  longitude?: number;
  status: 'pending' | 'processing' | 'predicted' | 'resolved';
  predictions: PredictionResponse[];
  created_at: string;
  updated_at: string;
}
```

---

### 2.3 Leaflet Heatmap — No Viewport Filtering
- **Severity**: `HIGH`
- **Affected File(s)**: `frontend/src/components/map/HeatmapLayer.tsx`; `frontend/src/components/dashboard/predictive-map.tsx`
- **Root Cause Analysis**: `leaflet.heat` renders every point passed to it. With 10k+ complaints/predictions, the canvas becomes unresponsive. No `map.getBounds()` filtering is applied before passing points to `<HeatmapLayer>`.
- **Potential Impact**: Browser freezes, dropped frames, mobile device crashes; users cannot interact with map during high-volume incidents.

#### Proposed Code Fix / Implementation
```typescript
// frontend/src/components/map/HeatmapLayer.tsx
import { useMap } from 'react-leaflet';

export function HeatmapLayer({ points }: { points: Array<{lat:number,lng:number,weight:number}> }) {
  const map = useMap();
  const [visible, setVisible] = useState(points);

  useEffect(() => {
    const handler = () => {
      const bounds = map.getBounds();
      setVisible(points.filter(p => bounds.contains([p.lat, p.lng])));
    };
    map.on('moveend', handler);
    handler();
    return () => { map.off('moveend', handler); };
  }, [map, points]);

  return <LeafletHeat points={visible.map(p => [p.lat, p.lng, p.weight])} />;
}
```

---

### 2.4 Error Boundary — No Fallback UI or Logging
- **Severity**: `HIGH`
- **Affected File(s)**: `frontend/src/components/shared/ErrorBoundary.tsx`
- **Root Cause Analysis**: The component exists but lacks `componentDidCatch` state management, retry mechanism, or backend error logging endpoint. Users see a blank screen with no recovery option.
- **Potential Impact**: User abandonment; no error telemetry for debugging.

---

### 2.5 Zustand Store — No Persistence or Async Actions
- **Severity**: `MEDIUM`
- **Affected File(s)**: `frontend/src/store/useAppStore.ts` (Lines 81-89)
- **Root Cause Analysis**: The store uses `create()` without `persist` middleware or `devtools`. No `fetchPredictions` or `fetchAlerts` async actions exist; all data fetching is handled outside the store via raw `useEffect` hooks.
- **Potential Impact**: State lost on page refresh; inconsistent UI between dashboard sections.

---

## 3. Remediation Priority

| Priority | Issue | Fix File | Effort |
|---|---|---|---|
| P0 | WebSocket reconnect + message handler | `hooks/useWebSocket.ts` | 3h |
| P1 | Complete TypeScript contracts | `types/index.ts` | 2h |
| P1 | Viewport-based heatmap filtering | `components/map/HeatmapLayer.tsx` | 2h |
| P2 | ErrorBoundary fallback + logging | `components/shared/ErrorBoundary.tsx` | 2h |
| P2 | Zustand persist + async actions | `store/useAppStore.ts` | 2h |

---

*Audit completed: 2026-09-10 | Auditor: Principal Software Architect / Staff ML Engineer / Cyber Security Specialist*
