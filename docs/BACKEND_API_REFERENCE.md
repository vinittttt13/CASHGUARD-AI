# Backend API Reference & Endpoints

CASHGUARD-AI provides a RESTful API and real-time WebSocket protocol powered by **FastAPI**, with automatic interactive Swagger documentation available at `/docs` and ReDoc at `/redoc`.

---

## 1. Authentication & Security

- **Authentication Scheme**: OAuth2 Password Flow with Bearer JWT tokens.
- **JWT Header**: `Authorization: Bearer <access_token>`
- **Token Lifespan**: Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30 minutes). Refresh tokens are valid for 7 days.
- **Roles**: `admin`, `analyst`, `viewer`.

---

## 2. Global Endpoints

### 2.1 Health Check
- **Route**: `GET /health`
- **Auth Required**: No
- **Response `200 OK`**:
  ```json
  {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2026-09-09T16:20:00.000Z"
  }
  ```

---

## 3. Authentication Endpoints (`/api/v1/auth`)

### 3.1 User Login
- **Route**: `POST /api/v1/auth/login`
- **Body (`UserLogin`)**:
  ```json
  {
    "email": "analyst1@cpaf.gov.in",
    "password": "analyst123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```
- **Error `401 Unauthorized`**: `{"detail": "Incorrect email or password"}`

### 3.2 Refresh Token
- **Route**: `POST /api/v1/auth/refresh?refresh_token=<token>`
- **Response `200 OK`**: New access token and existing refresh token.

