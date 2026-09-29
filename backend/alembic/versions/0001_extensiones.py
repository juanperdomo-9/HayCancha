"""extensiones btree_gist y vector

Revision ID: 0001
Revises:
Create Date: 2026-09-29

btree_gist: restricción de reservas sin superposición (fase 1).
vector: embeddings del asistente (fase 3).

Van en el esquema `extensions`, como las instala Supabase. Localmente,
docker/postgres-init agrega ese esquema al search_path de la base, igual que
en Supabase. El rol app_user (fase 1) va a necesitar el mismo search_path.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS extensions")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector")
    op.execute("DROP EXTENSION IF EXISTS btree_gist")
