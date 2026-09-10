-- CASHGUARD-AI / CPAF — Full Database Initialization Schema + Seed Users
-- Matches SQLAlchemy models and Alembic 0001 migration exactly
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    jurisdiction VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

-- 2. Withdrawal Locations (ATMs / POIs)
CREATE TABLE IF NOT EXISTS withdrawal_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(30) DEFAULT 'ATM',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    bank_name VARCHAR(100),
    atm_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    risk_score DOUBLE PRECISION DEFAULT 0.0,
    last_incident_date TIMESTAMP WITH TIME ZONE,
    incident_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_withdrawal_locations_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_withdrawal_locations_longitude CHECK (longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS ix_withdrawal_locations_geom ON withdrawal_locations USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));
CREATE INDEX IF NOT EXISTS ix_withdrawal_locations_active_risk ON withdrawal_locations (risk_score DESC) WHERE is_active = true AND risk_score >= 0.5;

-- 3. Complaints
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_number VARCHAR(100) UNIQUE NOT NULL,
    victim_name_masked VARCHAR(100),
    victim_phone_masked VARCHAR(20),
    complaint_text TEXT NOT NULL,
    complaint_category VARCHAR(30) DEFAULT 'other',
    amount_defrauded DOUBLE PRECISION DEFAULT 0.0,
    currency VARCHAR(10) DEFAULT 'INR',
    state VARCHAR(100),
    district VARCHAR(100),
    city VARCHAR(100),
    pincode VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    complaint_date TIMESTAMP WITH TIME ZONE,
    incident_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) DEFAULT 'pending',
    bank_name VARCHAR(100),
    account_type VARCHAR(50),
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_complaints_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_complaints_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS ix_complaints_number ON complaints(complaint_number);
CREATE INDEX IF NOT EXISTS ix_complaints_geom ON complaints USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));
CREATE INDEX IF NOT EXISTS ix_complaints_bank_name ON complaints (bank_name);

-- 4. Predictions
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    predicted_latitude DOUBLE PRECISION NOT NULL,
    predicted_longitude DOUBLE PRECISION NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    predicted_locations JSONB,
    hotspot_cluster_id INTEGER,
    model_version VARCHAR(50),
    model_name VARCHAR(100),
    feature_importance JSONB,
    risk_level VARCHAR(20) DEFAULT 'medium',
    prediction_radius_km DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_predictions_latitude CHECK (predicted_latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_predictions_longitude CHECK (predicted_longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS ix_predictions_geom ON predictions USING GIST (ST_SetSRID(ST_MakePoint(predicted_longitude, predicted_latitude), 4326));
CREATE INDEX IF NOT EXISTS ix_predictions_predicted_locations_gin ON predictions USING GIN (predicted_locations);
CREATE INDEX IF NOT EXISTS ix_predictions_feature_importance_gin ON predictions USING GIN (feature_importance);
CREATE INDEX IF NOT EXISTS ix_predictions_risk_level ON predictions (risk_level);

-- 5. Intelligence Alerts
CREATE TABLE IF NOT EXISTS intelligence_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    alert_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_km DOUBLE PRECISION,
    affected_locations JSONB,
    confidence_score DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT true,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_active_unack ON intelligence_alerts (created_at DESC) WHERE is_active = true AND is_acknowledged = false;
CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_expires ON intelligence_alerts (expires_at) WHERE is_active = true AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_affected_locations_gin ON intelligence_alerts USING GIN (affected_locations);

-- 6. Default Seed Users (admin123, analyst123, viewer123)
INSERT INTO users (email, hashed_password, full_name, role, jurisdiction, is_active, is_superuser)
VALUES
    ('admin@cpaf.gov.in', '$2b$12$3wXs7B6eBcyk7jXl2S.5t.rJQCx4Hq/4nEEl4TBJjtVktud6/SZeK', 'CPAF Administrator', 'admin', 'National', true, true),
    ('analyst@cpaf.gov.in', '$2b$12$TLgmebEtUyJ518q8vnIkQuFSLStYs66FXrksjiH9VE9eWZDF67U0S', 'Priya Sharma', 'analyst', 'Maharashtra', true, false),
    ('viewer@cpaf.gov.in', '$2b$12$gCz3SFfK3g4szECV0iwIqelb3d0UGGftgTBVHOiqFO37C7nXWH4Z.', 'Amit Verma', 'viewer', 'Karnataka', true, false)
ON CONFLICT (email) DO NOTHING;
