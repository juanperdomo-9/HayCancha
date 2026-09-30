"""permisos de mercado pago

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-30

El dueño vincula y desvincula Mercado Pago desde su panel, con la conexión de la app
(app_user, RLS: solo su propio negocio). Los tokens se guardan encriptados.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNAS = "mp_user_id, mp_access_token_enc, mp_refresh_token_enc, mp_token_vence_a"


def upgrade() -> None:
    op.execute(f"GRANT UPDATE ({COLUMNAS}) ON negocios TO app_user")


def downgrade() -> None:
    op.execute(f"REVOKE UPDATE ({COLUMNAS}) ON negocios FROM app_user")
