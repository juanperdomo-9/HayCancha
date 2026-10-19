"""adicionales: lo que el complejo alquila aparte (paletas, pelotas, parrilla)

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-16

- adicionales: lo que ofrece cada complejo, con su precio. Opcionalmente de un solo
  deporte (las paletas, para el pádel). Es opcional: sin adicionales no se muestra nada.
- reservas_adicionales: lo que se pidió en cada reserva, con el nombre y el precio de ese
  momento (si después cambia el precio, la reserva no cambia).
- reservas.total_adicionales: la suma, que se paga en la cancha junto con el saldo. La
  seña no cambia.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | Sequence[str] | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

POLITICA = """
    CREATE POLICY aislamiento_negocio ON {tabla}
      USING (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
      WITH CHECK (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
"""


def upgrade() -> None:
    op.create_table(
        "adicionales",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("negocio_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(60), nullable=False),
        sa.Column("precio", sa.Numeric(12, 2), nullable=False),
        sa.Column("deporte_id", sa.Uuid(), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("orden", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "creado_a", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("precio >= 0", name=op.f("ck_adicionales_precio_valido")),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_adicionales_negocio_id_negocios")
        ),
        sa.ForeignKeyConstraint(
            ["deporte_id"], ["deportes.id"], name=op.f("fk_adicionales_deporte_id_deportes")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_adicionales")),
        sa.UniqueConstraint("negocio_id", "id", name="uq_adicionales_negocio_id"),
        sa.UniqueConstraint("negocio_id", "nombre", name="uq_adicionales_nombre"),
    )
    op.create_table(
        "reservas_adicionales",
        sa.Column("negocio_id", sa.Uuid(), nullable=False),
        sa.Column("reserva_id", sa.Uuid(), nullable=False),
        sa.Column("adicional_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(60), nullable=False),
        sa.Column("precio", sa.Numeric(12, 2), nullable=False),
        sa.Column("cantidad", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "cantidad BETWEEN 1 AND 20", name=op.f("ck_reservas_adicionales_cantidad_valida")
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id"],
            ["negocios.id"],
            name=op.f("fk_reservas_adicionales_negocio_id_negocios"),
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id", "reserva_id"],
            ["reservas.negocio_id", "reservas.id"],
            name="fk_reservas_adicionales_reserva",
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id", "adicional_id"],
            ["adicionales.negocio_id", "adicionales.id"],
            name="fk_reservas_adicionales_adicional",
        ),
        sa.PrimaryKeyConstraint("reserva_id", "adicional_id", name=op.f("pk_reservas_adicionales")),
    )
    op.add_column(
        "reservas",
        sa.Column(
            "total_adicionales",
            sa.Numeric(12, 2),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON adicionales TO app_user")
    op.execute("GRANT SELECT, INSERT, DELETE ON reservas_adicionales TO app_user")
    for tabla in ("adicionales", "reservas_adicionales"):
        op.execute(f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY")
        op.execute(POLITICA.format(tabla=tabla))


def downgrade() -> None:
    op.drop_column("reservas", "total_adicionales")
    op.drop_table("reservas_adicionales")
    op.drop_table("adicionales")
