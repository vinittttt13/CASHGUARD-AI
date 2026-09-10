# Frontend ↔ Backend Integration Spec (item 4)

> **Goal:** every dashboard screen renders **live data from the FastAPI backend**
> instead of hard-coded mocks. Auth, routing and the WebSocket feed were wired
> in MT-03; the data-fetching layer for the screens is done here.
>
> **Date:** 2026-09-11 · **Branch of work:** committed to `main`.

---

## 1. Ground truth — what the backend actually returns

Captured live from a seeded `docker compose` stack (`seed_db.py`). The
frontend's old `types/index.ts` did **not** match any of this and is replaced.

| Endpoint | Shape (trimmed) |
|---|---|
| `POST /api/v1/auth/login` | `{ access_token, token_type, refresh_token }` |
| `GET /api/v1/complaints?skip=&limit=&status=&category=&state=` | `{ total, items: Complaint[] }` |
| `Complaint` | `{ id, complaint_number, complaint_text, complaint_category, amount_defrauded, currency, state, district, city, latitude, longitude, status, bank_name, created_at, incident_date, victim_name_masked, victim_phone_masked, predictions: [] }` |
| `GET /api/v1/complaints/stats/aggregate` | `{ by_category: {phishing: n, …}, by_state: {Maharashtra: n, …}, by_status: {pending: n, …} }` — **enum keys cleaned** in this task (was `"ComplaintCategory.phishing"`) |
| `POST /api/v1/predict` `{complaint_id, force_refresh}` | `PredictionResponse` |
| `PredictionResponse` | `{ id, complaint_id, predicted_latitude, predicted_longitude, confidence_score, predicted_locations: [{lat,lng,atm_name,confidence}], risk_level: "low\|medium\|high\|critical", model_name, model_version, feature_importance: [{feature,importance}] \| null, prediction_radius_km, created_at }` |
| `GET /api/v1/intelligence/alerts` | `{ total, items: Alert[] }` |
| `Alert` | `{ id, title, description, alert_type, priority: "low\|medium\|high\|critical", latitude, longitude, radius_km, confidence_score, is_active, is_acknowledged, acknowledged_by, created_at, expires_at }` |
| `PUT /api/v1/intelligence/alerts/{id}/acknowledge` | updated `Alert` |
| `GET /api/v1/intelligence/trends?days=` | `{ period_days, total_incidents, daily_counts: [{date,count}], forecast: [{date,predicted_count}] }` |
| `GET /api/v1/intelligence/report?days=` | `{ summary, period_days, total_complaints, total_defrauded_inr, active_hotspots: [{id,name,lat,lng,risk_score,incident_count}], high_priority_alerts: [{id,title,priority,alert_type,created_at}], state_wise_breakdown: {State: n}, category_breakdown: {cat: n}, top_targeted_banks: [[bank,n]], recommendations: string[], generated_at }` |
| `GET /api/v1/locations/hotspots` | `[{ cluster_id, center: [lat,lng], radius_km, incident_count, risk_score, name }]` |
| `GET /api/v1/locations/heatmap` | `[{ lat, lng, weight }]` |
| `GET /api/v1/locations?state=&city=&loc_type=` | `Location[]` = `{ id, name, latitude, longitude, location_type, address, city, state, bank_name, risk_score, incident_count, is_active }` |
| `GET /api/v1/locations/nearby?lat=&lng=&radius_km=` | `Location[]` with `distance_km` |

---

## 2. Frontend data layer

### 2.1 `src/types/api.ts` (new)
Hand-written types mirroring §1 exactly. `src/types/index.ts` re-exports from it
for backwards compatibility; the fictional interfaces are removed.

### 2.2 `src/lib/api.ts`
Same function names, corrected return types, one added: `getComplaint(id)`.
`predictComplaint(id)` posts `{ complaint_id, force_refresh: true }`.

### 2.3 `src/hooks/useApiResource.ts` (new — no new dependency)
```ts
useApiResource<T>(fetcher: () => Promise<T>, deps?: unknown[], opts?: { enabled?: boolean })
  -> { data: T | undefined, error: Error | null, loading: boolean, refetch: () => void }
```
- fetches on mount and when `deps` change (guards against setState-after-unmount)
- `enabled: false` skips the call (for dependent queries)
- errors are surfaced, not thrown

### 2.4 Shared states — `src/components/shared/states.tsx` (new)
`<Loading label?>`, `<ErrorState error onRetry?>`, `<EmptyState label icon?>` —
used by every wired screen so behaviour is consistent.

### 2.5 Conventions
- Data fetching lives in the **page** or a thin **container** component; the
  presentational chart components keep taking plain props.
- Every wired screen shows: skeleton/`<Loading>` while `loading`,
  `<ErrorState onRetry={refetch}>` on `error`, `<EmptyState>` when the payload
  is empty, data otherwise.
