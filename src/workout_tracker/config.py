from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["dev", "prod", "test"] = Field(default="dev")
    database_url: str = Field(default=f"sqlite:///{Path('var').absolute() / 'workout.sqlite3'}")
    auth_rp_id: str = Field(default="localhost")
    auth_origin: str = Field(default="http://localhost:5173")
    frontend_base_url: str = Field(default="http://localhost:8000")
    kdf_iterations: int = Field(default=390_000)
    encryption_algorithm: Literal["fernet"] = Field(default="fernet")
    challenge_ttl_seconds: int = Field(default=300)
    session_secret: str = Field(default="dev-change-me")

    apple_team_id: str | None = None
    apple_client_id: str | None = None
    apple_key_id: str | None = None
    apple_private_key: str | None = None

    @computed_field  # type: ignore[misc]
    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


class CryptoSettings(BaseModel):
    salt_bytes: int = 16
    derived_key_bytes: int = 32


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
