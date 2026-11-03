"""turnos fijos de juego: un cliente que juega todas las semanas

Revision ID: 0023
Revises: 0022
Create Date: 2026-11-03

- turnos_fijos: cancha, día, hora y cliente. Crea reservas confirmadas de verdad para las
  próximas semanas (no son bloqueos): tienen seña, asistencia y saldo, y suman a las
  métricas.
- reservas.turno_fijo_id: la reserva es de ese turno fijo. Una por fecha (índice único
  parcial), así liberar un día no lo vuelve a crear.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | Sequence[str] | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "turnos_fijos",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("negocio_id", sa.Uuid(), nullable=False),
        sa.Column("recurso_id", sa.Uuid(), nullable=False),
        sa.Column("cliente_id", sa.Uuid(), nullable=False),
        sa.Column("dia_semana", sa.SmallInteger(), nullable=False),
        sa.Column("desde", sa.Time(), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("generado_hasta", sa.Date(), nullable=True),
        sa.Column(
            "creado_a", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("dia_semana BETWEEN 0 AND 6", name=op.f("ck_turnos_fijos_dia_valido")),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_turnos_fijos_negocio_id_negocios")
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id", "recurso_id"],
            ["recursos.negocio_id", "recursos.id"],
            name="fk_turnos_fijos_recurso",
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id", "cliente_id"],
            ["clientes.negocio_id", "clientes.id"],
            name="fk_turnos_fijos_cliente",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_turnos_fijos")),
        sa.UniqueConstraint("negocio_id", "id", name="uq_turnos_fijos_negocio_id"),
    )
    op.add_column("reservas", sa.Column("turno_fijo_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_reservas_turno_fijo",
        "reservas",
        "turnos_fijos",
        ["negocio_id", "turno_fijo_id"],
        ["negocio_id", "id"],
    )
    op.create_index(
        "uq_reservas_turno_fijo_inicio",
        "reservas",
        ["turno_fijo_id", "inicio"],
        unique=True,
        postgresql_where=sa.text("turno_fijo_id IS NOT NULL"),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE ON turnos_fijos TO app_user")
    op.execute("ALTER TABLE turnos_fijos ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY aislamiento_negocio ON turnos_fijos
          USING (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
          WITH CHECK (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
        """
    )


def downgrade() -> None:
    op.drop_index("uq_reservas_turno_fijo_inicio", table_name="reservas")
    op.drop_constraint("fk_reservas_turno_fijo", "reservas", type_="foreignkey")
    op.drop_column("reservas", "turno_fijo_id")
    op.drop_table("turnos_fijos")
