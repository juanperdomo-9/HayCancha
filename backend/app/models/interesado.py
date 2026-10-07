from sqlalchemy import CheckConstraint, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Interesado(Base):
    """Un dueño de complejo que dejó su contacto en la página principal. No es de un
    negocio: lo ve solo el superadmin."""

    __tablename__ = "interesados"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('nuevo', 'contactado', 'se_sumo', 'no_interesado')", name="estado_valido"
        ),
        Index("ix_interesados_creado", "creado_a"),
        # app_user inserta sin poder leer: nada de RETURNING.
        {"implicit_returning": False},
    )

    id: Mapped[UuidPk]
    nombre: Mapped[str] = mapped_column(String)
    complejo: Mapped[str] = mapped_column(String)
    zona: Mapped[str | None] = mapped_column(String)
    whatsapp: Mapped[str] = mapped_column(String)
    canchas: Mapped[str | None] = mapped_column(String)
    como_reserva: Mapped[str | None] = mapped_column(String)
    estado: Mapped[str] = mapped_column(String, server_default=text("'nuevo'"))
    creado_a: Mapped[CreadoA]
