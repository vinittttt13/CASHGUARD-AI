# 🛡️ Technical Audit: Database Schema, Indexing & Constraints

| Audit Scope | Severity | Affected Files | Status |
| :--- | :--- | :--- | :--- |
| **Spatial Indexes (PostGIS)** | `🔴 CRITICAL` | `backend/app/models/withdrawal_location.py`; DB schema | ⚠️ Action Required |
| **Prediction Query Performance** | `🟠 HIGH` | `backend/app/models/prediction.py`; `predictions` table | ⚠️ Action Required |
| **Alert Expiration Cleanup** | `🟠 HIGH` | `backend/app/models/intelligence_alert.py`; `intelligence_alerts` table | ⚠️ Action Required |
| **Coordinate Validation** | `🟠 HIGH` | `backend/app/models/complaint.py`; `withdrawal_location.py` | ⚠️ Action Required |
| **Partial / Unique Indexes** | `🟡 MEDIUM` | All tables | ⚠️ Review Needed |

---

## 1. Executive Summary

The PostgreSQL + PostGIS schema defined in `models/` and `init_db.sql` creates tables but omits all critical production indexes: no `GIST` spatial index on `withdrawal_locations`, no `GIN` index on JSONB `predicted_locations`, no partial index on `intelligence_alerts.expires_at`, and zero `CHECK` constraints on latitude/longitude. Without these, hotspot queries, radius searches, and alert expiration cleanups will degrade linearly with data volume, making real-time analytics impossible at scale.

---

## 2. Identified Flaws & Vulnerabilities

### 2.1 Missing PostGIS GIST Spatial Index — Critical Performance Gap
- **Severity**: `CRITICAL`
- **Affected File(s)**: `backend/app/models/withdrawal_location.py` (Lines 12-47); DB initialization (`init_db.sql`)
- **Root Cause Analysis**: `latitude` / `longitude` columns exist but no `CREATE INDEX ... USING GIST` is applied. The `nearby` endpoint (`api/v1/locations.py`) approximates with `between()` instead of `ST_DWithin`. Without GIST, every nearby query performs a full table scan.
- **Potential Impact**: Query time grows O(n) with ATM count; at 10k+ locations, real-time map rendering and geofence checks become unusable.

#### Proposed Code Fix / Implementation
```sql
-- Add to init_db.sql or Alembic migration
CREATE INDEX IF NOT EXISTS idx_withdrawal_locations_spatial
ON withdrawal_locations USING GIST (latitude, longitude);

-- For predictions (spatial lookup by predicted point)
CREATE INDEX IF NOT EXISTS idx_predictions_spatial
ON predictions USING GIST (predicted_latitude, predicted_longitude);

-- Partial index for active hotspots (high-risk only)
CREATE INDEX IF NOT EXISTS idx_hotspots_risk
ON withdrawal_locations (latitude, longitude)
WHERE is_active = TRUE AND risk_score > 0.5;
```

---

### 2.2 Missing Index on Intelligence Alert Expiration — Cleanup Bottleneck
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/models/intelligence_alert.py` (Line 41); `api/v1/intelligence.py`
- **Root Cause Analysis**: `expires_at` is nullable (`TIMESTAMPTZ`) and has no index. `expire_old_alerts()` in `alert_service.py` queries `created_at < cutoff`, not `expires_at`. A missing index on `expires_at` prevents efficient expiration-based cleanup.
- **Potential Impact**: Old alerts accumulate; DB bloat; manual cleanup required.

#### Proposed Code Fix / Implementation
```sql
CREATE INDEX IF NOT EXISTS idx_alerts_expires_at
ON intelligence_alerts (expires_at) WHERE expires_at IS NOT NULL;

-- Update expiration logic to use index-friendly query
UPDATE intelligence_alerts
SET is_active = FALSE
WHERE is_active = TRUE
  AND expires_at IS NOT NULL
  AND expires_at < CURRENT_TIMESTAMP;
```

---

### 2.3 No Coordinate Validation Constraints — Data Integrity Risk
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/models/complaint.py` (Lines 36-37); `withdrawal_location.py` (Lines 18-19)
- **Root Cause Analysis**: `latitude` / `longitude` are `Float` with `nullable=True` and zero `CHECK` constraints. Invalid values (e.g., latitude = 999, longitude = -999) can be inserted silently, corrupting spatial calculations.
- **Potential Impact**: Corrupted predictions; invalid heatmap points; incorrect cluster centroids.

#### Proposed Code Fix / Implementation
```sql
-- Add via Alembic or SQL
ALTER TABLE complaints ADD CONSTRAINT chk_complaints_lat CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE complaints ADD CONSTRAINT chk_complaints_lng CHECK (longitude BETWEEN -180 AND 180);

ALTER TABLE withdrawal_locations ADD CONSTRAINT chk_withdrawal_lat CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE withdrawal_locations ADD CONSTRAINT chk_withdrawal_lng CHECK (longitude BETWEEN -180 AND 180);

-- Add NOT NULL for active withdrawal locations
ALTER TABLE withdrawal_locations ALTER COLUMN latitude SET NOT NULL;
ALTER TABLE withdrawal_locations ALTER COLUMN longitude SET NOT NULL;
```

---

### 2.4 JSONB Feature Importance — No Functional Index
- **Severity**: `MEDIUM`
- **Affected File(s)**: `backend/app/models/prediction.py` (Line 26)
- **Root Cause Analysis**: `feature_importance` (JSONB) stores SHAP attribution arrays but has no `GIN` index. Queries filtering by feature importance (e.g., "find predictions where amount_log > 0.5") require full JSONB scans.
- **Potential Impact**: Slow analytics queries; inability to quickly retrieve high-importance predictions.

#### Proposed Code Fix / Implementation
```sql
CREATE INDEX IF NOT EXISTS idx_predictions_feature_importance
ON predictions USING GIN (feature_importance);

-- For top-k lookup by complaint
CREATE INDEX IF NOT EXISTS idx_predictions_complaint
ON predictions (complaint_id, created_at DESC);
```

---

### 2.5 Partial / Unique Constraints — Duplicate Data Risk
- **Severity**: `MEDIUM`
- **Affected File(s)**: `backend/app/models/complaint.py` (Line 25)
- **Root Cause Analysis**: `complaint_number` has `unique=True` but SQL `UNIQUE` treats NULL values as distinct (multiple NULL complaint_numbers allowed). `victim_name_masked` and `victim_phone_masked` are nullable (`String, nullable=True`) rather than `NOT NULL` with a masking default.
- **Potential Impact**: Duplicate complaint records; missing masked fields in exports.

---

## 3. Recommended Schema Migration Sequence

| Step | SQL Command | Table | Impact |
|---|---|---|---|
| 1 | `CREATE INDEX ... GIST (lat, lng)` | `withdrawal_locations` | Enables rapid nearby / hotspot queries |
| 2 | `CREATE INDEX ... GIST (pred_lat, pred_lng)` | `predictions` | Enables radius-based prediction lookup |
| 3 | `CREATE INDEX ... WHERE is_active` | `withdrawal_locations` | Partial index for active hotspots |
| 4 | `ALTER ... ADD CONSTRAINT ... CHECK` | `complaints`, `withdrawal_locations` | Prevents invalid coordinates |
| 5 | `CREATE INDEX ... (expires_at) WHERE ...` | `intelligence_alerts` | Efficient expiration cleanup |
| 6 | `CREATE INDEX ... GIN (feature_importance)` | `predictions` | Fast SHAP analytics |

---

*Audit completed: 2026-09-10 | Auditor: Principal Software Architect / Staff ML Engineer / Cyber Security Specialist*
