from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db import get_session
from app.main import app


class _SesionFalsa:
    def __init__(self, falla: bool) -> None:
        self.falla = falla

    def execute(self, *args: object) -> None:
        if self.falla:
            raise OperationalError("SELECT 1", {}, Exception("sin conexión"))


def _cliente_con_sesion(sesion: _SesionFalsa) -> TestClient:
    app.dependency_overrides[get_session] = lambda: sesion
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_health_ok() -> None:
    respuesta = _cliente_con_sesion(_SesionFalsa(falla=False)).get("/health")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"api": "ok", "base": "ok"}


def test_health_sin_base_devuelve_503() -> None:
    respuesta = _cliente_con_sesion(_SesionFalsa(falla=True)).get("/health")
    assert respuesta.status_code == 503
    assert respuesta.json() == {"api": "ok", "base": "error"}


def test_health_con_base_real(base_de_pruebas: str) -> None:
    respuesta = TestClient(app).get("/health")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"api": "ok", "base": "ok"}
