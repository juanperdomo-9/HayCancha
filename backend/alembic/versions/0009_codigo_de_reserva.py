"""codigo de reserva

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-01

El link de la reserva online: haycancha.com.ar/{slug}/r/{codigo}, por ejemplo
sab3-21hs-k7m2q9xa. Día y hora para reconocerlo, y 8 caracteres al azar para que nadie
adivine el de otro. Es la única forma que tiene el jugador de volver a su reserva.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reservas", sa.Column("codigo", sa.String(), nullable=True))
    op.create_unique_constraint(op.f("uq_reservas_codigo"), "reservas", ["codigo"])


def downgrade() -> None:
    op.drop_constraint(op.f("uq_reservas_codigo"), "reservas", type_="unique")
    op.drop_column("reservas", "codigo")
