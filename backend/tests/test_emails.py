"""Emails al dueño (Resend, simulado), invitaciones por email y WhatsApp del complejo."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services import email
from tests.test_cobro_mercadopago import (  # noqa: F401 (fixtures)
    api_mp,
    avisar,
    cambiar,
    cancelar,
    complejo,
    reserva_pagada,
    reservar,
)
from tests.test_panel_y_admin import crear_usuario, entrar  # noqa: F401 (fixture)


class ResendFalso:
    def __init__(self, monkeypatch, estado: int = 200) -> None:
        self.enviados: list[dict] = []
        self.estado = estado
        monkeypatch.setattr(get_settings(), "email_api_key", "re_prueba")
        monkeypatch.setattr(
            email, "_http", lambda: httpx.Client(transport=httpx.MockTransport(self._api))
        )

    def _api(self, pedido: httpx.Request) -> httpx.Response:
        self.enviados.append(json.loads(pedido.content))
        return httpx.Response(self.estado, json={"id": "email-1"})

    def asuntos(self) -> list[str]:
        return [e["subject"] for e in self.enviados]


@pytest.fixture
def resend(monkeypatch) -> ResendFalso:
    return ResendFalso(monkeypatch)


def test_reserva_nueva_avisa_al_dueno(complejo, api_mp, resend) -> None:  # noqa: F811
    reserva_pagada(complejo, api_mp)
    assert len(resend.enviados) == 1
    enviado = resend.enviados[0]
    assert enviado["to"] == [complejo["dueno"]]
    assert enviado["subject"].startswith("Reserva nueva: Cancha 1")
    assert "Juan Pérez" in enviado["html"] and "$ 11.000" in enviado["text"]


def test_el_aviso_repetido_no_manda_otro_email(complejo, api_mp, resend) -> None:  # noqa: F811
    reserva_id = reservar(complejo).json()["id"]
    pago_id = api_mp.pagar(reserva_id)
    avisar(complejo, pago_id)
    avisar(complejo, pago_id)
    assert len(resend.enviados) == 1


def test_si_resend_falla_la_reserva_se_confirma_igual(complejo, api_mp, monkeypatch) -> None:  # noqa: F811
    ResendFalso(monkeypatch, estado=500)
    reserva_id = reservar(complejo).json()["id"]
    assert avisar(complejo, api_mp.pagar(reserva_id)).status_code == 200
    estado = (
        TestClient(app)
        .get(f"/publico/complejos/{complejo['slug']}/reservas/{reserva_id}")
        .json()["estado"]
    )
    assert estado == "confirmada"


def test_sin_clave_no_se_manda_nada(complejo, api_mp, monkeypatch) -> None:  # noqa: F811
    llamadas = []
    monkeypatch.setattr(email, "_http", lambda: llamadas.append(1))
    reserva_pagada(complejo, api_mp)
    assert llamadas == []


def test_cancelacion_y_cambio_avisan_al_dueno(complejo, api_mp, resend) -> None:  # noqa: F811
    cambia = reserva_pagada(complejo, api_mp, hora=19)
    cancela = reserva_pagada(complejo, api_mp, hora=20)
    assert cambiar(complejo, cambia, 22, dias=1).status_code == 200
    assert cancelar(complejo, cancela).status_code == 200
    asuntos = resend.asuntos()
    assert any(a.startswith("Cambio de horario: Juan Pérez") for a in asuntos)
    cancelacion = next(e for e in resend.enviados if e["subject"].startswith("Cancelación"))
    assert "se le devuelve la seña" in cancelacion["html"]


def test_devolucion_pendiente_avisa_una_sola_vez(complejo, api_mp, resend) -> None:  # noqa: F811
    from app.jobs.tick import main as tick

    reserva_id = reserva_pagada(complejo, api_mp)
    api_mp.falla_devolucion = True
    cancelar(complejo, reserva_id)
    tick(devoluciones=True)
    pendientes = [a for a in resend.asuntos() if "devolución" in a.lower()]
    assert pendientes == ["Una devolución de seña quedó pendiente"]


def test_invitaciones_por_email(complejo, resend, crear_usuario) -> None:  # noqa: F811
    cliente = entrar(complejo["dueno"])
    nuevo = cliente.post(f"/panel/{complejo['slug']}/equipo", json={"email": "caja@prueba.example"})
    assert nuevo.status_code == 201, nuevo.text
    enviado = resend.enviados[-1]
    assert enviado["to"] == ["caja@prueba.example"]
    assert nuevo.json()["link"] in enviado["text"]

    admin = entrar(crear_usuario("superadmin"))
    alta = admin.post(
        "/admin/complejos",
        json={"nombre": "Nuevo", "slug": "nuevo-" + complejo["slug"][-6:],
              "dueno_email": "dueno-nuevo@prueba.example", "horas_cancelacion": 12},
    )  # fmt: skip
    assert alta.status_code == 201, alta.text
    assert resend.enviados[-1]["to"] == ["dueno-nuevo@prueba.example"]
    assert "Elegir mi contraseña" in resend.enviados[-1]["html"]


def test_whatsapp_opcional_del_complejo(complejo) -> None:  # noqa: F811
    cliente = entrar(complejo["dueno"])
    config = f"/panel/{complejo['slug']}/configuracion"
    publico = f"/publico/complejos/{complejo['slug']}"
    assert TestClient(app).get(publico).json()["whatsapp"] is None
    assert cliente.patch(config, json={"whatsapp": "wa.me/123"}).status_code == 422
    assert cliente.patch(config, json={"whatsapp": "5492215551234"}).status_code == 200
    assert TestClient(app).get(publico).json()["whatsapp"] == "5492215551234"
    assert cliente.patch(config, json={"whatsapp": ""}).json()["whatsapp"] is None
