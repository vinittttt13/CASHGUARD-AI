# 🛡️ Technical Audit: Security, RBAC & Privacy

| Audit Scope | Severity | Affected Files | Status |
| :--- | :--- | :--- | :--- |
| **JWT Authentication** | `🔴 CRITICAL` | `backend/app/core/config.py` (L8), `core/security.py` | ⚠️ Action Required |
| **Refresh Token Revocation** | `🔴 CRITICAL` | `backend/app/core/security.py`, `api/v1/auth.py` (L90) | ⚠️ Action Required |
| **Rate Limiting** | `🟠 HIGH` | `backend/app/utils/rate_limiter.py` (L6-9) | ⚠️ Action Required |
| **PII Masking** | `🟠 HIGH` | `backend/app/utils/anonymizer.py`, `api/v1/complaints.py` (L59-63) | ⚠️ Review Needed |
| **Database Input Sanitization** | `🟡 MEDIUM` | `backend/app/services/geospatial_service.py` (L118-131) | ⚠️ Review Needed |

---

## 1. Executive Summary

The CASHGUARD-AI security architecture claims RBAC, JWTBearer authentication, and automatic PII masking, but implementation contains critical gaps: the JWT `secret_key` is hard-coded (`supersecretkey`), refresh tokens are never revoked (logout is a no-op), rate limits exist only in-memory (fail under Kubernetes replication), and `complaint_text` — which frequently contains raw victim phone numbers and account details — is returned unmasked in API responses.

---

## 2. Identified Flaws & Vulnerabilities

### 2.1 Hardcoded JWT Secret Key
- **Severity**: `CRITICAL`
- **Affected File(s)**: `backend/app/core/config.py` (Line 8)
- **Root Cause Analysis**: `secret_key: str = "supersecretkey"` is a literal default in source code. The `.env` file is optional (`env_file=(".env", "../.env")`) and `extra="ignore"` means missing env vars silently fall back to defaults.
- **Potential Impact**: Any attacker with source access can forge JWT tokens, impersonate `admin`, bypass RBAC, and access all complaint data.

#### Proposed Code Fix / Implementation
```python
# Before — hardcoded literal (L8)
secret_key: str = "supersecretkey"

# After — strict env-only with validation
from pydantic import field_validator

class Settings(BaseSettings):
    secret_key: str
    
    @field_validator("secret_key")
    @classmethod
    def validate_secret(cls, v):
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be >= 32 characters")
        return v
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid",  # reject unknown/env errors
    )
```

---

### 2.2 Refresh Token Blacklisting / Revocation Absent
- **Severity**: `CRITICAL`
- **Affected File(s)**: `backend/app/core/security.py` (Lines 43-47); `backend/app/api/v1/auth.py` (Lines 90-92)
- **Root Cause Analysis**: `create_refresh_token` produces a 7-day JWT. `logout()` returns `{"message":"Successfully logged out"}` without removing the token from any store. `refresh_token_endpoint` only verifies JWT signature — never checks a revocation list.
- **Potential Impact**: Stolen refresh tokens grant indefinite access (up to 7 days) even after user logout. No mechanism exists to revoke tokens upon account suspension or breach.

#### Proposed Code Fix / Implementation
```python
# backend/app/core/redis_client.py — Add revocation helpers
async def revoke_token(jti: str, ttl_days: int = 7):
    await redis_client.set(f"revoked:{jti}", "1", ex=ttl_days*86400)

async def is_revoked(jti: str) -> bool:
    return await redis_client.exists(f"revoked:{jti}") == 1

# backend/app/core/security.py — Modify refresh check
from jose import jwt

def verify_refresh_token(token: str) -> dict:
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    jti = payload.get("jti")
    if jti and is_revoked(jti):
        raise HTTPException(status_code=401, detail="Token revoked")
    return payload

# backend/app/api/v1/auth.py — Logout actually revokes
@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user), token: str = Depends(oauth2_scheme)):
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    jti = payload.get("jti") or payload.get("sub") + ":" + str(uuid.uuid4())
    await revoke_token(jti)
    return {"message": "Successfully logged out", "revoked": True}
```

