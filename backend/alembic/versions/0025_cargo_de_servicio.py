"""cargo de servicio: el jugador paga la comisión de Mercado Pago sobre la seña

Revision ID: 0025
Revises: 0024
Create Date: 2026-11-04

- negocios.cargo_servicio_pct: la comisión que le cobra Mercado Pago al complejo (con IVA).
  Por defecto 7,61 (6,29% + IVA, cobrando al instante). 0: sin cargo.
- reservas.cargo_servicio: el cargo de esa reserva, calculado al reservar online.
- pagos.monto_devolucion: cuánto se devuelve (null: todo). Si cancela el jugador, la seña
  sin el cargo.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: str | Sequence[str] | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column(
            "cargo_servicio_pct",
            sa.Numeric(5, 2),
            server_default=sa.text("7.61"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "cargo_servicio_pct_valido", "negocios", "cargo_servicio_pct BETWEEN 0 AND 30"
    )
    op.add_column(
        "reservas",
        sa.Column("cargo_servicio", sa.Numeric(12, 2), server_default="0", nullable=False),
    )
    op.create_check_constraint("cargo_servicio_no_negativo", "reservas", "cargo_servicio >= 0")
    op.add_column("pagos", sa.Column("monto_devolucion", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("pagos", "monto_devolucion")
    op.drop_constraint("cargo_servicio_no_negativo", "reservas", type_="check")
    op.drop_column("reservas", "cargo_servicio")
    op.drop_constraint("cargo_servicio_pct_valido", "negocios", type_="check")
    op.drop_column("negocios", "cargo_servicio_pct")
