from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Animepride"
    app_env: str = "development"
    database_url: str = "sqlite:///./animepride.db"
    jwt_secret: str = "dev-only-change-this-secret-before-deploying"
    jwt_expire_minutes: int = 720
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    frontend_origin: str = "http://localhost:8080"
    jikan_base_url: str = "https://api.jikan.moe/v4"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

settings = Settings()
