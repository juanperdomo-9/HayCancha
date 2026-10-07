from datetime import datetime
from decimal import Decimal

from sqlalchemy import ARRAY, CheckConstraint, DateTime, Double, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Negocio(Base):
    """Un complejo (el cliente de HayCanchas)."""

    __tablename__ = "negocios"
    __table_args__ = (
        CheckConstraint("slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name="slug_valido"),
        CheckConstraint("sena_tipo IN ('fija', 'porcentaje')", name="sena_tipo_valido"),
        CheckConstraint(
            "sena_valor >= 0 AND (sena_tipo <> 'porcentaje' OR sena_valor <= 100)",
            name="sena_valor_valido",
        ),
        CheckConstraint("minutos_para_pagar > 0", name="minutos_para_pagar_positivo"),
        CheckConstraint("horas_cancelacion >= 0", name="horas_cancelacion_valida"),
        CheckConstraint(
            "estado_cuenta IN ('al_dia', 'atrasado', 'suspendido')", name="estado_cuenta_valido"
        ),
    )

    id: Mapped[UuidPk]
    slug: Mapped[str] = mapped_column(String, unique=True)
    nombre: Mapped[str] = mapped_column(String)
    rubro: Mapped[str] = mapped_column(String, server_default="deportes")
    logo_url: Mapped[str | None] = mapped_column(String)
    portada_url: Mapped[str | None] = mapped_column(String)
    color_primario: Mapped[str] = mapped_column(String, server_default="#1E7A3E")
    color_secundario: Mapped[str | None] = mapped_column(String)
    zona_horaria: Mapped[str] = mapped_column(
        String, server_default="America/Argentina/Buenos_Aires"
    )
    direccion: Mapped[str | None] = mapped_column(String)
    barrio: Mapped[str | None] = mapped_column(String)
    # Cómo llegar: "al lado de la YPF". Se muestra, pero no se busca en el mapa.
    referencia: Mapped[str | None] = mapped_column(String)
    servicios: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default=text("'{}'::varchar[]")
    )
    sena_tipo: Mapped[str] = mapped_column(String, server_default="porcentaje")
    sena_valor: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="20")
    minutos_para_pagar: Mapped[int] = mapped_column(server_default="10")
    # Sin valor por defecto: se acuerda con cada complejo en el alta.
    horas_cancelacion: Mapped[int]
    plan: Mapped[str | None] = mapped_column(String)
    estado_cuenta: Mapped[str] = mapped_column(String, server_default="al_dia")
    # Mercado Pago (fase 2). Los tokens van encriptados y nunca salen del backend.
    # WhatsApp para consultas (opcional): si está, la página muestra "Consultar por WhatsApp".
    whatsapp: Mapped[str | None] = mapped_column(String)
    # Ubicación para el mapa de la página principal (la marca el dueño o el equipo).
    # Asistente de IA del complejo (fase 3).
    asistente_activo: Mapped[bool] = mapped_column(server_default=text("true"))
    asistente_nombre: Mapped[str | None] = mapped_column(String)
    asistente_bienvenida: Mapped[str | None] = mapped_column(String)
    asistente_conocimiento: Mapped[str | None] = mapped_column(Text)
    latitud: Mapped[float | None] = mapped_column(Double)
    longitud: Mapped[float | None] = mapped_column(Double)
    mp_user_id: Mapped[str | None] = mapped_column(String)
    mp_access_token_enc: Mapped[str | None] = mapped_column(String)
    mp_refresh_token_enc: Mapped[str | None] = mapped_column(String)
    mp_token_vence_a: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    creado_a: Mapped[CreadoA]
