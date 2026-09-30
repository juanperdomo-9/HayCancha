"""cobro con mercado pago

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-01

- reservas.url_pago: el link de Checkout Pro mientras la reserva espera el pago.
- reservas.cambios_de_horario: el jugador puede cambiar el horario una sola vez.
- reservas.conexion: HMAC de la IP desde la que se reservó (tope de reservas sin pagar
  por conexión, sin guardar la IP).
- pagos.devolucion / devolucion_intentos / devuelto_a: devoluciones automáticas, con
  reintento si Mercado Pago no las acepta (por ejemplo, sin saldo en la cuenta).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reservas", sa.Column("url_pago", sa.String(), nullable=True))
    op.add_column(
        "reservas",
        sa.Column("cambios_de_horario", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column("reservas", sa.Column("conexion", sa.String(), nullable=True))

    op.add_column("pagos", sa.Column("devolucion", sa.String(), nullable=True))
    op.add_column(
        "pagos",
        sa.Column("devolucion_intentos", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("pagos", sa.Column("devuelto_a", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        op.f("ck_pagos_devolucion_valida"),
        "pagos",
        "devolucion IS NULL OR devolucion IN ('pendiente', 'hecha')",
    )
    # Las devoluciones pendientes se buscan en la tarea periódica.
    op.create_index(
        "ix_pagos_devolucion_pendiente",
        "pagos",
        ["devolucion"],
        postgresql_where=sa.text("devolucion = 'pendiente'"),
    )


def downgrade() -> None:
    op.drop_index("ix_pagos_devolucion_pendiente", table_name="pagos")
    op.drop_constraint(op.f("ck_pagos_devolucion_valida"), "pagos", type_="check")
    op.drop_column("pagos", "devuelto_a")
    op.drop_column("pagos", "devolucion_intentos")
    op.drop_column("pagos", "devolucion")
    op.drop_column("reservas", "conexion")
    op.drop_column("reservas", "cambios_de_horario")
    op.drop_column("reservas", "url_pago")
