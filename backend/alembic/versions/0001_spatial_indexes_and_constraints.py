"""Add spatial indexes, coordinate CHECK constraints, partial indexes, and
complaints.bank_name index.

Revision ID: 0001
Revises:
Create Date: 2026-09-10

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---- PostGIS extension (idempotent; superuser required) ----
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # ---- Coordinate CHECK constraints (reject invalid lat/lng) ----
    op.execute(
        "ALTER TABLE withdrawal_locations "
        "ADD CONSTRAINT chk_withdrawal_locations_latitude "
        "CHECK (latitude BETWEEN -90 AND 90)"
    )
    op.execute(
        "ALTER TABLE withdrawal_locations "
        "ADD CONSTRAINT chk_withdrawal_locations_longitude "
        "CHECK (longitude BETWEEN -180 AND 180)"
    )
    op.execute(
        "ALTER TABLE complaints "
        "ADD CONSTRAINT chk_complaints_latitude "
        "CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90)"
    )
    op.execute(
        "ALTER TABLE complaints "
        "ADD CONSTRAINT chk_complaints_longitude "
        "CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)"
    )
    op.execute(
        "ALTER TABLE predictions "
        "ADD CONSTRAINT chk_predictions_latitude "
        "CHECK (predicted_latitude BETWEEN -90 AND 90)"
    )
    op.execute(
        "ALTER TABLE predictions "
        "ADD CONSTRAINT chk_predictions_longitude "
        "CHECK (predicted_longitude BETWEEN -180 AND 180)"
    )

    # ---- GIST spatial index on withdrawal_locations (ST_DWithin / ST_Distance) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_withdrawal_locations_geom "
        "ON withdrawal_locations "
        "USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))"
    )

    # ---- GIST spatial index on complaints (complaint geolocation) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_complaints_geom "
        "ON complaints "
        "USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))"
    )

    # ---- GIST spatial index on predictions (predicted cash-out location) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_predictions_geom "
        "ON predictions "
        "USING GIST (ST_SetSRID(ST_MakePoint(predicted_longitude, predicted_latitude), 4326))"
    )

    # ---- Partial index: active, high-risk hotspots (most common filter) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_withdrawal_locations_active_risk "
        "ON withdrawal_locations (risk_score DESC) "
        "WHERE is_active = true AND risk_score >= 0.5"
    )

    # ---- Partial index: unacknowledged active alerts (dashboard default) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_active_unack "
        "ON intelligence_alerts (created_at DESC) "
        "WHERE is_active = true AND is_acknowledged = false"
    )

    # ---- Partial index: active alerts with expiry (cleanup sweep) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_expires "
        "ON intelligence_alerts (expires_at) "
        "WHERE is_active = true AND expires_at IS NOT NULL"
    )

    # ---- GIN index on predictions.predicted_locations JSONB (->> containment) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_predictions_predicted_locations_gin "
        "ON predictions USING GIN (predicted_locations)"
    )

    # ---- GIN index on predictions.feature_importance JSONB (SHAP lookups) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_predictions_feature_importance_gin "
        "ON predictions USING GIN (feature_importance)"
    )

    # ---- GIN index on intelligence_alerts.affected_locations JSONB ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_intelligence_alerts_affected_locations_gin "
        "ON intelligence_alerts USING GIN (affected_locations)"
    )

    # ---- Index on complaints.bank_name (fraud-ring graph analytics filter) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_complaints_bank_name "
        "ON complaints (bank_name)"
    )

    # ---- Index on predictions.risk_level (high-risk filter) ----
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_predictions_risk_level "
        "ON predictions (risk_level)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_predictions_risk_level")
    op.execute("DROP INDEX IF EXISTS ix_complaints_bank_name")
    op.execute("DROP INDEX IF EXISTS ix_intelligence_alerts_affected_locations_gin")
    op.execute("DROP INDEX IF EXISTS ix_predictions_feature_importance_gin")
    op.execute("DROP INDEX IF EXISTS ix_predictions_predicted_locations_gin")
    op.execute("DROP INDEX IF EXISTS ix_intelligence_alerts_expires")
    op.execute("DROP INDEX IF EXISTS ix_intelligence_alerts_active_unack")
    op.execute("DROP INDEX IF EXISTS ix_withdrawal_locations_active_risk")
    op.execute("DROP INDEX IF EXISTS ix_predictions_geom")
    op.execute("DROP INDEX IF EXISTS ix_complaints_geom")
    op.execute("DROP INDEX IF EXISTS ix_withdrawal_locations_geom")
    op.execute("ALTER TABLE predictions DROP CONSTRAINT IF EXISTS chk_predictions_longitude")
    op.execute("ALTER TABLE predictions DROP CONSTRAINT IF EXISTS chk_predictions_latitude")
    op.execute("ALTER TABLE complaints DROP CONSTRAINT IF EXISTS chk_complaints_longitude")
    op.execute("ALTER TABLE complaints DROP CONSTRAINT IF EXISTS chk_complaints_latitude")
    op.execute("ALTER TABLE withdrawal_locations DROP CONSTRAINT IF EXISTS chk_withdrawal_locations_longitude")
    op.execute("ALTER TABLE withdrawal_locations DROP CONSTRAINT IF EXISTS chk_withdrawal_locations_latitude")
    op.execute("DROP EXTENSION IF EXISTS postgis")