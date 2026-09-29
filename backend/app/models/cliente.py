import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Cliente(Base):
    """Un jugador que reservó en un negocio. No tiene cuenta: se identifica por teléfono."""

    __tablename__ = "clientes"
    __table_args__ = (
        UniqueConstraint("negocio_id", "telefono", name="uq_clientes_negocio_id_telefono"),
        UniqueConstraint("negocio_id", "id", name="uq_clientes_negocio_id_id"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    nombre: Mapped[str] = mapped_column(String)
    # Solo dígitos (lo normaliza el servicio).
    telefono: Mapped[str] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    creado_a: Mapped[CreadoA]
