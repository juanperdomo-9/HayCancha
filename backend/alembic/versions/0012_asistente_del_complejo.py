"""asistente del complejo

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-01

- negocios.asistente_*: nombre, saludo, lo que sabe (texto libre que carga el dueño) y si
  está prendido. El conocimiento va completo en el prompt (sin pgvector) mientras sea chico.
- consultas_sin_respuesta: lo que el asistente no supo contestar, para que el dueño lo
  complete. Con RLS por negocio, como el resto.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | Sequence[str] | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNAS = "asistente_activo, asistente_nombre, asistente_bienvenida, asistente_conocimiento"


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column("asistente_activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column("negocios", sa.Column("asistente_nombre", sa.String(), nullable=True))
    op.add_column("negocios", sa.Column("asistente_bienvenida", sa.String(), nullable=True))
    op.add_column("negocios", sa.Column("asistente_conocimiento", sa.Text(), nullable=True))
    op.execute(f"GRANT UPDATE ({COLUMNAS}) ON negocios TO app_user")

    op.create_table(
        "consultas_sin_respuesta",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("negocio_id", sa.Uuid(), nullable=False),
        sa.Column("pregunta", sa.String(), nullable=False),
        sa.Column("resuelta", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "creado_a", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id"],
            ["negocios.id"],
            name=op.f("fk_consultas_sin_respuesta_negocio_id_negocios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consultas_sin_respuesta")),
    )
    op.create_index(
        "ix_consultas_sin_respuesta_negocio",
        "consultas_sin_respuesta",
        ["negocio_id", "creado_a"],
    )
    op.execute("GRANT SELECT, INSERT, UPDATE ON consultas_sin_respuesta TO app_user")
    op.execute("ALTER TABLE consultas_sin_respuesta ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY aislamiento_negocio ON consultas_sin_respuesta
          USING (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
          WITH CHECK (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
        """
    )


def downgrade() -> None:
    op.drop_table("consultas_sin_respuesta")
    op.execute(f"REVOKE UPDATE ({COLUMNAS}) ON negocios FROM app_user")
    for columna in ("asistente_conocimiento", "asistente_bienvenida", "asistente_nombre",
                    "asistente_activo"):  # fmt: skip
        op.drop_column("negocios", columna)
