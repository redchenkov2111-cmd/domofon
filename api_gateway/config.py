from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    JWT_SECRET: str
    USER_SERVICE_URL: str
    CALL_SERVICE_URL: str = "http://localhost:8002"
    CALL_PROVIDER_URL: str = "http://localhost:8003"
    
    # --- ДОБАВИТЬ ВОТ ЭТУ СТРОКУ ---
    REDIS_URL: str

settings = Settings()