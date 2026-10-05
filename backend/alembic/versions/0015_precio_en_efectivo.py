"""precio en efectivo

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-05

- horarios.precio_efectivo: precio opcional si el saldo se paga en efectivo (más barato).
  La seña se calcula siempre sobre el precio normal.
- reservas.precio_efectivo: copia del de la franja al reservar (si después cambian los
  precios, la reserva conserva los suyos).
- reservas.saldo_en_efectivo: el dueño marcó el saldo como cobrado en efectivo (para las
  métricas: se facturó el precio en efectivo).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | Sequence[str] | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("horarios", sa.Column("precio_efectivo", sa.Numeric(12, 2), nullable=True))
    op.create_check_constraint(
        op.f("ck_horarios_precio_efectivo_valido"),
        "horarios",
        "precio_efectivo IS NULL OR (precio_efectivo >= 0 AND precio_efectivo <= precio)",
    )
    op.add_column("reservas", sa.Column("precio_efectivo", sa.Numeric(12, 2), nullable=True))
    op.add_column(
        "reservas",
        sa.Column(
            "saldo_en_efectivo", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("reservas", "saldo_en_efectivo")
    op.drop_column("reservas", "precio_efectivo")
    op.drop_constraint(op.f("ck_horarios_precio_efectivo_valido"), "horarios", type_="check")
    op.drop_column("horarios", "precio_efectivo")
