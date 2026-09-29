from sqlalchemy import text

from app.db import get_engine


def test_migraciones_instalan_extensiones(base_de_pruebas: str) -> None:
    with get_engine().connect() as conexion:
        instaladas = set(
            conexion.execute(
                text("SELECT extname FROM pg_extension WHERE extname IN ('btree_gist', 'vector')")
            ).scalars()
        )
    assert instaladas == {"btree_gist", "vector"}
