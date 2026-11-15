from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent

# The .env file lives in the project root. A backend/.env (if present) takes
# precedence, so `uvicorn` works the same from the root or from backend/.
# Real environment variables always override both files.
ENV_FILES = (PROJECT_ROOT / ".env", BACKEND_DIR / ".env")


class Settings(BaseSettings):
    mongo_uri: str
    mongo_db_name: str
    mongo_timeout_ms: int = Field(default=5000, ge=100, le=60000)
    secret_key: SecretStr
    cors_origins: list[str]
    bcrypt_rounds: int = Field(default=12, ge=4, le=16)
    access_token_ttl_minutes: int = Field(default=30, ge=1, le=60 * 24)
    environment: Literal["development", "production"] = Field(
        default="development", validation_alias="ENV"
    )
    # Uploaded lesson videos. Must be persistent storage (a Docker volume in
    # Compose). Relative paths are resolved against the backend directory.
    video_storage_dir: Path = Path("storage/videos")
    max_video_upload_bytes: int = Field(default=1024 * 1024 * 1024, ge=1024, le=20 * 1024**3)
    user_video_quota_bytes: int = Field(default=5 * 1024**3, ge=1024, le=500 * 1024**3)
    # Seed the example catalog on startup (idempotent). Off unless configured.
    seed_catalog: bool = False

    @field_validator("video_storage_dir")
    @classmethod
    def resolve_storage_dir(cls, value: Path) -> Path:
        return value if value.is_absolute() else (BACKEND_DIR / value).resolve()

    @field_validator("secret_key")
    @classmethod
    def require_strong_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().encode("utf-8")) < 32:
            raise ValueError("SECRET_KEY must be at least 32 bytes.")
        return value

    @field_validator("cors_origins")
    @classmethod
    def reject_wildcard_origin(cls, value: list[str]) -> list[str]:
        # Credentials (the session cookie) must never be shared with "*".
        if "*" in value:
            raise ValueError("CORS_ORIGINS must list explicit origins, not '*'.")
        return value

    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
