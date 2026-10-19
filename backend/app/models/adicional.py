import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Adicional(Base):
    """Algo que el complejo alquila aparte del turno: paletas, pelotas, parrilla. Si tiene
    deporte, solo se ofrece en ese (las paletas, en el pádel)."""

    __tablename__ = "adicionales"
    __table_args__ = (
        UniqueConstraint("negocio_id", "id", name="uq_adicionales_negocio_id"),
        UniqueConstraint("negocio_id", "nombre", name="uq_adicionales_nombre"),
        CheckConstraint("precio >= 0", name="precio_valido"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    nombre: Mapped[str] = mapped_column(String(60))
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    deporte_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("deportes.id"))
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    orden: Mapped[int] = mapped_column(server_default=text("0"))
    creado_a: Mapped[CreadoA]


class ReservaAdicional(Base):
    """Lo que se pidió en una reserva, con el nombre y el precio de ese momento."""

    __tablename__ = "reservas_adicionales"
    __table_args__ = (
        PrimaryKeyConstraint("reserva_id", "adicional_id"),
        ForeignKeyConstraint(
            ["negocio_id", "reserva_id"],
            ["reservas.negocio_id", "reservas.id"],
            name="fk_reservas_adicionales_reserva",
        ),
        ForeignKeyConstraint(
            ["negocio_id", "adicional_id"],
            ["adicionales.negocio_id", "adicionales.id"],
            name="fk_reservas_adicionales_adicional",
        ),
        CheckConstraint("cantidad BETWEEN 1 AND 20", name="cantidad_valida"),
    )

    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    reserva_id: Mapped[uuid.UUID]
    adicional_id: Mapped[uuid.UUID]
    nombre: Mapped[str] = mapped_column(String(60))
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cantidad: Mapped[int] = mapped_column(SmallInteger)
