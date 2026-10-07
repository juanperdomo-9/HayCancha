"""Dueños que dejan su contacto: se guardan, solo los ve el superadmin."""

from fastapi.testclient import TestClient

from app.main import app
from app.routers import interesados
from tests.test_panel_y_admin import crear_usuario, entrar, escenario  # noqa: F401

DATOS = {"nombre": "Marcos Díaz", "complejo": "La Redonda", "zona": "Gonnet",
         "whatsapp": "221 555 0101", "canchas": "3 de fútbol 5"}  # fmt: skip


def test_dejar_contacto_y_verlo_en_el_admin(escenario) -> None:  # noqa: F811
    interesados._envios.clear()
    publico = TestClient(app)
    assert publico.post("/publico/interesados", json=DATOS).status_code == 201

    # Un bot completa el campo oculto: se le dice que sí, pero no se guarda.
    assert publico.post("/publico/interesados", json={**DATOS, "sitio_web": "x"}).status_code == 201

    # Los dueños no ven la lista; el superadmin sí, y les cambia el estado.
    assert entrar(escenario["dueno_a"]).get("/admin/interesados").status_code == 403
    admin = entrar(escenario["superadmin"])
    lista = [i for i in admin.get("/admin/interesados").json() if i["complejo"] == "La Redonda"]
    assert len(lista) == 1 and lista[0]["estado"] == "nuevo"
    cambio = admin.patch(f"/admin/interesados/{lista[0]['id']}", json={"estado": "contactado"})
    assert cambio.json()["estado"] == "contactado"


def test_tope_por_conexion() -> None:
    interesados._envios.clear()
    publico = TestClient(app)
    for _ in range(interesados.MAX_POR_CONEXION):
        assert publico.post("/publico/interesados", json=DATOS).status_code == 201
    assert publico.post("/publico/interesados", json=DATOS).status_code == 429
