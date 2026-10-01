"""Buscador de la página principal: filtros de turnos y conversación (IA simulada)."""

import json
import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import sesion_admin, sesion_de_negocio
from app.main import app
from app.models import Horario, Negocio, Recurso
from app.routers import asistente
from app.services import ia
from app.services.buscador import buscar_turnos
from app.services.reservas import DatosCliente, reservar

BA = ZoneInfo("America/Argentina/Buenos_Aires")


@pytest.fixture
def ciudad(admin: Session, crear_negocio, crear_recurso) -> dict:
    """Dos complejos en una ciudad única (la base de tests se comparte entre tests) y uno en
    otra: canchas de fútbol 5 de 18 a 24, una techada y otra descubierta."""
    nombre = f"Ciudad {uuid.uuid4().hex[:6]}"
    techado = crear_negocio(nombre="Techado FC", barrio=nombre)
    descubierto = crear_negocio(nombre="Al Aire", barrio=nombre)
    lejos = crear_negocio(nombre="Lejos", barrio=f"Otra {uuid.uuid4().hex[:6]}")
    canchas = {}
    for negocio_id, carac in ((techado, "Sintético, techada"), (descubierto, "Descubierta"),
                              (lejos, "Techada")):  # fmt: skip
        cancha = crear_recurso(negocio_id, "futbol5", "Cancha 1")
        admin.get(Recurso, cancha).caracteristicas = carac
        for dia in range(7):
            admin.add(Horario(negocio_id=negocio_id, recurso_id=cancha, dia_semana=dia,
                              desde=time(18), hasta=time(0), duracion_turno_min=60,
                              precio=Decimal("55000")))  # fmt: skip
        canchas[negocio_id] = cancha
    admin.commit()
    manana = datetime.now(BA).date() + timedelta(days=1)
    return {"ciudad": nombre, "techado": techado, "manana": manana, "canchas": canchas}


def buscar(ciudad: dict, **filtros):
    with sesion_admin() as s:
        return buscar_turnos(s, fecha=ciudad["manana"], deporte="futbol5", **filtros)


def test_filtra_por_zona_hora_y_techada(ciudad) -> None:
    resultados = buscar(ciudad, hora_desde=time(19), hora_hasta=time(19),
                        zona=ciudad["ciudad"].lower(), caracteristicas=["techado"])  # fmt: skip
    assert [(r.complejo, r.hora) for r in resultados] == [("Techado FC", "19:00")]
    assert resultados[0].precio == "55000.00"


def test_sin_filtro_de_techada_aparecen_los_dos(ciudad) -> None:
    resultados = buscar(ciudad, hora_desde=time(19), hora_hasta=time(19), zona=ciudad["ciudad"])
    assert {r.complejo for r in resultados} == {"Techado FC", "Al Aire"}


def test_un_turno_ocupado_no_aparece(ciudad) -> None:
    negocio_id = ciudad["techado"]
    with sesion_de_negocio(negocio_id) as s:
        negocio = s.get(Negocio, negocio_id)
        reservar(s, negocio, deporte_codigo="futbol5",
                 inicio=datetime.combine(ciudad["manana"], time(19), tzinfo=BA),
                 cliente=DatosCliente("Juan", "1155550000"), origen="panel")  # fmt: skip
        s.commit()
    resultados = buscar(ciudad, hora_desde=time(19), hora_hasta=time(19),
                        zona=ciudad["ciudad"], caracteristicas=["techada"])  # fmt: skip
    assert resultados == []


# --- Conversación con la IA simulada ---


class ModeloFalso:
    """Responde primero pidiendo buscar_turnos y después con texto."""

    def __init__(self, monkeypatch, argumentos: dict, estado: int = 200) -> None:
        self.pedidos: list[dict] = []
        self.argumentos = argumentos
        self.estado = estado
        monkeypatch.setattr(get_settings(), "llm_api_key", "gsk_prueba")
        monkeypatch.setattr(
            ia, "_http", lambda: httpx.Client(transport=httpx.MockTransport(self._api))
        )

    def _api(self, pedido: httpx.Request) -> httpx.Response:
        cuerpo = json.loads(pedido.content)
        self.pedidos.append(cuerpo)
        if self.estado != 200:
            return httpx.Response(self.estado, json={"error": {"message": "limite"}})
        if not any(m["role"] == "tool" for m in cuerpo["messages"]):
            llamada = {"id": "call_1", "type": "function",
                       "function": {"name": "buscar_turnos",
                                    "arguments": json.dumps(self.argumentos)}}  # fmt: skip
            mensaje = {"role": "assistant", "content": None, "tool_calls": [llamada]}
        else:
            mensaje = {"role": "assistant", "content": "Encontré una cancha techada a las 19."}
        return httpx.Response(200, json={"choices": [{"message": mensaje}]})


def charlar(texto: str, ip: str = "9.9.9.9"):
    return TestClient(app).post(
        "/asistente/buscar",
        json={"mensajes": [{"rol": "usuario", "texto": texto}]},
        headers={"x-forwarded-for": ip},
    )


def test_el_buscador_usa_la_herramienta_y_devuelve_tarjetas(ciudad, monkeypatch) -> None:
    pedido = {"fecha": ciudad["manana"].isoformat(), "deporte": "futbol5",
              "hora_desde": "19:00", "hora_hasta": "19:00", "zona": ciudad["ciudad"],
              "caracteristicas": ["techada"]}  # fmt: skip
    modelo = ModeloFalso(monkeypatch, pedido)
    r = charlar("necesito fútbol 5 mañana a las 19, techada")
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["respuesta"] == "Encontré una cancha techada a las 19."
    assert [(t["complejo"], t["hora"], t["deporte_codigo"]) for t in datos["resultados"]] == [
        ("Techado FC", "19:00", "futbol5")
    ]
    # El modelo recibió el resultado de la herramienta y el sistema dice qué día es hoy.
    segundo = modelo.pedidos[1]["messages"]
    assert any(m["role"] == "tool" and "Techado FC" in m["content"] for m in segundo)
    assert "Hoy es" in segundo[0]["content"]
    assert modelo.pedidos[0]["tools"][0]["function"]["name"] == "buscar_turnos"


def test_sin_clave_responde_no_disponible(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "llm_api_key", "")
    r = charlar("hola")
    assert r.status_code == 503 and "descanso" in r.json()["detail"]


def test_si_se_agota_el_cupo_no_se_rompe(ciudad, monkeypatch) -> None:
    ModeloFalso(monkeypatch, {}, estado=429)
    r = charlar("hola", ip="8.8.8.8")
    assert r.status_code == 503 and "descanso" in r.json()["detail"]


def test_limite_de_mensajes_por_dia(ciudad, monkeypatch) -> None:
    ModeloFalso(monkeypatch, {"fecha": ciudad["manana"].isoformat()})
    monkeypatch.setattr(asistente, "MAX_MENSAJES_POR_DIA", 1)
    ip = f"7.7.7.{uuid.uuid4().int % 250}"
    assert charlar("fútbol mañana", ip=ip).status_code == 200
    assert charlar("y pádel?", ip=ip).status_code == 429
