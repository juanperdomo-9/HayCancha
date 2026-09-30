import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk

# Estados que ocupan el turno. La restricción reservas_sin_superposicion (en la
# migración 0002) usa esta misma lista.
ESTADOS_QUE_OCUPAN = ("pendiente_pago", "confirmada", "bloqueada")


class Reserva(Base):
    """Un turno reservado o bloqueado en una cancha.

    La regla de que dos reservas no se pisan vive en la base: ver la restricción
    EXCLUDE reservas_sin_superposicion en la migración 0002.
    """

    __tablename__ = "reservas"
    __table_args__ = (
        UniqueConstraint("negocio_id", "id", name="uq_reservas_negocio_id_id"),
        ForeignKeyConstraint(
            ["negocio_id", "recurso_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_reservas_recurso",
        ),
        ForeignKeyConstraint(
            ["negocio_id", "cliente_id"],
            ["clientes.negocio_id", "clientes.id"],
            name="fk_reservas_cliente",
        ),
        ForeignKeyConstraint(
            ["negocio_id", "reserva_origen_id"],
            ["reservas.negocio_id", "reservas.id"],
            name="fk_reservas_origen",
        ),
        CheckConstraint("fin > inicio", name="fin_despues_de_inicio"),
        CheckConstraint(
            "estado IN ('pendiente_pago', 'confirmada', 'vencida', 'cancelada', 'bloqueada')",
            name="estado_valido",
        ),
        CheckConstraint("origen IN ('web', 'panel', 'bot')", name="origen_valido"),
        CheckConstraint(
            "asistencia IS NULL OR asistencia IN ('vino', 'no_vino')", name="asistencia_valida"
        ),
        # Un bloqueo no tiene jugador; una reserva de verdad siempre tiene. Una cancelada
        # puede ser cualquiera de las dos (una reserva cancelada o un bloqueo levantado).
        CheckConstraint(
            "(estado = 'bloqueada' AND cliente_id IS NULL)"
            " OR (estado IN ('pendiente_pago', 'confirmada', 'vencida') AND cliente_id IS NOT NULL)"
            " OR estado = 'cancelada'",
            name="cliente_segun_estado",
        ),
        CheckConstraint("precio IS NULL OR precio >= 0", name="precio_no_negativo"),
        CheckConstraint("sena >= 0", name="sena_no_negativa"),
        Index("ix_reservas_negocio_inicio", "negocio_id", "inicio"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    recurso_id: Mapped[uuid.UUID]
    cliente_id: Mapped[uuid.UUID | None]
    # Solo en las reservas espejo de canchas combinadas.
    reserva_origen_id: Mapped[uuid.UUID | None]
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fin: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    estado: Mapped[str] = mapped_column(String)
    precio: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    sena: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0")
    sena_en_efectivo: Mapped[bool] = mapped_column(server_default=text("false"))
    saldo_cobrado: Mapped[bool] = mapped_column(server_default=text("false"))
    asistencia: Mapped[str | None] = mapped_column(String)
    motivo_bloqueo: Mapped[str | None] = mapped_column(String)
    vence_a: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mp_preference_id: Mapped[str | None] = mapped_column(String)
    # Link de Checkout Pro para pagar la seña (mientras está pendiente de pago).
    url_pago: Mapped[str | None] = mapped_column(String)
    # Cuántas veces el jugador cambió el horario desde la página (se permite una).
    cambios_de_horario: Mapped[int] = mapped_column(server_default=text("0"))
    # Conexión desde la que se reservó online, transformada con una clave (HMAC): sirve
    # para el tope de reservas sin pagar sin guardar la IP.
    conexion: Mapped[str | None] = mapped_column(String)
    origen: Mapped[str] = mapped_column(String)
    creado_por: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"))
    creado_a: Mapped[CreadoA]
