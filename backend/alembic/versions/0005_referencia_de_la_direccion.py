"""referencia de la direccion

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-29

Una referencia para llegar ("al lado de la YPF", "frente a la plaza"). Se muestra
debajo de la dirección, pero no se usa para buscar en el mapa.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("negocios", sa.Column("referencia", sa.String(), nullable=True))
    # El dueño la puede editar desde su panel (permiso por columna, ver 0003).
    op.execute("GRANT UPDATE (referencia) ON negocios TO app_user")


def downgrade() -> None:
    op.execute("REVOKE UPDATE (referencia) ON negocios FROM app_user")
    op.drop_column("negocios", "referencia")
