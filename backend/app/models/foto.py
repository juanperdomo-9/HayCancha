import uuid

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Foto(Base):
    """Una foto de la galería del complejo, en el orden que eligió el dueño."""

    __tablename__ = "fotos"
    __table_args__ = (Index("ix_fotos_negocio", "negocio_id", "orden"),)

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    url: Mapped[str] = mapped_column(String)
    orden: Mapped[int] = mapped_column(server_default=text("0"))
    creado_a: Mapped[CreadoA]
