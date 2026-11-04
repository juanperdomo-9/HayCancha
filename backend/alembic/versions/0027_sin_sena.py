"""complejos sin seña: la reserva online se confirma al instante

Revision ID: 0027
Revises: 0026
Create Date: 2026-11-04

- Permiso de app_user para cambiar desde el panel cargo_servicio_pct y cargo_dentro_de_sena
  (faltó en 0025 y 0026) y sin_sena.
- negocios.sin_sena: el complejo no cobra seña. La reserva online queda confirmada al
  reservarla (sin Mercado Pago), con un tope de reservas por venir por teléfono y por
  conexión. El que no viene se marca "No vino" en la agenda.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: str | Sequence[str] | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column("sin_sena", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    # app_user solo puede cambiar las columnas de negocios que tienen permiso explícito: las
    # del cargo de servicio (0025 y 0026) y esta, desde la configuración del panel.
    op.execute(
        "GRANT UPDATE (cargo_servicio_pct, cargo_dentro_de_sena, sin_sena) ON negocios TO app_user"
    )


def downgrade() -> None:
    op.execute(
        "REVOKE UPDATE (cargo_servicio_pct, cargo_dentro_de_sena, sin_sena) ON negocios "
        "FROM app_user"
    )
    op.drop_column("negocios", "sin_sena")
