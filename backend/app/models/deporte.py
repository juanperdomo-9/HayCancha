from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UuidPk


class Deporte(Base):
    """Tabla global (sin negocio_id): se amplía agregando filas, sin cambiar código."""

    __tablename__ = "deportes"
    __table_args__ = (CheckConstraint("duracion_sugerida_min > 0", name="duracion_positiva"),)

    id: Mapped[UuidPk]
    codigo: Mapped[str] = mapped_column(String, unique=True)
    nombre: Mapped[str] = mapped_column(String)
    duracion_sugerida_min: Mapped[int]
