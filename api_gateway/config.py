from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    JWT_SECRET: str
    USER_SERVICE_URL: str
    CALL_SERVICE_URL: str = "http://localhost:8002"
    CALL_PROVIDER_URL: str = "http://localhost:8003"

settings = Settings()