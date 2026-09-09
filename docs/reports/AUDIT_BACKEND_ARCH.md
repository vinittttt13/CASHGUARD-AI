# 🛡️ Technical Audit: Backend Architecture & Distributed Systems

| Audit Scope | Severity | Affected Files | Status |
| :--- | :--- | :--- | :--- |
| **WebSocket / Real-Time** | `🔴 CRITICAL` | `backend/app/services/websocket_manager.py` (L4-21); `backend/app/api/v1/websocket.py` (L9-48) | ⚠️ Action Required |
| **Circuit Breaker** | `🟠 HIGH` | `backend/app/utils/circuit_breaker.py` (Full file) | ⚠️ Action Required |
| **Geospatial Service** | `🟠 HIGH` | `backend/app/services/geospatial_service.py` (L7-42) | ⚠️ Action Required |
| **Intelligence Service** | `🟠 HIGH` | `backend/app/services/intelligence_service.py` (L6-26) | ⚠️ Action Required |
| **Alert Service** | `🟠 HIGH` | `backend/app/services/alert_service.py` (L7-56) | ⚠️ Action Required |
| **Database Connection Pool** | `🟡 MEDIUM` | `backend/app/core/database.py` (L7-11) | ⚠️ Review Needed |

---

## 1. Executive Summary

The backend claims an async, distributed architecture with circuit-breaker isolation and Redis-backed WebSocket broadcasts, but the code is a collection of isolated mocks: `WebSocketManager` is a single-process dictionary that cannot cross Kubernetes pods; `CircuitBreaker` is never imported; `GeospatialService` returns literal `[{"location":"ATM 1"}]`; and database connection pooling lacks production tuning (`pool_pre_ping` absent, `pool_size` too low at 20). Real-time alert distribution and fault tolerance are non-functional.

---

## 2. Identified Flaws & Vulnerabilities

### 2.1 WebSocket Manager — No Cross-Replica Broadcast (Critical)
- **Severity**: `CRITICAL`
- **Affected File(s)**: `backend/app/services/websocket_manager.py` (Lines 4, 8, 16, 21); `backend/app/api/v1/websocket.py` (Lines 9, 19, 33, 42)
- **Root Cause Analysis**: `WebSocketManager` stores connections in `self.active_connections: Dict[str, WebSocket]`. This is local to the Python process. With 3 backend pods in Kubernetes (`kubernetes/backend-deployment.yaml` L4), a client connected to Pod-1 never receives broadcasts from Pod-2 or Pod-3. No Redis PubSub channel (`channel:live_alerts`) exists.
- **Potential Impact**: Critical alerts generated during predictions never reach clients on other replicas; users miss real-time notifications.

#### Proposed Code Fix / Implementation
```python
# Before — local-only (L4-21)
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

# After — Redis PubSub relay + local relay
import asyncio
from app.core.redis_client import get_redis

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.pubsub = None

    async def start_pubsub(self):
        redis_client = get_redis()
        if not redis_client:
            return
        self.pubsub = redis_client.pubsub()
        await self.pubsub.subscribe("channel:live_alerts")
        asyncio.create_task(self._listen_pubsub())

    async def _listen_pubsub(self):
        async for message in self.pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                await self.broadcast(data)

    async def broadcast(self, message_dict: dict):
        # Publish to Redis for cross-pod relay
        redis_client = get_redis()
        if redis_client:
            await redis_client.publish("channel:live_alerts", json.dumps(message_dict))
        # Local relay
        for ws in list(self.active_connections.values()):
            try:
                await ws.send_json(message_dict)
            except Exception:
                pass
```

---

### 2.2 Circuit Breaker — Never Wired (High)
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/utils/circuit_breaker.py` (Full file); `backend/app/api/v1/predict.py`; `backend/app/services/prediction_service.py`
- **Root Cause Analysis**: `CircuitBreaker` defines `CLOSED`/`OPEN`/`HALF_OPEN` states with thread-safe locks (`threading.Lock`), yet no endpoint imports it. A downstream database failure or ML model load failure propagates directly to the API client.
- **Potential Impact**: Cascading failure; if PostgreSQL is unavailable, every predict request crashes instead of being fast-failed.

#### Proposed Code Fix / Implementation
```python
# backend/app/api/v1/predict.py — Add circuit breaker wrapper
from app.utils.circuit_breaker import with_circuit_breaker

