# Engineering Guide: Creating the CASHGUARD-AI Frontend System

This guide is an end-to-end architectural and implementation blueprint for building the **CASHGUARD-AI (Cybercrime Predictive Analytics Framework - CPAF)** frontend system. It documents the entire system lifecycle: design philosophies, tech stack selection, project scaffolding, UI component design system, geospatial mapping engine, real-time WebSocket pipelines, state management, analytics data visualization, authentication/RBAC guardrails, Docker containerization, and production deployment.

---

## 1. Executive Summary & Core Design Philosophy

### 1.1 Mission
The CASHGUARD-AI frontend is designed as a mission-critical **Law Enforcement & Financial Intelligence Command Center**. It aggregates real-time cybercrime telemetry, detects suspicious transactions, visualizes ATM withdrawal risk hotspots, and runs predictive analytics on financial fraud networks.

### 1.2 Core Design Principles
1. **High Information Density with Low Cognitive Load**: Officers and analysts must view live complaints, geospatial hotspots, and ML threat predictions simultaneously without visual clutter.
2. **Dark-Mode First Command Center Aesthetics**: Tuned for 24/7 operations rooms using an HSL-based dark palette, high-contrast indicators, and tactical accent colors (Critical Red, Warning Amber, Safe Emerald, Cyber Cyan).
3. **Sub-Second Real-Time Telemetry**: Real-time WebSocket connection to the backend event bus with automated exponential backoff reconnection and non-blocking state updates.
4. **Client-Server Rendering Hygiene**: Strict separation between Next.js React Server Components (RSC) for metadata/static shells and Client Components (`"use client"`) for interactive maps, WebSockets, and charts.
5. **Zero-Lag Geospatial Rendering**: Canvas-accelerated geospatial projection (Leaflet + `leaflet.heat`) dynamically loaded without server-side hydration mismatches.

---

## 2. Technology Stack & Library Matrix

| Layer | Technology | Version | Justification |
| :--- | :--- | :--- | :--- |
| **Framework** | **Next.js (App Router)** | `14.2.4` | Modern App Router, hybrid server/client rendering, automatic code-splitting, route groups, and SEO/metadata optimization. |
| **UI Library** | **React** | `18.3.1` | Concurrent rendering, declarative component tree, and custom hook ecosystems. |
| **Language** | **TypeScript** | `5.5.2` | Full end-to-end type safety, strict null checks, and interface parity with backend Pydantic schemas. |
| **Styling** | **Tailwind CSS** | `3.4.4` | Utility-first styling, CSS custom property tokens, and purge-based minimal CSS bundle size. |
| **UI Primitives** | **Radix UI** | Latest | Unstyled, fully accessible (WAI-ARIA compliant) headless primitives for dialogs, popovers, dropdowns, and tabs. |
| **Icons & Micro-animations** | **Lucide React** + `tailwindcss-animate` | `0.395.0` | Consistent, lightweight SVG icon suite and GPU-accelerated micro-interactions. |
| **Client State** | **Zustand** | `4.5.2` | Minimal boilerplate, lightweight store with persistence middleware and selector-based subscriptions. |
| **Server State & Cache** | **SWR** | `2.2.5` | Stale-While-Revalidate caching strategy, automated request deduplication, and polling fallback. |
| **Geospatial Mapping** | **Leaflet** + **React-Leaflet** | `1.9.4` / `4.2.1` | High-performance open-source map engine with customized SVG markers, tile caching, and heatmaps. |
| **Heatmaps** | **leaflet.heat** | `0.2.0` | 2D canvas particle-density projection for regional cybercrime intensity layers. |
| **Data Visualization** | **Recharts** | `2.12.7` | Composable SVG chart primitives (time series, radar charts, area gradients, bar charts). |
| **Real-Time Feed** | **Native WebSockets** | Browser API | Resilient, low-overhead binary/JSON socket with heartbeat ping-pong and reconnection backoff. |
| **Forms & Validation** | **React Hook Form** + **Zod** | `7.52.0` / `3.23.8` | Type-safe form schemas, zero re-render performance, and unified validation error feedback. |
| **HTTP Client** | **Axios** | `1.7.2` | Structured request/response interceptors for automatic JWT token injection and 401 redirection. |
| **Theme Management** | **next-themes** | `0.3.0` | Flawless dark/light switching without flash of unstyled content (FOUC). |
| **E2E Testing** | **Cypress** | `13.12.0` | End-to-end integration and automated officer journey regression testing. |

