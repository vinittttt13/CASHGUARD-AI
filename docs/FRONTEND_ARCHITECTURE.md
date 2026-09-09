# Frontend Architecture & UI Component Guide

The CASHGUARD-AI frontend is built with **Next.js 14 (App Router)**, **React 18**, **TypeScript**, and styled with **Tailwind CSS** alongside **Radix UI** primitives.

---

## 1. Directory Structure

```text
frontend/src/
├── app/                          # Next.js App Router Routes
│   ├── (auth)/login/             # Dedicated Officer Authentication View
│   ├── dashboard/                # Main Live Incident & Geospatial Hub
│   ├── analytics/                # Deep-dive charts, radar SHAP, time-series
│   ├── alerts/                   # Tactical alert center & acknowledge feed
│   ├── intelligence/             # Executive AI reports & export to PDF
│   ├── settings/                 # Officer preferences & system settings
│   ├── globals.css               # Design tokens & dark mode color variables
│   └── layout.tsx                # App root layout with theme provider
├── components/
│   ├── dashboard/                # PredictiveMap, ComplaintFeed, PredictionPanel
│   ├── map/                      # Leaflet Map, ATMMarker, GeofenceZone, HeatmapLayer
│   ├── analytics/                # TimeSeriesChart, ConfidenceGauge, FeatureRadar
│   ├── alerts/                   # AlertCenter, AlertBadge, FilterBar
│   ├── intelligence/             # HotspotGrid, TrendChart, StateBreakdown
│   ├── shared/                   # Header, Sidebar, NavItem, UserAvatar
│   └── ui/                       # Radix UI primitives (Button, Card, Dialog, Popover)
├── hooks/                        # Custom React Hooks
├── store/                        # Zustand Global Store (useAppStore)
└── types/                        # TypeScript Interfaces & Contract Models
```

---

## 2. Key Pages & Routes

| Route | Page Component | Description |
|---|---|---|
| `/` | Redirect | Automatically routes to `/dashboard` or `/login`. |
| `/login` | `(auth)/login/page.tsx` | Officer authentication with JWT credentials. |
| `/dashboard` | `dashboard/page.tsx` | Master view featuring live Leaflet map, threat prediction panel, real-time complaint feed, and KPI overview cards. |
| `/analytics` | `analytics/page.tsx` | Statistical analysis view: crime volume time series, model confidence gauges, SHAP radar visualizer, and predicted hotspots table. |
| `/alerts` | `alerts/page.tsx` | Filterable alert center with bulk-acknowledgement and priority filters (Critical, High, Medium). |
| `/intelligence` | `intelligence/page.tsx` | Executive summary report generator, PDF/Print formatting, 48-hour trend forecast, and actionable recommendations. |

---

## 3. Geospatial Visualization Engine (`components/map/`)

The geospatial interface is powered by **Leaflet** with custom interactive overlays:

1. **`PredictiveMap.tsx`**:
   - Manages map center, pan-and-zoom behavior, tile layers (OpenStreetMap / CartoDB Dark Matter).
   - Dynamically renders hotspots, target withdrawal coordinates, and geofence radii.
2. **`HeatmapLayer.tsx`**:
   - Integrates `leaflet.heat` to project incident intensity gradients across Indian states and cities based on normalized risk scores.
3. **`ATMMarker.tsx`**:
   - Visualizes physical ATMs/kiosks with customized marker icons colored by risk level (Green = Low, Orange = Medium, Red = High/Critical).
   - Tooltips show bank name, address, ATM ID, and historical incident tally.
4. **`GeofenceZone.tsx`**:
   - Draws SVG circular geofence perimeters around predicted withdrawal zones with radius in kilometers.

---

## 4. State Management (`store/useAppStore.ts`)

The application uses **Zustand** for lightweight client-side state:

```typescript
import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  selectedComplaintId: string | null;
  setSelectedComplaintId: (id: string | null) => void;
  activeHotspotFilter: string | null;
  setActiveHotspotFilter: (filter: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  selectedComplaintId: null,
  setSelectedComplaintId: (id) => set({ selectedComplaintId: id }),
  activeHotspotFilter: null,
  setActiveHotspotFilter: (filter) => set({ activeHotspotFilter: filter }),
}));
```

---

## 5. UI Design System & Theming

- **Dark Mode First**: Tailored for 24/7 law enforcement command center operations using `next-themes`.
- **CSS Variables in `globals.css`**: HSL-based design tokens matching shadcn/ui specifications for backgrounds, borders, muted elements, primary brand accents, and destructive alert colors.
