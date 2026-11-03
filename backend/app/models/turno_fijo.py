import uuid
from datetime import date, time

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    SmallInteger,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class TurnoFijo(Base):
    """Un turno de juego que se repite todas las semanas: "Martín, los martes a las 21 en
    la cancha 2". A diferencia de un bloqueo fijo, crea reservas de verdad (confirmadas, a
    nombre del cliente) para las próximas semanas: así tienen seña, asistencia y saldo, y
    suman a las métricas. La tarea periódica va creando las que siguen."""

    __tablename__ = "turnos_fijos"
    __table_args__ = (
        UniqueConstraint("negocio_id", "id", name="uq_turnos_fijos_negocio_id"),
        ForeignKeyConstraint(
            ["negocio_id", "recurso_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_turnos_fijos_recurso",
        ),
        ForeignKeyConstraint(
            ["negocio_id", "cliente_id"],
            ["clientes.negocio_id", "clientes.id"],
            name="fk_turnos_fijos_cliente",
        ),
        CheckConstraint("dia_semana BETWEEN 0 AND 6", name="dia_valido"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    recurso_id: Mapped[uuid.UUID]
    cliente_id: Mapped[uuid.UUID]
    dia_semana: Mapped[int] = mapped_column(SmallInteger)
    # Hora de inicio del turno (la duración y el precio salen de los horarios de la cancha).
    desde: Mapped[time]
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    # Hasta qué fecha ya se crearon las reservas.
    generado_hasta: Mapped[date | None]
    creado_a: Mapped[CreadoA]
