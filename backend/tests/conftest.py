import os
from collections.abc import Iterator

import pytest
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config import normalizar_url_postgres


class _ConfigTests(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    test_database_url: str | None = None


TEST_DATABASE_URL = _ConfigTests().test_database_url

# Los tests nunca usan las URLs del .env (que apuntan a Supabase). Sin
# TEST_DATABASE_URL apuntan a una base inexistente y los tests que la
# necesitan se saltean.
_url = normalizar_url_postgres(TEST_DATABASE_URL or "postgresql://tests@127.0.0.1:1/tests")
os.environ["DATABASE_URL"] = _url
os.environ["DATABASE_URL_ADMIN"] = _url


@pytest.fixture(scope="session")
def base_de_pruebas() -> Iterator[str]:
    """Base local migrada con Alembic. Saltea el test si no hay TEST_DATABASE_URL."""
    if not TEST_DATABASE_URL:
        pytest.skip("Falta TEST_DATABASE_URL (Postgres local, ver docker-compose.yml)")

    from alembic import command
    from alembic.config import Config

    command.upgrade(Config("alembic.ini"), "head")
    yield _url
