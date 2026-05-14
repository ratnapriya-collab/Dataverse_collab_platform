"""Typed application settings loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="DataVerse Collab API")
    env: str = Field(default="local")
    log_level: str = Field(default="INFO")

    database_url: str = Field(
        default="postgresql+psycopg2://dataverse:dataverse@localhost:5432/dataverse"
    )

    jwt_secret: str = Field(default="dev-only-do-not-use-in-prod-please-rotate-me")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expires_minutes: int = Field(default=60 * 24 * 7)

    frontend_origins: str = Field(default="http://localhost:3000")

    @field_validator("jwt_secret")
    @classmethod
    def _reject_empty_secret(cls, v: str) -> str:
        if not v or len(v) < 16:
            raise ValueError("JWT_SECRET must be at least 16 characters long")
        return v

    @property
    def cors_origins(self) -> list[str]:
        """Parse the comma-separated FRONTEND_ORIGINS env var into a list."""
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached singleton Settings instance."""
    return Settings()
