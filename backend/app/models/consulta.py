import uuid

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class ConsultaSinRespuesta(Base):
    """Una pregunta que el asistente del complejo no supo contestar (fase 3). El dueño la ve
    en su panel y completa lo que sabe el asistente."""

    __tablename__ = "consultas_sin_respuesta"
    __table_args__ = (Index("ix_consultas_sin_respuesta_negocio", "negocio_id", "creado_a"),)

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("negocios.id"))
    pregunta: Mapped[str] = mapped_column(String)
    resuelta: Mapped[bool] = mapped_column(server_default=text("false"))
    creado_a: Mapped[CreadoA]
