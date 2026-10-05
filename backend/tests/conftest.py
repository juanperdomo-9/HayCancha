import os
import tempfile
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session

from app.config import normalizar_url_postgres


class _ConfigTests(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    test_database_url: str | None = None


TEST_DATABASE_URL = _ConfigTests().test_database_url

# Los tests nunca usan las URLs de DATABASE_URL del .env. Sin TEST_DATABASE_URL
# apuntan a una base inexistente y los tests que la necesitan se saltean.
_url = normalizar_url_postgres(TEST_DATABASE_URL or "postgresql://tests@127.0.0.1:1/tests")
os.environ["DATABASE_URL"] = _url
os.environ["DATABASE_URL_ADMIN"] = _url
os.environ["JWT_SECRET"] = "clave-de-tests-" + "x" * 32
# Los tests no dependen del .env: el pago simulado se prende solo donde se prueba.
os.environ["PAGOS_SIMULADOS"] = "false"
os.environ["CARPETA_ARCHIVOS"] = tempfile.mkdtemp(prefix="haycancha-archivos-")


def _conectar_como_app_user(conexion_dbapi: Any, _registro: Any) -> None:
    # TEST_DATABASE_URL es un superusuario (se saltea RLS). La conexión de la app
    # pasa a app_user, como en producción, así los tests prueban RLS de verdad.
    conexion_dbapi.execute("SET ROLE app_user")
    conexion_dbapi.commit()


@pytest.fixture(scope="session")
def base_de_pruebas() -> Iterator[str]:
    """Base local migrada con Alembic y vacía. Saltea el test si no hay TEST_DATABASE_URL."""
    if not TEST_DATABASE_URL:
        pytest.skip("Falta TEST_DATABASE_URL (Postgres local, ver docker-compose.yml)")

    from alembic import command
    from alembic.config import Config

    from app.db import get_engine, get_engine_admin

    command.upgrade(Config("alembic.ini"), "head")
    with get_engine_admin().begin() as conexion:
        conexion.execute(
            text(
                "TRUNCATE fotos, consultas_sin_respuesta, pagos, reservas, recursos_combinados, "
                "horarios, "
                "clientes, recursos, "
                "usuarios, negocios"
            )
        )

    motor = get_engine()
    event.listen(motor, "connect", _conectar_como_app_user)
    motor.dispose()  # descarta conexiones abiertas antes del listener
    yield _url
    event.remove(motor, "connect", _conectar_como_app_user)
    motor.dispose()


@pytest.fixture
def admin(base_de_pruebas: str) -> Iterator[Session]:
    """Sesión con el rol dueño de las tablas (se saltea RLS), para preparar datos."""
    from app.db import sesion_admin

    with sesion_admin() as session:
        yield session


@pytest.fixture
def crear_negocio(admin: Session) -> Callable[..., uuid.UUID]:
    """Crea un negocio con slug único y devuelve su id."""
    from app.models import Negocio

    def crear(**campos: Any) -> uuid.UUID:
        datos = {
            "slug": f"prueba-{uuid.uuid4().hex[:10]}",
            "nombre": "Complejo de prueba",
            "horas_cancelacion": 24,
        }
        negocio = Negocio(**(datos | campos))
        admin.add(negocio)
        admin.commit()
        return negocio.id

    return crear


@pytest.fixture
def crear_recurso(admin: Session) -> Callable[..., uuid.UUID]:
    """Crea una cancha en un negocio y devuelve su id."""
    from app.models import Deporte, Recurso

    def crear(
        negocio_id: uuid.UUID, deporte: str = "futbol7", nombre: str | None = None
    ) -> uuid.UUID:
        deporte_id = admin.scalar(select(Deporte.id).where(Deporte.codigo == deporte))
        recurso = Recurso(
            negocio_id=negocio_id,
            deporte_id=deporte_id,
            nombre=nombre or f"Cancha {uuid.uuid4().hex[:6]}",
        )
        admin.add(recurso)
        admin.commit()
        return recurso.id

    return crear


@pytest.fixture
def crear_cliente(admin: Session) -> Callable[..., uuid.UUID]:
    """Crea un jugador en un negocio y devuelve su id."""
    from app.models import Cliente

    def crear(negocio_id: uuid.UUID) -> uuid.UUID:
        cliente = Cliente(
            negocio_id=negocio_id, nombre="Jugador de prueba", telefono=uuid.uuid4().hex[:10]
        )
        admin.add(cliente)
        admin.commit()
        return cliente.id

    return crear
