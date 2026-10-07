"""interesados

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-07

- interesados: dueños de complejos que dejaron su contacto en la página principal
  ("Tengo un complejo"). Es de HayCanchas, no de un negocio: sin negocio_id. app_user solo
  puede insertar (la página pública); leerlos y cambiarles el estado es del superadmin, con
  la conexión de administrador.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | Sequence[str] | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "interesados",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column("complejo", sa.String(), nullable=False),
        sa.Column("zona", sa.String(), nullable=True),
        sa.Column("whatsapp", sa.String(), nullable=False),
        sa.Column("canchas", sa.String(), nullable=True),
        sa.Column("como_reserva", sa.String(), nullable=True),
        sa.Column("estado", sa.String(), server_default=sa.text("'nuevo'"), nullable=False),
        sa.Column(
            "creado_a", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "estado IN ('nuevo', 'contactado', 'se_sumo', 'no_interesado')",
            name=op.f("ck_interesados_estado_valido"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_interesados")),
    )
    op.create_index("ix_interesados_creado", "interesados", ["creado_a"])
    op.execute("GRANT INSERT ON interesados TO app_user")


def downgrade() -> None:
    op.drop_table("interesados")
