from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr, field_validator


class Settings(BaseSettings):
    mongo_uri: str
    mongo_db_name: str
    secret_key: SecretStr
    cors_origins: list[str]
    environment: Literal["development", "production"] = Field(
        default="development", validation_alias="ENV"
    )

    @field_validator("secret_key")
    @classmethod
    def require_strong_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().encode("utf-8")) < 32:
            raise ValueError("SECRET_KEY must be at least 32 bytes.")
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
