"""funciones de login

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-29

El login busca al usuario por email antes de saber a qué negocio pertenece, y
RLS no lo deja ver. En vez de usar la conexión de administrador en una ruta
pública, estas dos funciones SECURITY DEFINER devuelven solo lo necesario para
autenticar. app_user puede ejecutarlas, pero no leer la tabla sin negocio.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNAS = "id uuid, negocio_id uuid, email text, password_hash text, rol text, activo boolean"
SELECT = "SELECT u.id, u.negocio_id, u.email, u.password_hash, u.rol, u.activo FROM usuarios u"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE FUNCTION auth_usuario_por_email(p_email text)
          RETURNS TABLE ({COLUMNAS})
          LANGUAGE sql STABLE SECURITY DEFINER
          SET search_path = public, pg_temp
        AS $$ {SELECT} WHERE u.email = lower(p_email) $$
        """
    )
    op.execute(
        f"""
        CREATE FUNCTION auth_usuario_por_id(p_id uuid)
          RETURNS TABLE ({COLUMNAS})
          LANGUAGE sql STABLE SECURITY DEFINER
          SET search_path = public, pg_temp
        AS $$ {SELECT} WHERE u.id = p_id $$
        """
    )
    for funcion in ("auth_usuario_por_email(text)", "auth_usuario_por_id(uuid)"):
        op.execute(f"REVOKE ALL ON FUNCTION {funcion} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {funcion} TO app_user")


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS auth_usuario_por_id(uuid)")
    op.execute("DROP FUNCTION IF EXISTS auth_usuario_por_email(text)")
