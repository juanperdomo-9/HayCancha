"""ubicacion del complejo

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-01

Latitud y longitud del complejo para el mapa de la página principal. Las marca el dueño
(o el equipo) tocando el mapa en Tu página.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("negocios", sa.Column("latitud", sa.Double(), nullable=True))
    op.add_column("negocios", sa.Column("longitud", sa.Double(), nullable=True))
    op.execute("GRANT UPDATE (latitud, longitud) ON negocios TO app_user")


def downgrade() -> None:
    op.execute("REVOKE UPDATE (latitud, longitud) ON negocios FROM app_user")
    op.drop_column("negocios", "longitud")
    op.drop_column("negocios", "latitud")
