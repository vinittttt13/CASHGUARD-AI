from functools import lru_cache
from typing import List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "change-me-to-a-secure-random-key-at-least-32-chars-long!"
DEFAULT_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/cybercrime"
DEFAULT_REDIS_URL = "redis://localhost:6379/0"
# Other insecure fallbacks checked into docker-compose.yml / .env.example —
# flagged too, since production must not inherit either of them.
_KNOWN_INSECURE_SECRET_KEYS = {DEFAULT_SECRET_KEY, "your-secret-key-change-in-production"}


class Settings(BaseSettings):
    database_url: str = DEFAULT_DATABASE_URL
    redis_url: str = DEFAULT_REDIS_URL
    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # Deployment environment: "development" | "staging" | "production".
    # Anything other than "development" requires CORS_ORIGINS to be set
    # explicitly (see app.main) — no wildcard fallback.
    environment: str = "development"
    # When true, init_db() creates tables via SQLAlchemy metadata (used by the
    # test suite). In every other environment the schema is owned by Alembic.
    testing: bool = False
    cors_origins: List[str] = []
    log_level: str = "INFO"
    model_version: str = "1.0.0"
    # Where trained model artifacts live. "" -> local disk only
    # (backend/app/ml/model_artifacts). "s3://bucket/prefix" -> object store.
    model_store_uri: str = ""
    geocoding_timeout: int = 10
    max_prediction_radius_km: float = 50.0

    # Rate limiting
    rate_limit_enabled: bool = True
    rate_limit_global: str = "300/minute"
    rate_limit_login: str = "5/minute"
    rate_limit_predict: str = "60/minute"

    # Database connection pool settings (high concurrency)
    db_pool_size: int = 50
    db_max_overflow: int = 20
    db_pool_recycle: int = 3600
    db_pool_timeout: int = 30
    db_pool_pre_ping: bool = True

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return v

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.environment == "production":
            insecure = []
            if self.secret_key in _KNOWN_INSECURE_SECRET_KEYS:
                insecure.append("SECRET_KEY")
            if self.database_url == DEFAULT_DATABASE_URL:
                insecure.append("DATABASE_URL")
            if self.redis_url == DEFAULT_REDIS_URL:
                insecure.append("REDIS_URL")
            if insecure:
                raise ValueError(
                    "Refusing to start with ENVIRONMENT=production while using "
                    f"default/insecure values for: {', '.join(insecure)}. "
                    "Set real values via environment variables or .env."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )


@lru_cache
def get_settings():
    return Settings()
