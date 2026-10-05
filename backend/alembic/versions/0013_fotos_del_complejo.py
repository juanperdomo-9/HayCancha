"""fotos del complejo

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-05

- fotos: la galería de cada complejo (hasta 12), en el orden que elige el dueño. Los
  archivos van al mismo lugar que el logo y la portada. Con RLS por negocio.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | Sequence[str] | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fotos",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("negocio_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("orden", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "creado_a", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_fotos_negocio_id_negocios")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fotos")),
    )
    op.create_index("ix_fotos_negocio", "fotos", ["negocio_id", "orden"])
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON fotos TO app_user")
    op.execute("ALTER TABLE fotos ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY aislamiento_negocio ON fotos
          USING (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
          WITH CHECK (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
        """
    )


def downgrade() -> None:
    op.drop_table("fotos")