---

### 2.3 Rate Limiter — Memory-Only, No Redis Backend
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/utils/rate_limiter.py` (Lines 6-9); `backend/app/core/redis_client.py`
- **Root Cause Analysis**: `Limiter` is initialized with `key_func=get_remote_address` and no `storage_uri`. Under the Kubernetes deployment (`backend-deployment.yaml` with 3 replicas), each pod maintains its own rate-limit counter; an attacker can distribute requests across replicas to exceed limits.
- **Potential Impact**: Brute-force attacks against `/auth/login`, API scraping, and denial-of-service can bypass limits in production.

#### Proposed Code Fix / Implementation
```python
# Before — memory-only (L6-9)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"]
)

# After — Redis-backed distributed limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import get_settings

settings = get_settings()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    storage_uri=settings.redis_url,  # redis://... with auth if needed
    storage_options={"socket_connect_timeout": 5},
)
```

---

### 2.4 PII Masking — `complaint_text` Unmasked; Partial Coverage
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/utils/anonymizer.py`; `backend/app/api/v1/complaints.py` (Lines 59-63, 120-123)
- **Root Cause Analysis**: `mask_complaint_data` applies to `victim_phone`, `victim_name`, and `account_number`, but `complaint_text` (free-form notes) is never masked. A viewer can read raw texts containing victim names, bank account details, and phone numbers. The viewer-role mask in `get_complaints` only blanks `victim_name_masked` / `victim_phone_masked` but does not filter `complaint_text`.
- **Potential Impact**: Privacy breach; GDPR/Indian DPDP Act violation; exposure of victim identity to unauthorized viewers.

#### Proposed Code Fix / Implementation
```python
# backend/app/utils/anonymizer.py — Add text-level masking
import re

def mask_text(text: str) -> str:
    if not text:
        return ""
    # Mask Indian phone patterns (10 digits, with/without +91)
    text = re.sub(r"(?:\+91[-\s]?)?[6-9]\d{9}", "***PHONE***", text)
    # Mask bank account patterns (10-18 digits, often grouped)
    text = re.sub(r"\b\d{10,18}\b", "***ACCOUNT***", text)
    # Mask common PII keywords followed by names
    text = re.sub(r"(?:victim|customer|name)[\s:]*(\w+)", r"\1 [REDACTED]", text, flags=re.IGNORECASE)
    return text

# backend/app/api/v1/complaints.py — Apply to viewer responses
if current_user.role == UserRole.viewer:
    for c in complaints:
        c.victim_name_masked = "***"
        c.victim_phone_masked = "***"
        c.complaint_text = mask_text(c.complaint_text)  # NEW
```

---

### 2.5 SQL Injection / Input Sanitization — Approximate Bounding Box
- **Severity**: `MEDIUM`
- **Affected File(s)**: `backend/app/api/v1/locations.py` (Lines 118-131)
- **Root Cause Analysis**: `get_nearby_locations` uses `between()` with arithmetic on `lat_diff` / `lng_diff`. While SQLAlchemy parameterizes floats safely, the approximation is inaccurate (uses 111 km/deg approximation) and does not use PostGIS `ST_DWithin`.
- **Potential Impact**: Nearby searches miss points near the antimeridian or near poles; performance degrades with large radius because no spatial index is used.

---

## 3. Remediation Priority

| Priority | Issue | Fix Location | Effort |
|---|---|---|---|
| P0 | Hardcoded JWT secret | `core/config.py` | 1h |
| P0 | Refresh token revocation | `core/security.py`, `api/v1/auth.py`, `redis_client.py` | 3h |
| P1 | Rate limiter Redis backend | `utils/rate_limiter.py` | 30m |
| P1 | PII masking for `complaint_text` | `utils/anonymizer.py`, `api/v1/complaints.py` | 2h |
| P2 | PostGIS `ST_DWithin` for nearby | `api/v1/locations.py`, DB index | 2h |

---

*Audit completed: 2026-09-10 | Auditor: Principal Software Architect / Staff ML Engineer / Cyber Security Specialist*