### 3.3 Get Current Profile
- **Route**: `GET /api/v1/auth/me`
- **Auth Required**: Bearer token
- **Response `200 OK` (`UserResponse`)**:
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "analyst1@cpaf.gov.in",
    "full_name": "Priya Sharma",
    "role": "analyst",
    "jurisdiction": "Maharashtra",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00Z"
  }
  ```

### 3.4 Register New User
- **Route**: `POST /api/v1/auth/register`
- **Auth Required**: Admin role only (`require_role("admin")`)
- **Body (`UserCreate`)**:
  ```json
  {
    "email": "officer@cpaf.gov.in",
    "password": "securepassword",
    "full_name": "Officer Name",
    "role": "analyst",
    "jurisdiction": "Delhi"
  }
  ```

---

## 4. Complaints Endpoints (`/api/v1/complaints`)

### 4.1 List Complaints (Paginated & Filtered)
- **Route**: `GET /api/v1/complaints`
- **Query Parameters**:
  - `skip` (int, default: 0)
  - `limit` (int, default: 50)
  - `status` (enum: `pending`, `processing`, `predicted`, `resolved`)
  - `category` (enum: `vishing`, `phishing`, `otp_fraud`, `atm_fraud`, `other`)
  - `state` (string)
  - `start_date` / `end_date` (ISO-8601 datetime)
- **Response `200 OK` (`ComplaintListResponse`)**:
  ```json
  {
    "total": 50,
    "items": [
      {
        "id": "7b80a1c2-3d4e-4f5a-8b6c-9d0e1f2a3b4c",
        "complaint_number": "CYB/2024/10001",
        "victim_name_masked": "V****01",
        "victim_phone_masked": "98****1234",
        "complaint_text": "Received fraudulent call claiming to be bank executive...",
        "complaint_category": "vishing",
        "amount_defrauded": 45000.0,
        "currency": "INR",
        "state": "Maharashtra",
        "district": "Mumbai",
        "city": "Mumbai",
        "pincode": "400001",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "complaint_date": "2026-08-15T10:30:00Z",
        "incident_date": "2026-08-14T18:00:00Z",
        "status": "pending",
        "bank_name": "SBI",
        "account_type": "savings",
        "created_at": "2026-08-15T10:30:00Z",
        "updated_at": "2026-08-15T10:30:00Z"
      }
    ]
  }
  ```
  *(Note: Viewer role receives `***` for victim names and phone numbers).*

### 4.2 Create Incident Complaint
- **Route**: `POST /api/v1/complaints`
- **Body (`ComplaintCreate`)**:
  ```json
  {
    "complaint_number": "CYB/2024/10051",
    "complaint_text": "ATM card cloned at kiosk, 3 unauthorized withdrawals.",
    "complaint_category": "atm_fraud",
    "amount_defrauded": 30000.0,
    "state": "Delhi",
    "district": "New Delhi",
    "city": "New Delhi",
    "pincode": "110001",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "complaint_date": "2026-09-09T12:00:00Z",
    "bank_name": "HDFC"
  }
  ```

### 4.3 Aggregate Complaint Statistics
- **Route**: `GET /api/v1/complaints/stats/aggregate`
- **Response `200 OK`**:
  ```json
  {
    "by_category": {
      "vishing": 18,
      "phishing": 14,
      "atm_fraud": 10,
      "otp_fraud": 8
    },
    "by_state": {
      "Maharashtra": 22,
      "Delhi": 15,
      "Karnataka": 13
    },
    "by_status": {
      "pending": 20,
      "predicted": 15,
      "resolved": 15
    }
  }
  ```

---

## 5. Prediction & Machine Learning Endpoints (`/api/v1/predict`)

### 5.1 Run Predictive Analytics on Complaint
- **Route**: `POST /api/v1/predict`
- **Body (`PredictionRequest`)**:
  ```json
  {
    "complaint_id": "7b80a1c2-3d4e-4f5a-8b6c-9d0e1f2a3b4c",
    "force_refresh": false
  }
  ```
- **Response `200 OK` (`PredictionResponse`)**:
  ```json
  {
    "id": "e4d3c2b1-0a9b-8c7d-6e5f-4a3b2c1d0e9f",
    "complaint_id": "7b80a1c2-3d4e-4f5a-8b6c-9d0e1f2a3b4c",
    "predicted_latitude": 19.0785,
    "predicted_longitude": 72.8792,
    "confidence_score": 0.88,
    "predicted_locations": [
      {
        "lat": 19.0785,
        "lng": 72.8792,
        "atm_name": "SBI ATM - Bandra East",
        "confidence": 0.88
      }
    ],
    "hotspot_cluster_id": 2,
    "model_version": "1.0.0",
    "model_name": "xgboost_v1",
    "risk_level": "high",
    "prediction_radius_km": 3.5,
    "created_at": "2026-09-09T16:30:00Z"
  }
  ```

### 5.2 Batch Prediction
- **Route**: `POST /api/v1/predict/batch`
- **Auth Required**: Analyst or Admin role
- **Body**: `{"complaint_ids": ["uuid1", "uuid2"]}` (Max 100 per batch)

### 5.3 AML Transaction Risk Scoring
- **Route**: `POST /api/v1/predict/aml-transaction`
- **Auth Required**: any authenticated user
- **Body (`AmlTransactionRequest`)** — only `amount_paid` is required; everything else defaults sensibly:
  ```json
  {
    "amount_paid": 75000.0,
    "amount_received": 75000.0,
    "payment_currency": "Euro",
    "receiving_currency": "Euro",
    "payment_format": "Wire",
    "from_bank": "012",
    "to_bank": "020",
    "from_account": null,
    "to_account": null,
    "timestamp": null
  }
  ```
- **Response `200 OK` (`AmlTransactionResponse`)**:
  ```json
  {
    "is_laundering": 0,
    "laundering_probability": 0.0573,
    "risk_level": "low",
    "decision_threshold": 0.5,
    "top_factors": [
      {"factor": "is_cashout_format", "weight": 0.3703},
      {"factor": "payment_format_code", "weight": 0.3271}
    ],
    "model_name": "xgboost_aml",
    "model_version": "v1.0"
  }
  ```
- **`model_name` is always one of two values, never ambiguous**:
  - `"xgboost_aml"` — the real trained classifier (`backend/app/ml/aml_xgboost_model.py`) produced this result.
  - `"heuristic_aml_fallback"` — no trained artifact was loaded (see `docs/AML_FEATURE_REPORT.md` for why that happens and how to fix it); a simple 3-rule heuristic produced this result instead. The response is never labeled `"xgboost_aml"` when it wasn't.
- See **`docs/AML_FEATURE_REPORT.md`** for the full model architecture, measured accuracy (recall/precision tradeoff), training/reproduction instructions, and frontend integration (Analytics page → "AML Transaction Risk Analysis").

---

## 6. Intelligence & Alerts Endpoints (`/api/v1/intelligence`)

### 6.1 Active Intelligence Alerts
- **Route**: `GET /api/v1/intelligence/alerts`
- **Response `200 OK` (`AlertListResponse`)**: Returns active alerts with severity, geographic radius, and confidence score.

### 6.2 Acknowledge Alert
- **Route**: `PUT /api/v1/intelligence/alerts/{alert_id}/acknowledge`
- **Response `200 OK`**: Marks `is_acknowledged = true` and binds `acknowledged_by` to the current user's ID.

### 6.3 Intelligence Report & Forecast Summary
- **Route**: `GET /api/v1/intelligence/report?days=7`
- **Response `200 OK`**:
  ```json
  {
    "summary": "Cybercrime activity report",
    "total_complaints": 50,
    "active_alerts": 12,
    "generated_at": "2026-09-09T16:35:00Z",
    "recommendations": [
      "Increase monitoring at top 5 active hotspots.",
      "Deploy local task force to recent critical alert zones."
    ]
  }
  ```

---

## 7. Withdrawal Locations & Hotspots (`/api/v1/locations`)

### 7.1 List Locations & Geo-Filters
- **Route**: `GET /api/v1/locations`
- **Query Parameters**: `city`, `state`, `loc_type` (`ATM`, `bank_branch`, `payment_kiosk`).

### 7.2 High-Risk Hotspots
- **Route**: `GET /api/v1/locations/hotspots`
- **Response `200 OK`**: Returns cluster centroids with risk scores and incident counts.

### 7.3 Geospatial Heatmap Points
- **Route**: `GET /api/v1/locations/heatmap`
- **Response `200 OK`**:
  ```json
  [
    {"lat": 28.6139, "lng": 77.2090, "weight": 0.85},
    {"lat": 19.0760, "lng": 72.8777, "weight": 0.92}
  ]
  ```

---

## 8. WebSocket Protocol (`/api/v1/ws`)

### 8.1 Live Intelligence & Alert Stream
- **URL**: `ws://localhost:8000/api/v1/ws/live-feed?token=<jwt_access_token>`
- **Connection Lifecycle**:
  1. Client sends token parameter.
  2. Server validates token, connects socket, and immediately sends initial state payload:
     ```json
     {
       "type": "initial_state",
       "data": {
         "active_alerts": 5,
         "recent_complaints": []
       }
     }
     ```
  3. Server sends keep-alive heartbeat every 30 seconds:
     ```json
     {
       "type": "heartbeat",
       "timestamp": 1773160200.0
     }
     ```
  4. Real-time broadcast pushes when new predictions or critical alerts are generated:
     ```json
     {
       "type": "new_alert",
       "data": {
         "title": "High Confidence Critical Prediction",
         "priority": "critical",
         "latitude": 19.0760,
         "longitude": 72.8777
       }
     }
     ```
