"""anticipación mínima y bloqueos fijos

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-08

- negocios.horas_anticipacion: con cuántas horas de anticipación mínima se puede reservar
  online (0 = sin mínimo). El dueño igual carga a mano turnos de último momento.
- bloqueos_fijos: bloqueos que se repiten todas las semanas ("todos los martes de 23 a 00,
  liga"), en una cancha o en todas (recurso_id null). No se guardan como reservas: se
  calculan al armar la disponibilidad, la agenda y al reservar. Con RLS por negocio.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | Sequence[str] | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column("horas_anticipacion", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_negocios_horas_anticipacion_valida"),
        "negocios",
        "horas_anticipacion BETWEEN 0 AND 72",
    )
    op.execute("GRANT UPDATE (horas_anticipacion) ON negocios TO app_user")

    op.create_table(
        "bloqueos_fijos",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("negocio_id", sa.Uuid(), nullable=False),
        sa.Column("recurso_id", sa.Uuid(), nullable=True),
        sa.Column("dia_semana", sa.SmallInteger(), nullable=False),
        sa.Column("desde", sa.Time(), nullable=False),
        sa.Column("hasta", sa.Time(), nullable=False),
        sa.Column("motivo", sa.String(), nullable=False),
        sa.Column(
            "creado_a", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("dia_semana BETWEEN 0 AND 6", name=op.f("ck_bloqueos_fijos_dia_valido")),
        sa.CheckConstraint("desde <> hasta", name=op.f("ck_bloqueos_fijos_franja_valida")),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_bloqueos_fijos_negocio_id_negocios")
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id", "recurso_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_bloqueos_fijos_recurso",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bloqueos_fijos")),
    )
    op.create_index("ix_bloqueos_fijos_negocio_dia", "bloqueos_fijos", ["negocio_id", "dia_semana"])
    op.execute("GRANT SELECT, INSERT, DELETE ON bloqueos_fijos TO app_user")
    op.execute("ALTER TABLE bloqueos_fijos ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY aislamiento_negocio ON bloqueos_fijos
          USING (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
          WITH CHECK (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
        """
    )


def downgrade() -> None:
    op.drop_table("bloqueos_fijos")
    op.execute("REVOKE UPDATE (horas_anticipacion) ON negocios FROM app_user")
    op.drop_constraint(op.f("ck_negocios_horas_anticipacion_valida"), "negocios", type_="check")
    op.drop_column("negocios", "horas_anticipacion")
