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

    # ReplayAI rules (see docs/replayai.md). Seconds unless noted. They decide
    # which recorded attention events are worth suggesting for review.
    replay_sustained_off_screen_seconds: float = Field(default=4.0, ge=1, le=120)
    replay_glance_seconds: float = Field(default=1.0, ge=0.25, le=30)
    replay_repeated_count: int = Field(default=3, ge=2, le=20)
    replay_repeated_window_seconds: float = Field(default=30.0, ge=5, le=600)
    replay_face_absent_seconds: float = Field(default=5.0, ge=1, le=600)
    replay_interruption_count: int = Field(default=3, ge=2, le=20)
    replay_interruption_window_seconds: float = Field(default=60.0, ge=10, le=900)
    replay_context_before_seconds: float = Field(default=5.0, ge=0, le=60)
    replay_context_after_seconds: float = Field(default=3.0, ge=0, le=60)
    replay_merge_gap_seconds: float = Field(default=5.0, ge=0, le=120)
    # Delete learning sessions and attention segments older than this many
    # days on startup. 0 = keep them (default). Progress, quizzes and
    # bookmarks are never removed by retention.
    attention_retention_days: int = Field(default=0, ge=0, le=3650)

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
