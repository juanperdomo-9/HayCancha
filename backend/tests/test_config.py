import pytest

from app.config import normalizar_url_postgres


@pytest.mark.parametrize(
    "url",
    [
        "postgres://u:p@host:6543/postgres",
        "postgresql://u:p@host:6543/postgres",
        "postgresql+psycopg://u:p@host:6543/postgres",
    ],
)
def test_normaliza_url_a_psycopg(url: str) -> None:
    assert normalizar_url_postgres(url) == "postgresql+psycopg://u:p@host:6543/postgres"