- No `NEXT_PUBLIC_*` reads outside `lib/api.ts` / `hooks/useWebSocket.ts`.

---

## 3. Per-screen wiring

### Dashboard (`app/dashboard/page.tsx` + children)
| Component | Source | Mapping |
|---|---|---|
| `StatsOverview` | `getComplaintStats()`, `getAlerts()`, `getHotspots()` | Total Complaints = Σ `by_status`; Active Alerts = `alerts.total`; Unacknowledged = `alerts.items.filter(!is_acknowledged)`; High-Risk Hotspots = `hotspots.length`. Fake % deltas removed. |
| `ComplaintFeed` | `getComplaints({ limit: 15 })` | row = `{category: complaint_category, city: city\|\|district, amount: amount_defrauded, status, description: complaint_text, timestamp: incident_date\|\|created_at}`. "Run Prediction Model" → `predictComplaint(id)` → toast risk level. "Connected" badge ← `useAppStore().socketConnected`. |
| `PredictiveMap` | `getHotspots()`, `getHeatmapData()` | replace the inline `useHotspots`/`useHeatmapData` stubs; markers from hotspots `center`, heat from `[{lat,lng,weight}]`. |
| `PredictionPanel` | dashboard container: newest complaint → `predictComplaint(id)` | `{riskLevel: title-case(risk_level), locations: predicted_locations.map(l=>({name: l.atm_name, confidence: l.confidence})), features: (feature_importance\|\|[]).map(f=>({name: f.feature, value: f.importance}))}`. |

### Alerts (`app/alerts/page.tsx` + `AlertCenter`)
- `getAlerts()` → list. Store alerts from `useAppStore().alerts` are prepended
  (WS live feed) and de-duped by `id`.
- Priority `low/medium/high/critical` → `Low/Medium/High/Critical`.
- Card fields: `title`, `description`, `location` = `lat,lng` rounded or
  `alert_type`, `timestamp` = `created_at`, `acknowledged` = `is_acknowledged`.
- Acknowledge button → `acknowledgeAlert(id)` → `refetch()`.
- Page stat cards computed from the list (total, critical, high, unacked).

### Analytics (`app/analytics/page.tsx` — new container)
| Component | Source | Mapping |
|---|---|---|
| `TimeSeriesChart` | `getTrends({days})` | `daily_counts` → `{date, actual: count, forecast: null}` then `forecast` → `{date, actual: null, forecast: predicted_count}`, concatenated. |
| `GeographicDistribution` | `getComplaintStats()` | `by_state` → `{state, count, riskLevel}` (riskLevel bucketed on count percentile). |
| `ConfidenceGauge` | `getAlerts()` | `score` = mean `confidence_score`×100; `sampleSize` = `items.length`. |
| `FeatureImportanceRadar` | newest complaint → `predictComplaint(id)` | `feature_importance` → `{feature, current: importance, average: importance*0.8}` (no 7-day baseline yet — documented). Falls back to `<EmptyState>` when models aren't trained (heuristic fallback → `feature_importance: null`). |
| `HotspotTable` | `getHotspots()` | rows from `name`, `incident_count`, `risk_score*100`, status bucketed. |

### Intelligence (`app/intelligence/page.tsx` — new container)
- `getIntelligenceReport({days: 7})` + `getTrends({days: 30})`.
- Executive summary ← `report.summary`; recommendations ← `report.recommendations`.
- `HotspotGrid` ← `report.active_hotspots`.
- `StateBreakdown` ← `report.state_wise_breakdown` (`{state, incidents}`).
- `TrendChart` ← `trends.daily_counts` grouped (single "incidents" series).
- Export PDF button → `GET /api/v1/intelligence/report/export` (CSV) via a link.

### Settings (`app/settings/page.tsx`)
No backend endpoint for password change / notification prefs exists. Left as a
local-only form; **out of scope** for data wiring (noted in ROADMAP follow-ups).

---

## 4. Backend change in this task

`GET /api/v1/complaints/stats/aggregate` now returns clean keys
(`{"phishing": 9}` not `{"ComplaintCategory.phishing": 9}`) via `.value` on the
enum. Covered by a new assertion in `tests/test_api.py`.

---

## 5. Acceptance

- `npm run build` + `tsc --noEmit` + `npm run lint` + `npm run lint:dead` green.
- Every screen: loading → data → (kill backend) error+retry works, (empty DB)
  empty state shows.
- `grep -rn "mock\|MOCK\|SAMPLE_\|Static data for demonstration" frontend/src/components`
  → only test files.
- Playwright `e2e/dashboard.spec.ts` logs in and asserts a real complaint number
  (`CYB/…`) and a non-zero alert count render.
