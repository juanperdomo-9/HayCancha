from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
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
    # Supabase Storage para logos y portadas (producción). Vacíos: se usa la carpeta.
    supabase_url: str = ""
    # Settings > API Keys > Secret keys (sb_secret_...). Nunca en el frontend.
    supabase_secret_key: str = ""
    # Bucket público (Storage > New bucket, marcado como Public).
    supabase_bucket: str = "archivos"
    # SOLO DESARROLLO: reservas online sin Mercado Pago, con un botón que simula el pago.
    pagos_simulados: bool = False

    # Clave Fernet para encriptar los tokens de Mercado Pago (python -m app.cli generar-clave).
    token_encryption_key: str = ""
    # App de HayCancha en Mercado Pago Developers (OAuth para vincular cada complejo).
    mp_client_id: str = ""
    mp_client_secret: str = ""
    # Adonde vuelve Mercado Pago después de autorizar. Vacío: {APP_BASE_URL}/mercadopago/callback.
    # Tiene que ser exactamente la misma que la cargada en la app de Mercado Pago.
    mp_redirect_uri: str = ""
    # Clave secreta de webhooks (Tus integraciones > Webhooks): valida la firma de los avisos.
    mp_webhook_secret: str = ""
    # Resend: avisos al dueño e invitaciones. Sin clave, los emails solo se muestran en el log.
    email_api_key: str = ""
    # Remitente, con el dominio verificado en Resend: "HayCancha <avisos@mail.haycancha.com.ar>".
    email_from: str = ""
    # true para vincular cuentas de prueba de Mercado Pago (devuelve credenciales TEST-).
    mp_tokens_de_prueba: bool = False

    # Asistentes de IA (fase 3): API compatible con OpenAI. Hoy Groq (plan gratis).
    llm_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_modelo: str = "openai/gpt-oss-120b"
    # El asistente de cada complejo, suspendido por ahora (el buscador de la home sigue).
    asistentes_de_complejo: bool = False

    @property
    def mercadopago_configurado(self) -> bool:
        return bool(self.mp_client_id and self.mp_client_secret and self.token_encryption_key)

    @property
    def mp_callback(self) -> str:
        return self.mp_redirect_uri or f"{self.app_base_url}/mercadopago/callback"

    @field_validator("database_url", "database_url_admin")
    @classmethod
    def _usar_psycopg(cls, url: str) -> str:
        return normalizar_url_postgres(url)

    @model_validator(mode="after")
    def _sin_pagos_simulados_en_produccion(self) -> "Settings":
        # Se permiten en la web de pruebas mientras no haya Mercado Pago. Con la app de
        # Mercado Pago cargada (cobro real) no arranca: así no se olvida sacarlos.
        if self.pagos_simulados and self.mp_client_id:
            raise ValueError(
                "PAGOS_SIMULADOS no se puede usar con Mercado Pago configurado (MP_CLIENT_ID). "
                "Sacá PAGOS_SIMULADOS."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
