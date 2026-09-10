from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/cybercrime"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-to-a-secure-random-key-at-least-32-chars-long!"
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
    geocoding_timeout: int = 10
    max_prediction_radius_km: float = 50.0

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
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return v

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )


@lru_cache
def get_settings():
    return Settings()
