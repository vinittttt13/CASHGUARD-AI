from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/cybercrime"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "supersecretkey"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: List[str] = ["*"]
    log_level: str = "INFO"
    model_version: str = "1.0.0"
    geocoding_timeout: int = 10
    max_prediction_radius_km: float = 50.0

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )

@lru_cache
def get_settings():
    return Settings()
