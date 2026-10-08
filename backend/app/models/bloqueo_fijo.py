import uuid
from datetime import time

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class BloqueoFijo(Base):
    """Un bloqueo que se repite todas las semanas: "todos los martes de 23 a 00, liga".
    En una cancha (recurso_id) o en todas (None). Si hasta <= desde, termina al día
    siguiente, como en los horarios."""

    __tablename__ = "bloqueos_fijos"
    __table_args__ = (
        ForeignKeyConstraint(
            ["negocio_id", "recurso_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_bloqueos_fijos_recurso",
            ondelete="CASCADE",
        ),
        CheckConstraint("dia_semana BETWEEN 0 AND 6", name="dia_valido"),
        CheckConstraint("desde <> hasta", name="franja_valida"),
        Index("ix_bloqueos_fijos_negocio_dia", "negocio_id", "dia_semana"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    recurso_id: Mapped[uuid.UUID | None]
    dia_semana: Mapped[int] = mapped_column(SmallInteger)
    desde: Mapped[time]
    hasta: Mapped[time]
    motivo: Mapped[str] = mapped_column(String)
    creado_a: Mapped[CreadoA]
