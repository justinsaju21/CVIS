"""
CVIS Backend — config.py
-------------------------
Centralised settings loaded from environment variables / .env file.
Using pydantic-settings keeps config validated and typed.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"
    DATABASE_URL: str = "cvis.db"


settings = Settings()
