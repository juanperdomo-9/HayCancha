"""buffet

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-05

- El servicio "Bufé" pasa a llamarse "Buffet" en los complejos que ya lo tenían cargado.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | Sequence[str] | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE negocios SET servicios = array_replace(servicios, 'Bufé', 'Buffet') "
        "WHERE 'Bufé' = ANY(servicios)"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE negocios SET servicios = array_replace(servicios, 'Buffet', 'Bufé') "
        "WHERE 'Buffet' = ANY(servicios)"
    )
