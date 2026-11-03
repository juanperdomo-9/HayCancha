"""franjas de cumpleaños: días y horarios propios de cada cumpleaños

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-03

- cumpleanos.franjas: lista de {dia_semana, desde, hasta} (hora local) en la que se puede
  festejar. Vacía: en cualquier turno de la cancha, como hasta ahora.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024"
down_revision: str | Sequence[str] | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cumpleanos",
        sa.Column(
            "franjas",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("cumpleanos", "franjas")
