"""texto de las fotos y reglas del predio

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-16

- fotos.texto: epígrafe opcional que se muestra sobre la foto ("Cancha 1, techada").
- negocios.reglas: reglas del predio que el jugador ve antes de pagar la seña ("No se
  permiten bebidas alcohólicas", "El saldo se paga en efectivo"). Las edita el dueño.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: str | Sequence[str] | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("fotos", sa.Column("texto", sa.String(80), nullable=True))
    op.add_column(
        "negocios",
        sa.Column(
            "reglas",
            postgresql.ARRAY(sa.String()),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=False,
        ),
    )
    op.execute("GRANT UPDATE (reglas) ON negocios TO app_user")


def downgrade() -> None:
    op.execute("REVOKE UPDATE (reglas) ON negocios FROM app_user")
    op.drop_column("negocios", "reglas")
    op.drop_column("fotos", "texto")
