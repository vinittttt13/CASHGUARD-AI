-- CASHGUARD-AI / CPAF — Full Schema + Indexes (matches Alembic 0001)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

CREATE TABLE IF NOT EXISTS withdrawal_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    amount DECIMAL(15,2),
    risk_score DECIMAL(5,4) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_withdrawal_locations_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_withdrawal_locations_longitude CHECK (longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS ix_withdrawal_locations_geom ON withdrawal_locations USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));
CREATE INDEX IF NOT EXISTS ix_withdrawal_locations_active_risk ON withdrawal_locations (risk_score DESC) WHERE is_active = true AND risk_score >= 0.5;

CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    victim_name_masked VARCHAR(100),
    victim_phone_masked VARCHAR(20),
    complaint_text TEXT,
    bank_name VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    status VARCHAR(30) DEFAULT 'open',
    category VARCHAR(30),
    state VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_complaints_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_complaints_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS ix_complaints_geom ON complaints USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));
CREATE INDEX IF NOT EXISTS ix_complaints_bank_name ON complaints (bank_name);

CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    predicted_latitude DECIMAL(10,8) NOT NULL,
    predicted_longitude DECIMAL(11,8) NOT NULL,
    risk_level VARCHAR(20),
    predicted_locations JSONB,
    feature_importance JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_predictions_latitude CHECK (predicted_latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_predictions_longitude CHECK (predicted_longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS ix_predictions_geom ON predictions USING GIST (ST_SetSRID(ST_MakePoint(predicted_longitude, predicted_latitude), 4326));
CREATE INDEX IF NOT EXISTS ix_predictions_predicted_locations_gin ON predictions USING GIN (predicted_locations);
CREATE INDEX IF NOT EXISTS ix_predictions_feature_importance_gin ON predictions USING GIN (feature_importance);
CREATE INDEX IF NOT EXISTS ix_predictions_risk_level ON predictions (risk_level);

CREATE TABLE IF NOT EXISTS intelligence_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affected_locations JSONB,
    is_active BOOLEAN DEFAULT true,
    is_acknowledged BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_active_unack ON intelligence_alerts (created_at DESC) WHERE is_active = true AND is_acknowledged = false;
CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_expires ON intelligence_alerts (expires_at) WHERE is_active = true AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_affected_locations_gin ON intelligence_alerts USING GIN (affected_locations);
