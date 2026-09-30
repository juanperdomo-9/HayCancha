from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalizar_url_postgres(url: str) -> str:
    """Usa el driver psycopg 3 aunque la URL venga como la copia el panel de Supabase."""
    for prefijo in ("postgres://", "postgresql://"):
        if url.startswith(prefijo):
            return "postgresql+psycopg://" + url.removeprefix(prefijo)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Conexión de la app (pooler en modo transacción).
    database_url: str
    # Rol dueño de las tablas: migraciones y panel de superadmin.
    database_url_admin: str
    # URL pública del backend.
    app_base_url: str = "http://localhost:8000"
    # URL pública del frontend (CORS y links de invitación).
    frontend_url: str = "http://localhost:5173"
    # Firma de las sesiones y los links de invitación. Mínimo 32 caracteres al azar.
    jwt_secret: str = Field(min_length=32)
    # En producción (https) la cookie de sesión va con Secure.
    cookie_segura: bool = False
    # Dónde se guardan logos y portadas (en la puesta en línea, un almacenamiento de archivos).
    carpeta_archivos: Path = Path("archivos")
    # SOLO DESARROLLO: reservas online sin Mercado Pago, con un botón que simula el pago.
    pagos_simulados: bool = False

    @field_validator("database_url", "database_url_admin")
    @classmethod
    def _usar_psycopg(cls, url: str) -> str:
        return normalizar_url_postgres(url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
