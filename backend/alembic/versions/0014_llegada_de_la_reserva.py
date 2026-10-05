"""llegada de la reserva

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-05

- reservas.llegada: de dónde vino el jugador que reservó online. "haycancha" si llegó
  desde la página principal (listado, mapa o buscador) y "directo" si entró por el link
  propio del complejo. Solo para las métricas del Plan Pro ("te trajo HayCancha"). Las
  reservas anteriores quedan sin dato.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | Sequence[str] | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reservas", sa.Column("llegada", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("reservas", "llegada")
