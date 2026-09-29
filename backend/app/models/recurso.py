import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Recurso(Base):
    """Lo que se reserva: una cancha."""

    __tablename__ = "recursos"
    __table_args__ = (
        # Destino de las claves compuestas (negocio_id, recurso_id) de las tablas hijas.
        UniqueConstraint("negocio_id", "id", name="uq_recursos_negocio_id_id"),
        UniqueConstraint("negocio_id", "nombre", name="uq_recursos_negocio_id_nombre"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    deporte_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("deportes.id"))
    nombre: Mapped[str] = mapped_column(String)
    caracteristicas: Mapped[str | None] = mapped_column(String)
    orden: Mapped[int] = mapped_column(server_default="0")
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    creado_a: Mapped[CreadoA]


class RecursoCombinado(Base):
    """Una cancha grande (recurso_id) formada por otras (parte_id)."""

    __tablename__ = "recursos_combinados"
    __table_args__ = (
        PrimaryKeyConstraint("recurso_id", "parte_id"),
        ForeignKeyConstraint(
            ["negocio_id", "recurso_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_recursos_combinados_recurso",
        ),
        ForeignKeyConstraint(
            ["negocio_id", "parte_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_recursos_combinados_parte",
        ),
        CheckConstraint("recurso_id <> parte_id", name="distinta_de_si_misma"),
    )

    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    recurso_id: Mapped[uuid.UUID]
    parte_id: Mapped[uuid.UUID]