@router.post("", response_model=PredictionResponse)
@with_circuit_breaker(name="ml_prediction", failure_threshold=5, recovery_timeout=30)
async def predict(...):
    ...

# backend/app/utils/circuit_breaker.py — Ensure async compatibility
class AsyncCircuitBreaker:
    async def call(self, func, *args, **kwargs):
        # Same logic with asyncio.Lock instead of threading.Lock
        pass
```

---

### 2.3 Geospatial Service — Empty Implementations (High)
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/services/geospatial_service.py` (Lines 7-42)
- **Root Cause Analysis**: `load_atm_locations(db)` is `pass`; `find_nearest_atms` returns `[{"location":"ATM 1","distance_km":1.2}]`; `find_within_radius` returns `[]`; `get_cluster_center` always returns `(28.6139, 77.2090)`.
- **Potential Impact**: Feature engineering (`dist_to_atm`) relies on `KDTree`, but the service layer never loads real ATM coordinates, so predictions use zero-distance defaults.

#### Proposed Code Fix / Implementation
```python
# After — Real DB-backed KDTree
from sklearn.neighbors import KDTree

class GeospatialService:
    def __init__(self):
        self.kd_tree = None
        self.coords = None

    async def load_atm_locations(self, db: AsyncSession):
        from app.models.withdrawal_location import WithdrawalLocation
        result = await db.execute(select(WithdrawalLocation).where(WithdrawalLocation.is_active == True))
        locs = result.scalars().all()
        self.coords = np.array([[l.latitude, l.longitude] for l in locs])
        self.kd_tree = KDTree(self.coords, metric='euclidean')

    def find_nearest_atms(self, lat: float, lng: float, k: int = 10) -> list:
        if self.kd_tree is None:
            return []
        dist, ind = self.kd_tree.query([[lat, lng]], k=min(k, len(self.coords)))
        results = []
        for i in range(min(k, len(ind[0]))):
            idx = ind[0][i]
            d_km = self.haversine(lat, lng, self.coords[idx][0], self.coords[idx][1])
            results.append({"location": f"ATM {idx}", "distance_km": d_km})
        return results
```

---

### 2.4 Intelligence Service — Mock Data (High)
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/services/intelligence_service.py` (Lines 6-26)
- **Root Cause Analysis**: `generate_report()` returns static arrays; `get_trends()` returns fixed `daily_counts=[10,15,8,20]`; `format_recommendations()` always returns the same two strings.
- **Potential Impact**: Executive reports are fabricated; no real trend forecasting or hotspot identification.

---

### 2.5 Alert Service — Missing Geographic & Temporal Fields (High)
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/services/alert_service.py` (Lines 7-56)
- **Root Cause Analysis**: `evaluate_and_create_alerts()` creates `IntelligenceAlert` without `latitude`, `longitude`, `radius_km`, or `expires_at`. `expire_old_alerts()` uses `datetime.utcnow() - timedelta(days=1)` (only 1 day) rather than a configurable expiration.
- **Potential Impact**: Alerts have no geographic context; they never expire properly; automated response cannot locate affected zones.

---

### 2.6 Database Connection Pool — Insufficient for Production (Medium)
- **Severity**: `MEDIUM`
- **Affected File(s)**: `backend/app/core/database.py` (Lines 7-11)
- **Root Cause Analysis**: `pool_size=20`, `max_overflow=10`, no `pool_pre_ping=True`, no `pool_recycle`. Under concurrent ML inference + WebSocket broadcasts, connections may stale or exhaust.
- **Potential Impact**: Connection timeouts under load; stale connections after DB restarts.

---

## 3. Remediation Priority

| Priority | Issue | Fix Location | Effort |
|---|---|---|---|
| P0 | WebSocket PubSub relay | `services/websocket_manager.py`, `api/v1/websocket.py` | 4h |
| P1 | Circuit breaker wiring | `utils/circuit_breaker.py`, `api/v1/predict.py` | 2h |
| P1 | Geospatial DB integration | `services/geospatial_service.py` | 3h |
| P1 | Intelligence DB queries | `services/intelligence_service.py` | 2h |
| P2 | Alert fields & expiration | `services/alert_service.py` | 1h |
| P2 | DB pool tuning | `core/database.py` | 30m |

---

*Audit completed: 2026-09-10 | Auditor: Principal Software Architect / Staff ML Engineer / Cyber Security Specialist*
