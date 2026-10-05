import uuid
from datetime import time
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    SmallInteger,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UuidPk


class Horario(Base):
    """Una franja en la que una cancha se alquila.

    dia_semana: 0 = lunes … 6 = domingo (como date.weekday()).
    desde/hasta: hora local del negocio. Si hasta <= desde, la franja termina al día
    siguiente (18:00 a 02:00, o 09:00 a 00:00 para cerrar a medianoche).
    """

    __tablename__ = "horarios"
    __table_args__ = (
        ForeignKeyConstraint(
            ["negocio_id", "recurso_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_horarios_recurso",
            ondelete="CASCADE",
        ),
        CheckConstraint("dia_semana BETWEEN 0 AND 6", name="dia_semana_valido"),
        CheckConstraint("duracion_turno_min > 0", name="duracion_positiva"),
        CheckConstraint("precio >= 0", name="precio_no_negativo"),
        CheckConstraint(
            "precio_efectivo IS NULL OR (precio_efectivo >= 0 AND precio_efectivo <= precio)",
            name="precio_efectivo_valido",
        ),
        Index("ix_horarios_recurso_dia", "recurso_id", "dia_semana"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    recurso_id: Mapped[uuid.UUID]
    dia_semana: Mapped[int] = mapped_column(SmallInteger)
    desde: Mapped[time]
    hasta: Mapped[time]
    duracion_turno_min: Mapped[int]
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Si el saldo se paga en efectivo (opcional, más barato). La seña sale del precio normal.
    precio_efectivo: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
