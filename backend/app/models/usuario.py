import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreadoA, UuidPk


class Usuario(Base):
    """Quien entra al panel: dueño o empleado de un negocio, o superadmin de HayCancha."""

    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint("rol IN ('superadmin', 'dueno', 'empleado')", name="rol_valido"),
        # El superadmin es el único sin negocio.
        CheckConstraint("(rol = 'superadmin') = (negocio_id IS NULL)", name="negocio_segun_rol"),
        # Se guarda en minúsculas, así el índice único no distingue mayúsculas.
        CheckConstraint("email = lower(email)", name="email_en_minusculas"),
    )

    id: Mapped[UuidPk]
    negocio_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("negocios.id"), index=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    # Null hasta que el usuario elige su contraseña con el link de invitación.
    password_hash: Mapped[str | None] = mapped_column(String)
    rol: Mapped[str] = mapped_column(String)
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    creado_a: Mapped[CreadoA]