---

## 3. High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                        Next.js App Router (Client Shell)                   |  |
|  |                                                                             |  |
|  |   +-----------------------+ +--------------------+ +---------------------+  |  |
|  |   |   Top Navigation Bar  | |  Collapsible Nav   | |   Real-Time Status  |  |  |
|  |   |   (Header & Actions)  | |  (Sidebar Menu)    | |   (Live Ping & Pill)|  |  |
|  |   +-----------------------+ +--------------------+ +---------------------+  |  |
|  |                                                                             |  |
|  |   +----------------------------------------------------------------------+  |  |
|  |   |                         PAGE VIEWPORT                                |  |  |
|  |   |                                                                      |  |  |
|  |   |   [/dashboard]             [/analytics]             [/alerts]        |  |  |
|  |   |   - Live Predictive Map    - TimeSeries Trends      - Alert Center   |  |  |
|  |   |   - Threat Predictions     - SHAP Radar Matrix      - Acknowledge Feed| |
|  |   |   - Live Complaint Feed    - Hotspot Density Table  - Severity Filter|  |  |
|  |   +----------------------------------------------------------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
|             |                                   |                    |            |
|             v                                   v                    v            |
|  +---------------------+             +--------------------+ +------------------+  |
|  |    Zustand Store    |             |     SWR Cache      | | useWebSocket Hook|  |
|  | (useAppStore.ts)    |             | (Data Deduplication| | (Auto-Reconnect  |  |
|  | - Selected Incident |             |  & Invalidation)   | |  & Event Router) |  |
|  | - Active Hotspots   |             +--------------------+ +------------------+  |
|  | - Alert Array Cache  |                        |                    |            |
|  +---------------------+                        |                    |            |
+-------------------------------------------------|--------------------|------------+
                                                  |                    |
                                     HTTP / REST  |                    | WSS Events
                                                  v                    v
+-----------------------------------------------------------------------------------+
|                                 FASTAPI BACKEND                                   |
|   - REST Endpoints: /api/v1/complaints, /api/v1/analytics, /api/v1/auth           |
|   - WebSocket PubSub Relay: /api/v1/ws/live-feed                                  |
|   - PostgreSQL (PostGIS) Spatial Database & Redis 7 Event Bus                     |
+-----------------------------------------------------------------------------------+
```

---

## 4. Phase-by-Phase Setup & Creation Runbook

### Phase 1: Project Scaffolding & Configuration

#### Step 1: Initializing Next.js 14
From the repository root, create the frontend project structure:
```bash
npx create-next-app@14.2.4 frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

#### Step 2: Install Complete Dependencies
Navigate to the `frontend/` directory and install the core dependencies:
```bash
cd frontend

# Core UI & Primitives
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs \
  @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-select \
  @radix-ui/react-alert-dialog @radix-ui/react-scroll-area @radix-ui/react-separator \
  @radix-ui/react-slot @radix-ui/react-avatar @radix-ui/react-progress \
  clsx tailwind-merge class-variance-authority lucide-react tailwindcss-animate next-themes

# Geospatial Engine
npm install leaflet react-leaflet leaflet.heat
npm install -D @types/leaflet @types/leaflet.heat

# State & Data Fetching
npm install zustand swr axios date-fns

# Charts & Visualizations
npm install recharts

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# Utilities & Tokens
npm install jwt-decode
```

#### Step 3: Configure Tailwind CSS (`tailwind.config.ts`)
Set up the design token schema with CSS custom properties:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

#### Step 4: Define Design Tokens (`src/app/globals.css`)
Configure HSL variables for dark command-center aesthetic:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 224 71% 4%;
    --foreground: 213 31% 91%;
    --card: 224 71% 7%;
    --card-foreground: 213 31% 91%;
    --popover: 224 71% 4%;
    --popover-foreground: 215 20.2% 65.1%;
    --primary: 210 100% 50%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 222.2 47.4% 11.2%;
    --secondary-foreground: 210 40% 98%;
    --muted: 223 47% 11%;
    --muted-foreground: 215.4 16.3% 56.9%;
    --accent: 216 34% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 63% 31%;
    --destructive-foreground: 210 40% 98%;
    --border: 216 34% 17%;
    --input: 216 34% 17%;
    --ring: 216 34% 17%;
    --radius: 0.5rem;
  }
}

