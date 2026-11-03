import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Cumpleanos(Base):
    """Un cumpleaños que ofrece el complejo: una cancha de un deporte por un tiempo fijo, a
    precio cerrado. Se reserva online con seña, como un turno, pero puede ocupar varios
    turnos seguidos de la cancha."""

    __tablename__ = "cumpleanos"
    __table_args__ = (
        UniqueConstraint("negocio_id", "id", name="uq_cumpleanos_negocio_id"),
        UniqueConstraint("negocio_id", "nombre", name="uq_cumpleanos_nombre"),
        CheckConstraint("precio >= 0", name="precio_valido"),
        CheckConstraint("duracion_min BETWEEN 30 AND 480", name="duracion_valida"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    deporte_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("deportes.id"))
    nombre: Mapped[str] = mapped_column(String(60))
    duracion_min: Mapped[int]
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Qué incluye ("pelota, pecheras y un profe") y las condiciones del complejo para
    # festejar ("se puede traer torta", "máximo 20 chicos"). El jugador acepta las
    # condiciones antes de pagar la seña.
    incluye: Mapped[str | None] = mapped_column(Text)
    condiciones: Mapped[str | None] = mapped_column(Text)
    # Días y horarios en que se festeja: [{"dia_semana": 5, "desde": "14:00", "hasta":
    # "20:00"}] (hora local). Vacía: en cualquier turno de la cancha.
    franjas: Mapped[list[dict]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    orden: Mapped[int] = mapped_column(server_default=text("0"))
    creado_a: Mapped[CreadoA]
