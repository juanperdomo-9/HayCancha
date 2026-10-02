"""Asistente de cada complejo (IA simulada): reserva pendiente y preguntas sin responder."""

import json

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import sesion_de_negocio
from app.main import app
from app.models import ConsultaSinRespuesta, Reserva
from app.services import ia
from tests.test_cobro_mercadopago import api_mp, complejo  # noqa: F401 (fixtures)
from tests.test_panel_y_admin import crear_usuario, entrar  # noqa: F401 (fixture)


def guion(monkeypatch, llamadas: list[tuple[str, dict]]) -> None:
    """La IA pide estas herramientas en orden y después contesta 'Listo'."""
    pendientes = list(llamadas)

    def api(pedido: httpx.Request) -> httpx.Response:
        if pendientes:
            nombre, args = pendientes.pop(0)
            llamada = {"id": nombre, "type": "function",
                       "function": {"name": nombre, "arguments": json.dumps(args)}}  # fmt: skip
            mensaje = {"role": "assistant", "content": None, "tool_calls": [llamada]}
        else:
            mensaje = {"role": "assistant", "content": "Listo"}
        return httpx.Response(200, json={"choices": [{"message": mensaje}]})

    monkeypatch.setattr(get_settings(), "llm_api_key", "gsk_prueba")
    monkeypatch.setattr(get_settings(), "asistentes_de_complejo", True)
    monkeypatch.setattr(ia, "_http", lambda: httpx.Client(transport=httpx.MockTransport(api)))


def charlar(complejo: dict, texto: str):  # noqa: F811
    return TestClient(app).post(
        f"/asistente/complejos/{complejo['slug']}",
        json={"mensajes": [{"rol": "usuario", "texto": texto}]},
        headers={"x-forwarded-for": "6.6.6.6"},
    )


def test_reserva_desde_el_asistente_queda_pendiente(complejo, api_mp, monkeypatch) -> None:  # noqa: F811
    inicio = complejo["a_las"](20)
    guion(monkeypatch, [("reservar", {"fecha": inicio.date().isoformat(), "hora": "20:00",
                                      "deporte": "futbol5", "nombre": "Ana Paz",
                                      "telefono": "221 555 0101"})])  # fmt: skip
    r = charlar(complejo, "reservame a las 20, soy Ana Paz 221 555 0101")
    assert r.status_code == 200, r.text
    reserva = r.json()["reserva"]
    assert reserva["url_pago"] == "https://mp.example/pagar" and "/r/" in reserva["link"]
    with sesion_de_negocio(complejo["id"]) as s:
        creada = s.scalar(select(Reserva).where(Reserva.origen == "bot"))
        assert creada.estado == "pendiente_pago" and creada.inicio == inicio
    # La página de la reserva la muestra igual que una hecha en la web.
    codigo = reserva["link"].rsplit("/", 1)[1]
    publica = TestClient(app).get(
        f"/publico/complejos/{complejo['slug']}/reservas/por-codigo/{codigo}"
    )
    assert publica.status_code == 200


def test_lo_que_no_sabe_lo_anota_para_el_dueno(complejo, api_mp, monkeypatch) -> None:  # noqa: F811
    guion(monkeypatch, [("registrar_consulta", {"pregunta": "¿Se puede llevar perro?"})])
    assert charlar(complejo, "¿se puede ir con perro?").status_code == 200
    cliente = entrar(complejo["dueno"])
    consultas = cliente.get(f"/panel/{complejo['slug']}/asistente/consultas").json()
    assert [c["pregunta"] for c in consultas] == ["¿Se puede llevar perro?"]
    resuelta = cliente.post(
        f"/panel/{complejo['slug']}/asistente/consultas/{consultas[0]['id']}/resolver"
    )
    assert resuelta.status_code == 204
    assert cliente.get(f"/panel/{complejo['slug']}/asistente/consultas").json() == []
    with sesion_de_negocio(complejo["id"]) as s:
        assert s.scalar(select(ConsultaSinRespuesta)).resuelta is True
