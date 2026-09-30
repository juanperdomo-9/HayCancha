"""whatsapp del complejo

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-01

WhatsApp para consultas (opcional). Si el complejo lo carga, su página muestra un botón
"Consultar por WhatsApp". Las reservas, los pagos y los avisos no pasan por WhatsApp.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("negocios", sa.Column("whatsapp", sa.String(), nullable=True))
    # El dueño lo edita desde su panel (permiso por columna, ver 0003).
    op.execute("GRANT UPDATE (whatsapp) ON negocios TO app_user")


def downgrade() -> None:
    op.execute("REVOKE UPDATE (whatsapp) ON negocios FROM app_user")
    op.drop_column("negocios", "whatsapp")
