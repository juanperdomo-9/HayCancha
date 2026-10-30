"""cumpleaños: una cancha por un tiempo fijo, a precio cerrado

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-30

- cumpleanos: lo que ofrece cada complejo que festeja cumpleaños (deporte, duración,
  precio, qué incluye y sus condiciones). Es opcional: sin cumpleaños no se muestra nada.
- reservas.cumpleanos_id: la reserva es de ese cumpleaños (dura lo que dura el cumpleaños,
  aunque ocupe varios turnos de la cancha).
- reservas.nota: lo que cuenta el jugador al reservar (quién cumple, cuántos chicos).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | Sequence[str] | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cumpleanos",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("negocio_id", sa.Uuid(), nullable=False),
        sa.Column("deporte_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(60), nullable=False),
        sa.Column("duracion_min", sa.Integer(), nullable=False),
        sa.Column("precio", sa.Numeric(12, 2), nullable=False),
        sa.Column("incluye", sa.Text(), nullable=True),
        sa.Column("condiciones", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("orden", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "creado_a", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("precio >= 0", name=op.f("ck_cumpleanos_precio_valido")),
        sa.CheckConstraint(
            "duracion_min BETWEEN 30 AND 480", name=op.f("ck_cumpleanos_duracion_valida")
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_cumpleanos_negocio_id_negocios")
        ),
        sa.ForeignKeyConstraint(
            ["deporte_id"], ["deportes.id"], name=op.f("fk_cumpleanos_deporte_id_deportes")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cumpleanos")),
        sa.UniqueConstraint("negocio_id", "id", name="uq_cumpleanos_negocio_id"),
        sa.UniqueConstraint("negocio_id", "nombre", name="uq_cumpleanos_nombre"),
    )
    op.add_column("reservas", sa.Column("cumpleanos_id", sa.Uuid(), nullable=True))
    op.add_column("reservas", sa.Column("nota", sa.String(300), nullable=True))
    op.create_foreign_key(
        "fk_reservas_cumpleanos",
        "reservas",
        "cumpleanos",
        ["negocio_id", "cumpleanos_id"],
        ["negocio_id", "id"],
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON cumpleanos TO app_user")
    op.execute("ALTER TABLE cumpleanos ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY aislamiento_negocio ON cumpleanos
          USING (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
          WITH CHECK (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_reservas_cumpleanos", "reservas", type_="foreignkey")
    op.drop_column("reservas", "nota")
    op.drop_column("reservas", "cumpleanos_id")
    op.drop_table("cumpleanos")
