import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Pago(Base):
    """Un pago de Mercado Pago (o simulado, en desarrollo) sobre una reserva.

    mp_payment_id es único: los webhooks pueden llegar repetidos y el pago se registra una
    sola vez. `estado` es el de Mercado Pago (approved, rejected, refunded…).

    `devolucion`: None (no se devuelve), "pendiente" (hay que devolverlo y Mercado Pago
    todavía no lo aceptó: se reintenta) o "hecha".
    """

    __tablename__ = "pagos"
    __table_args__ = (
        ForeignKeyConstraint(
            ["negocio_id", "reserva_id"],
            ["reservas.negocio_id", "reservas.id"],
            name="fk_pagos_reserva",
        ),
        CheckConstraint(
            "devolucion IS NULL OR devolucion IN ('pendiente', 'hecha')", name="devolucion_valida"
        ),
        Index(
            "ix_pagos_devolucion_pendiente",
            "devolucion",
            postgresql_where=text("devolucion = 'pendiente'"),
        ),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    reserva_id: Mapped[uuid.UUID]
    mp_payment_id: Mapped[str] = mapped_column(String, unique=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    moneda: Mapped[str] = mapped_column(String, server_default="ARS")
    estado: Mapped[str] = mapped_column(String)
    detalle: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    devolucion: Mapped[str | None] = mapped_column(String)
    devolucion_intentos: Mapped[int] = mapped_column(server_default="0")
    devuelto_a: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_a: Mapped[CreadoA]
