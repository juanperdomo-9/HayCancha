"""cargo dentro de la seña y cómo se cobró el saldo en la cancha

Revision ID: 0026
Revises: 0025
Create Date: 2026-11-04

- negocios.cargo_dentro_de_sena: el jugador ve una sola seña (seña + cargo de servicio) en
  vez de la seña y el cargo por separado. Por dentro no cambia nada.
- reservas.cobrado_efectivo y reservas.cobrado_transferencia: cuánto del saldo se cobró en
  la cancha de cada forma (null en las que se marcaron antes).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | Sequence[str] | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column("cargo_dentro_de_sena", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column("reservas", sa.Column("cobrado_efectivo", sa.Numeric(12, 2), nullable=True))
    op.add_column("reservas", sa.Column("cobrado_transferencia", sa.Numeric(12, 2), nullable=True))
    op.create_check_constraint(
        "cobrado_no_negativo",
        "reservas",
        "coalesce(cobrado_efectivo, 0) >= 0 AND coalesce(cobrado_transferencia, 0) >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("cobrado_no_negativo", "reservas", type_="check")
    op.drop_column("reservas", "cobrado_transferencia")
    op.drop_column("reservas", "cobrado_efectivo")
    op.drop_column("negocios", "cargo_dentro_de_sena")