/* Custom Tactical Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: hsl(var(--background));
}
::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground));
}
```

---

## 5. Directory Organization & Clean Architecture

Organize `src/` by feature domains and responsibilities:

```text
frontend/src/
├── app/                              # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Officer login view
│   ├── dashboard/
│   │   └── page.tsx                  # Live incident & prediction hub
│   ├── analytics/
│   │   └── page.tsx                  # Deep-dive time-series & SHAP charts
│   ├── alerts/
│   │   └── page.tsx                  # Tactical alert management feed
│   ├── intelligence/
│   │   └── page.tsx                  # Executive reporting & export
│   ├── settings/
│   │   └── page.tsx                  # Officer preferences & API targets
│   ├── globals.css                   # Design tokens & color theme definitions
│   ├── layout.tsx                    # Root shell layout with ThemeProvider
│   └── page.tsx                      # Automatic routing redirect
├── components/                       # UI Components
│   ├── ui/                           # Reusable Radix UI atomic primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── shared/                       # Global layout elements
│   │   ├── Header.tsx                # App bar with live socket status
│   │   ├── Sidebar.tsx               # Collapsible navigation drawer
│   │   └── UserNav.tsx               # Officer profile dropdown
│   ├── map/                          # Geospatial Subsystem
│   │   ├── PredictiveMap.tsx         # Leaflet container with dynamic import
│   │   ├── ATMMarker.tsx             # Custom SVG risk marker
│   │   ├── HeatmapLayer.tsx          # Leaflet.heat density overlay
│   │   └── GeofenceZone.tsx          # SVG radius boundary
│   ├── dashboard/                    # Dashboard Widgets
│   │   ├── stats-overview.tsx        # KPI metrics counter cards
│   │   ├── predictive-map.tsx        # Dashboard map wrapper
│   │   ├── complaint-feed.tsx        # Real-time incident list
│   │   └── prediction-panel.tsx      # ML threat scoring card
│   └── analytics/                    # Recharts Components
│       ├── TimeSeriesChart.tsx       # Volume trend forecast
│       ├── FeatureRadar.tsx          # SHAP feature importance
│       └── ConfidenceGauge.tsx       # Probability gauge
├── hooks/                            # Custom React Hooks
│   ├── useWebSocket.ts               # Resilient real-time socket
│   ├── useAlerts.ts                  # SWR alert feed & mutations
│   ├── usePredictions.ts             # SWR ML predictions
│   ├── useMap.ts                     # Geospatial viewport controls
│   └── use-toast.ts                  # Toast notifications
├── lib/                              # Shared Utilities & Infrastructure
│   ├── api.ts                        # Axios instance with interceptors
│   └── utils.ts                      # Class merging (`cn`) helper
├── store/                            # Zustand Global Stores
│   └── useAppStore.ts                # Client-side UI & alert cache
└── types/                            # Strict TypeScript Contracts
    └── index.ts                      # Backend entity interfaces
```

---

## 6. Core Subsystems Deep Dive

### 6.1 Geospatial Engine (`components/map/`)

#### The Server-Side Hydration Problem
Leaflet relies on the browser's `window` and `document` objects. Importing Leaflet during Next.js Server-Side Rendering (SSR) triggers a `window is not defined` error.

#### The Solution: Next.js Dynamic Client Import
In the component utilizing the map (e.g., `components/dashboard/predictive-map.tsx`), dynamically import the Leaflet canvas component with `ssr: false`:

```typescript
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const PredictiveMap = dynamic(
  () => import('@/components/map/PredictiveMap').then((mod) => mod.PredictiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 gap-2">
        <Skeleton className="w-12 h-12 rounded-full animate-spin border-4 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground font-mono">INITIALIZING TACTICAL MAP...</span>
      </div>
    ),
  }
);
```

#### Heatmap Layer Implementation (`components/map/HeatmapLayer.tsx`)
```typescript
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface HeatmapLayerProps {
  points: [number, number, number][]; // [latitude, longitude, intensity]
}

export function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    // @ts-ignore: leaflet.heat plugin injection
    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 16,
      gradient: {
        0.2: '#06b6d4', // Cyan (Low)
        0.5: '#eab308', // Amber (Medium)
        0.8: '#f97316', // Orange (High)
        1.0: '#ef4444', // Red (Critical)
      },
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}
```

---

### 6.2 Real-Time WebSocket Infrastructure (`hooks/useWebSocket.ts`)

The WebSocket hook handles network drops, officer authentication handshakes, heartbeat ping/pongs, and automated exponential backoff:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

const MAX_RECONNECT_DELAY = 15000;

export const useWebSocket = (customToken?: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const isUnmounted = useRef<boolean>(false);

  const addAlert = useAppStore((state) => state.addAlert);
  const setConnected = useAppStore((state) => state.setSocketConnected);

  const connect = useCallback(() => {
    if (isUnmounted.current) return;

    try {
      const token = customToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') || 'anonymous' : 'anonymous');
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = process.env.NEXT_PUBLIC_WS_URL || `${wsProtocol}//${window.location.host}/api/v1/ws/live-feed`;
      const url = `${wsHost}?token=${encodeURIComponent(token)}`;

      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'new_alert') {
            addAlert(payload.data);
          }
        } catch {
          // Keep-alive or non-JSON heartbeat ignored
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!isUnmounted.current) {
          // Exponential backoff
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, MAX_RECONNECT_DELAY);
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    } catch {
      setConnected(false);
    }
  }, [customToken, addAlert, setConnected]);

  useEffect(() => {
    isUnmounted.current = false;
    connect();
    return () => {
      isUnmounted.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);
};
```

---

### 6.3 Global State Management (`store/useAppStore.ts`)

The store utilizes Zustand with `persist` middleware to maintain critical UI state across browser refreshes:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Alert {
  id: string;
  alert_type: string;
  risk_score: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  created_at: string;
}

interface AppState {
  alerts: Alert[];
  socketConnected: boolean;
  selectedComplaintId: string | null;
  activeHotspotFilter: string | null;
  sidebarOpen: boolean;
  addAlert: (alert: Alert) => void;
  setSocketConnected: (connected: boolean) => void;
  setSelectedComplaintId: (id: string | null) => void;
  setActiveHotspotFilter: (filter: string | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      alerts: [],
      socketConnected: false,
      selectedComplaintId: null,
      activeHotspotFilter: null,
      sidebarOpen: true,
      addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts.slice(0, 49)] })),
      setSocketConnected: (connected) => set({ socketConnected: connected }),
      setSelectedComplaintId: (id) => set({ selectedComplaintId: id }),
      setActiveHotspotFilter: (filter) => set({ activeHotspotFilter: filter }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'cashguard-app-store',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
);
```

---

### 6.4 API Integration & Authentication (`lib/api.ts`)

Configures Axios with authorization headers and automated token recovery:

```typescript
import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 7. Production Dockerization

### Multi-Stage Dockerfile (`frontend/Dockerfile`)
The frontend is containerized using a minimal multi-stage Alpine build for fast builds and small image footprint:

```dockerfile
# Stage 1: Install Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build Application
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Minimal Production Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

---

## 8. Verification & Quality Assurance Runbook

### 1. Static Type Checking
Always enforce zero TypeScript errors before bundling:
```bash
npm run type-check
```

### 2. Linting & Formatting Check
```bash
npm run lint
```

### 3. Production Build Validation
Verify that static and dynamic routes generate without hydration mismatches:
```bash
npm run build
```

### 4. End-to-End Test Suite (Cypress)
```bash
npm run cypress:run
```

---

## 9. Common Pitfalls & Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **`window is not defined` on Map** | Leaflet loaded during Node SSR pass. | Use `next/dynamic` with `{ ssr: false }` for all map canvas components. |
| **Missing Leaflet Marker Icons** | Webpack 5 URL resolution ignores Leaflet default marker assets. | Override `L.Icon.Default` prototype with custom SVG/PNG paths in `components/map/PredictiveMap.tsx`. |
| **WebSocket Continuous Reconnect Loop** | Reverse proxy (NGINX/Traefik) terminating Idle connections. | Enable `proxy_set_header Upgrade $http_upgrade` and `proxy_read_timeout 3600s` in ingress. |
| **FOUC on Theme Switch** | Dark mode variables loading after DOM painting. | Wrap the root layout with `<ThemeProvider attribute="class" defaultTheme="dark">`. |
| **Hydration Mismatch on Timestamps** | Server and client render differing localized times. | Render relative time strings using `date-fns` inside `useEffect` or use an explicit client-only component wrapper. |
