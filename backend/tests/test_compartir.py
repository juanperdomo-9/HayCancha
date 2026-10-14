"""Link para compartir: la vista previa (nombre, deportes y foto) de cada complejo."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.main import app
from app.models import Negocio
from tests.test_agenda import complejo  # noqa: F401


def test_vista_previa_del_complejo(complejo, admin: Session) -> None:  # noqa: F811
    negocio = admin.get(Negocio, complejo["negocio"].id)
    negocio.portada_url = "https://archivos.example/portada.jpg"
    admin.commit()
    cliente = TestClient(app)
    html = cliente.get(f"/compartir/{complejo['slug']}").text
    assert f'content="Reservá tu cancha en {negocio.nombre}"' in html
    assert 'content="https://archivos.example/portada.jpg"' in html
    assert "Fútbol 7" in html
    assert f"{get_settings().frontend_url}/{complejo['slug']}" in html  # manda a la página real


def test_sin_fotos_usa_la_imagen_de_haycanchas_y_slug_desconocido(complejo) -> None:  # noqa: F811
    cliente = TestClient(app)
    html = cliente.get(f"/compartir/{complejo['slug']}").text
    assert "/compartir.png" in html
    otro = cliente.get("/compartir/no-existe", follow_redirects=False)
    assert otro.status_code == 302
