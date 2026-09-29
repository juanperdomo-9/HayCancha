"""rol app_user y aislamiento por negocio (RLS)

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-29

La app se conecta como app_user: no es dueño de las tablas y no puede saltearse
RLS. Cada transacción fija app.negocio_id (ver app/db.py) y las políticas solo
dejan ver y escribir filas de ese negocio.

El rol se crea sin login: la contraseña la pone `python -m app.cli preparar-base`
leyéndola de DATABASE_URL, así nunca queda en el repo. Los roles son de todo el
servidor (no de una base), por eso se crea solo si no existe y el downgrade no
lo borra.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEGOCIO_ACTUAL = "NULLIF(current_setting('app.negocio_id', true), '')::uuid"

# Tabla -> permisos de app_user. Las reservas no se borran: se cancelan.
TABLAS_DEL_NEGOCIO = {
    "usuarios": "SELECT, INSERT, UPDATE",
    "recursos": "SELECT, INSERT, UPDATE",
    "horarios": "SELECT, INSERT, UPDATE, DELETE",
    "clientes": "SELECT, INSERT, UPDATE",
    "recursos_combinados": "SELECT, INSERT, DELETE",
    "reservas": "SELECT, INSERT, UPDATE",
}

# Lo que el dueño (o el superadmin desde su panel) puede cambiar de su negocio.
# slug, plan, estado_cuenta, activo, rubro y zona_horaria son del alta (conexión admin).
COLUMNAS_EDITABLES_DEL_NEGOCIO = (
    "nombre",
    "logo_url",
    "portada_url",
    "color_primario",
    "color_secundario",
    "direccion",
    "barrio",
    "servicios",
    "sena_tipo",
    "sena_valor",
    "minutos_para_pagar",
    "horas_cancelacion",
    "mp_user_id",
    "mp_access_token_enc",
    "mp_refresh_token_enc",
    "mp_token_vence_a",
)


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
            CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
          END IF;
        END
        $$
        """
    )
    op.execute("""ALTER ROLE app_user SET search_path = "$user", public, extensions""")
    op.execute("GRANT USAGE ON SCHEMA public TO app_user")
    op.execute("GRANT USAGE ON SCHEMA extensions TO app_user")

    op.execute("GRANT SELECT ON deportes TO app_user")

    # negocios: lectura pública (rutas por slug); solo se modifica el negocio actual.
    op.execute("GRANT SELECT ON negocios TO app_user")
    columnas = ", ".join(COLUMNAS_EDITABLES_DEL_NEGOCIO)
    op.execute(f"GRANT UPDATE ({columnas}) ON negocios TO app_user")
    op.execute("ALTER TABLE negocios ENABLE ROW LEVEL SECURITY")
    op.execute("CREATE POLICY lectura_publica ON negocios FOR SELECT USING (true)")
    op.execute(
        f"""
        CREATE POLICY modifica_su_negocio ON negocios FOR UPDATE
          USING (id = {NEGOCIO_ACTUAL})
          WITH CHECK (id = {NEGOCIO_ACTUAL})
        """
    )

    for tabla, permisos in TABLAS_DEL_NEGOCIO.items():
        op.execute(f"GRANT {permisos} ON {tabla} TO app_user")
        op.execute(f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY aislamiento_negocio ON {tabla}
              USING (negocio_id = {NEGOCIO_ACTUAL})
              WITH CHECK (negocio_id = {NEGOCIO_ACTUAL})
            """
        )


def downgrade() -> None:
    for tabla in TABLAS_DEL_NEGOCIO:
        op.execute(f"DROP POLICY IF EXISTS aislamiento_negocio ON {tabla}")
        op.execute(f"ALTER TABLE {tabla} DISABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON {tabla} FROM app_user")
    op.execute("DROP POLICY IF EXISTS modifica_su_negocio ON negocios")
    op.execute("DROP POLICY IF EXISTS lectura_publica ON negocios")
    op.execute("ALTER TABLE negocios DISABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON negocios FROM app_user")
    op.execute("REVOKE ALL ON deportes FROM app_user")
    op.execute("REVOKE USAGE ON SCHEMA extensions FROM app_user")
    op.execute("REVOKE USAGE ON SCHEMA public FROM app_user")
