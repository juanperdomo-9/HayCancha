"""Cobro real con Mercado Pago (simulado en los tests): preferencia, webhook con firma,
devoluciones, cancelación y cambio de horario del jugador, y límites."""

import hashlib
import hmac
import json
import re
import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import sesion_de_negocio
from app.jobs.tick import main as tick
from app.main import app
from app.models import Horario, Negocio, Pago, Reserva
from app.services import mercadopago
from app.services.disponibilidad import hoy_en_el_negocio
from tests.test_panel_y_admin import crear_usuario, entrar  # noqa: F401 (fixture)

BA = ZoneInfo("America/Argentina/Buenos_Aires")
SECRETO = "secreto-de-webhooks"


class MercadoPagoFalso:
    """La API de Mercado Pago: preferencias, pagos y devoluciones."""

    def __init__(self, monkeypatch) -> None:
        self.pedidos: list[tuple[str, str, dict]] = []
        self.pagos: dict[str, dict] = {}
        self.falla_devolucion = False
        self.falla_preferencia = False
        # Cada test con su cuenta: la base de tests se comparte entre tests.
        self.cuenta = str(10**11 + uuid.uuid4().int % (9 * 10**11))
        monkeypatch.setattr(
            mercadopago, "_http", lambda: httpx.Client(transport=httpx.MockTransport(self._api))
        )

    def _api(self, pedido: httpx.Request) -> httpx.Response:
        cuerpo = json.loads(pedido.content) if pedido.content else {}
        ruta = pedido.url.path
        self.pedidos.append((pedido.method, ruta, cuerpo))
        if ruta == "/checkout/preferences":
            if self.falla_preferencia:
                return httpx.Response(500, json={"message": "error"})
            return httpx.Response(
                201, json={"id": "PREF-1", "init_point": "https://mp.example/pagar"}
            )
        if m := re.fullmatch(r"/v1/payments/(\w+)/refunds", ruta):
            if self.falla_devolucion:
                return httpx.Response(400, json={"message": "insufficient_amount"})
            return httpx.Response(201, json={"id": 1, "payment_id": m[1], "status": "approved"})
        if m := re.fullmatch(r"/v1/payments/(\w+)", ruta):
            return httpx.Response(200, json=self.pagos[m[1]])
        return httpx.Response(404)

    def devoluciones(self) -> list[str]:
        return [r for metodo, r, _ in self.pedidos if r.endswith("/refunds")]

    def pagar(self, reserva_id: str, monto: str = "11000.00", **cambios) -> str:
        pago_id = str(10**11 + uuid.uuid4().int % (9 * 10**11))
        self.pagos[pago_id] = {
            "id": int(pago_id),
            "status": "approved",
            "transaction_amount": float(monto),
            "currency_id": "ARS",
            "external_reference": reserva_id,
            "collector_id": int(self.cuenta),
        } | cambios
        return pago_id


@pytest.fixture
def api_mp(monkeypatch) -> MercadoPagoFalso:
    settings = get_settings()
    for campo, valor in {
        "mp_client_id": "123",
        "mp_client_secret": "secreto",
        "token_encryption_key": Fernet.generate_key().decode(),
        "mp_webhook_secret": SECRETO,
    }.items():
        monkeypatch.setattr(settings, campo, valor)
    return MercadoPagoFalso(monkeypatch)


@pytest.fixture
def complejo(admin: Session, crear_negocio, crear_recurso, crear_usuario, api_mp) -> dict:  # noqa: F811
    """Adriático vinculado a Mercado Pago: 2 canchas de fútbol 5, de 18 a 24 a $55.000
    (de 22 a 24, $70.000), seña 20%, cancelación con 24 horas."""
    negocio_id = crear_negocio(sena_tipo="porcentaje", sena_valor=Decimal("20"))
    canchas = [crear_recurso(negocio_id, "futbol5", f"Cancha {i}") for i in (1, 2)]
    for cancha in canchas:
        for dia in range(7):
            admin.add_all([
                Horario(negocio_id=negocio_id, recurso_id=cancha, dia_semana=dia, desde=time(18),
                        hasta=time(22), duracion_turno_min=60, precio=Decimal("55000")),
                Horario(negocio_id=negocio_id, recurso_id=cancha, dia_semana=dia, desde=time(22),
                        hasta=time(0), duracion_turno_min=60, precio=Decimal("70000")),
            ])  # fmt: skip
    negocio = admin.get(Negocio, negocio_id)
    mercadopago.guardar_credenciales(
        negocio,
        mercadopago.Credenciales("APP_USR-token", "TG-refresh", api_mp.cuenta,
                                 datetime.now(BA) + timedelta(days=180)),
    )  # fmt: skip
    admin.commit()
    en_3_dias = hoy_en_el_negocio(negocio) + timedelta(days=3)
    return {
        "id": negocio_id,
        "slug": negocio.slug,
        "canchas": canchas,
        "dueno": crear_usuario("dueno", negocio_id),
        "cuenta": api_mp.cuenta,
        "a_las": lambda h, dias=0: datetime.combine(
            en_3_dias + timedelta(days=dias), time(h), tzinfo=BA
        ),
    }


def reservar(complejo: dict, hora: int = 20, telefono: str = "11 5555-1234", ip: str = "1.1.1.1"):
    return TestClient(app).post(
        f"/publico/complejos/{complejo['slug']}/reservas",
        json={"deporte": "futbol5", "inicio": complejo["a_las"](hora).isoformat(),
              "nombre": "Juan Pérez", "telefono": telefono},
        headers={"x-forwarded-for": ip},
    )  # fmt: skip


def base(complejo: dict, reserva_id: str) -> str:
    return f"/publico/complejos/{complejo['slug']}/reservas/{reserva_id}"


def firmar(pago_id: str, request_id: str = "req-1", ts: str = "1700000000", secreto=SECRETO):
    manifest = f"id:{pago_id.lower()};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secreto.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}


def avisar(complejo: dict, pago_id: str, headers: dict | None = None, general: bool = False):
    cuenta = complejo["cuenta"]
    ruta = "/webhooks/mercadopago" + ("" if general else f"/{complejo['id']}")
    return TestClient(app).post(
        f"{ruta}?data.id={pago_id}&type=payment",
        json={"type": "payment", "action": "payment.created", "data": {"id": pago_id},
              "user_id": int(cuenta)},
        headers=firmar(pago_id) if headers is None else headers,
    )  # fmt: skip


def reserva_pagada(complejo: dict, api_mp: MercadoPagoFalso, hora: int = 20) -> str:
    reserva_id = reservar(complejo, hora).json()["id"]
    assert avisar(complejo, api_mp.pagar(reserva_id)).status_code == 200
    return reserva_id


def en_db(complejo: dict, reserva_id: str) -> Reserva:
    with sesion_de_negocio(complejo["id"]) as s:
        return s.get(Reserva, uuid.UUID(reserva_id))


def pagos(complejo: dict) -> list[Pago]:
    with sesion_de_negocio(complejo["id"]) as s:
        return list(s.scalars(select(Pago).order_by(Pago.creado_a)))


# --- Preferencia ---


def test_la_reserva_online_devuelve_el_link_de_mercado_pago(complejo, api_mp) -> None:
    creada = reservar(complejo)
    assert creada.status_code == 201, creada.text
    assert creada.json()["url_pago"] == "https://mp.example/pagar"
    _, ruta, preferencia = api_mp.pedidos[0]
    assert ruta == "/checkout/preferences"
    reserva_id = creada.json()["id"]
    assert preferencia["external_reference"] == reserva_id
    assert preferencia["items"][0]["unit_price"] == 11000.0
    assert preferencia["items"][0]["currency_id"] == "ARS"
    assert preferencia["items"][0]["title"].startswith("Seña: Cancha 1")
    assert preferencia["notification_url"].endswith(f"/webhooks/mercadopago/{complejo['id']}")
    assert preferencia["back_urls"]["success"].endswith(f"/{complejo['slug']}/reserva/{reserva_id}")
    assert preferencia["binary_mode"] is True and preferencia["expires"] is True
    assert preferencia["marketplace_fee"] == 0
    assert {t["id"] for t in preferencia["payment_methods"]["excluded_payment_types"]} == {
        "ticket",
        "atm",
    }
    vence = datetime.fromisoformat(preferencia["expiration_date_to"])
    assert abs(vence - en_db(complejo, reserva_id).vence_a) < timedelta(milliseconds=1)
    publica = TestClient(app).get(base(complejo, reserva_id)).json()
    assert (publica["url_pago"], publica["pago_simulado"]) == ("https://mp.example/pagar", False)


def test_si_mercado_pago_falla_no_queda_la_reserva(complejo, api_mp) -> None:
    api_mp.falla_preferencia = True
    assert reservar(complejo).status_code == 502
    api_mp.falla_preferencia = False
    assert reservar(complejo, telefono="11 4444-0000").status_code == 201  # el turno sigue libre


def test_tope_de_reservas_sin_pagar_por_conexion(complejo, api_mp) -> None:
    for i, hora in enumerate((18, 19, 20, 21)):
        assert reservar(complejo, hora, telefono=f"11 5555-000{i}").status_code == 201
    assert reservar(complejo, 22, telefono="11 5555-0009").status_code == 429
    assert reservar(complejo, 22, telefono="11 5555-0009", ip="2.2.2.2").status_code == 201


# --- Webhook ---


def test_webhook_con_firma_invalida_da_401(complejo, api_mp) -> None:
    reserva_id = reservar(complejo).json()["id"]
    pago_id = api_mp.pagar(reserva_id)
    otra_firma = firmar(pago_id, secreto="otra-clave")
    assert avisar(complejo, pago_id, headers=otra_firma).status_code == 401
    assert avisar(complejo, pago_id, headers={}).status_code == 401
    assert en_db(complejo, reserva_id).estado == "pendiente_pago"


def test_webhook_confirma_una_sola_vez_aunque_llegue_repetido(complejo, api_mp) -> None:
    reserva_id = reservar(complejo).json()["id"]
    pago_id = api_mp.pagar(reserva_id)
    for _ in range(3):
        assert avisar(complejo, pago_id).status_code == 200
    assert en_db(complejo, reserva_id).estado == "confirmada"
    assert len(pagos(complejo)) == 1
    assert api_mp.devoluciones() == []


def test_webhook_general_encuentra_el_complejo_por_la_cuenta(complejo, api_mp) -> None:
    reserva_id = reservar(complejo).json()["id"]
    assert avisar(complejo, api_mp.pagar(reserva_id), general=True).status_code == 200
    assert en_db(complejo, reserva_id).estado == "confirmada"


def test_monto_distinto_no_confirma_y_se_devuelve(complejo, api_mp) -> None:
    reserva_id = reservar(complejo).json()["id"]
    pago_id = api_mp.pagar(reserva_id, monto="100.00")
    assert avisar(complejo, pago_id).status_code == 200
    assert en_db(complejo, reserva_id).estado == "pendiente_pago"
    assert api_mp.devoluciones() == [f"/v1/payments/{pago_id}/refunds"]
    assert pagos(complejo)[0].devolucion == "hecha"


def test_pago_de_otra_cuenta_no_confirma(complejo, api_mp) -> None:
    reserva_id = reservar(complejo).json()["id"]
    avisar(complejo, api_mp.pagar(reserva_id, collector_id=999))
    assert en_db(complejo, reserva_id).estado == "pendiente_pago"


def test_pago_con_la_reserva_vencida_y_el_turno_tomado_se_devuelve(complejo, api_mp) -> None:
    reserva_id = reservar(complejo, 20, telefono="11 1111-1111").json()["id"]
    with sesion_de_negocio(complejo["id"]) as s:
        s.get(Reserva, uuid.UUID(reserva_id)).vence_a = datetime.now(BA) - timedelta(minutes=1)
        s.commit()
    # Otros dos toman las dos canchas de las 20.
    assert reservar(complejo, 20, telefono="11 2222-2222").status_code == 201
    assert reservar(complejo, 20, telefono="11 3333-3333").status_code == 201
    pago_id = api_mp.pagar(reserva_id)
    assert avisar(complejo, pago_id).status_code == 200
    assert en_db(complejo, reserva_id).estado == "vencida"
    assert api_mp.devoluciones() == [f"/v1/payments/{pago_id}/refunds"]


def test_si_mercado_pago_no_responde_se_pide_reintento(complejo, api_mp, monkeypatch) -> None:
    reserva_id = reservar(complejo).json()["id"]
    pago_id = api_mp.pagar(reserva_id)
    monkeypatch.setattr(
        mercadopago,
        "_http",
        lambda: httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(503))),
    )
    assert avisar(complejo, pago_id).status_code == 502
    assert en_db(complejo, reserva_id).estado == "pendiente_pago"


# --- Cancelación del jugador ---


def cancelar(complejo: dict, reserva_id: str, telefono: str = "11 5555-1234"):
    return TestClient(app).post(
        f"{base(complejo, reserva_id)}/cancelar", json={"telefono": telefono}
    )


def test_cancelar_a_tiempo_devuelve_la_sena(complejo, api_mp) -> None:
    reserva_id = reserva_pagada(complejo, api_mp)
    antes = TestClient(app).get(base(complejo, reserva_id)).json()
    assert (antes["sena_pagada"], antes["recupera_sena"], antes["puede_cancelar"]) == (
        True,
        True,
        True,
    )
    respuesta = cancelar(complejo, reserva_id)
    assert respuesta.status_code == 200, respuesta.text
    assert (respuesta.json()["estado"], respuesta.json()["devolucion"]) == ("cancelada", "hecha")
    assert respuesta.json()["monto_devuelto"] == "11000.00"
    assert len(api_mp.devoluciones()) == 1
    # El turno quedó libre.
    assert reservar(complejo, telefono="11 4444-0000").status_code == 201


def test_cancelar_tarde_no_devuelve_la_sena(complejo, api_mp, admin) -> None:
    reserva_id = reserva_pagada(complejo, api_mp)
    admin.get(Negocio, complejo["id"]).horas_cancelacion = 24 * 30  # la política ya pasó
    admin.commit()
    assert TestClient(app).get(base(complejo, reserva_id)).json()["recupera_sena"] is False
    respuesta = cancelar(complejo, reserva_id)
    assert (respuesta.json()["estado"], respuesta.json()["devolucion"]) == ("cancelada", None)
    assert api_mp.devoluciones() == []


def test_cancelar_con_otro_telefono_da_403(complejo, api_mp) -> None:
    reserva_id = reserva_pagada(complejo, api_mp)
    assert cancelar(complejo, reserva_id, "11 9999-9999").status_code == 403
    assert en_db(complejo, reserva_id).estado == "confirmada"


def test_si_la_devolucion_falla_queda_pendiente_y_se_reintenta(complejo, api_mp) -> None:
    reserva_id = reserva_pagada(complejo, api_mp)
    api_mp.falla_devolucion = True
    assert cancelar(complejo, reserva_id).json()["devolucion"] == "pendiente"
    tick(devoluciones=True)
    assert pagos(complejo)[0].devolucion == "pendiente"
    api_mp.falla_devolucion = False
    tick(devoluciones=True)
    pago = pagos(complejo)[0]
    assert (pago.devolucion, pago.estado, pago.devolucion_intentos) == ("hecha", "refunded", 3)
    assert TestClient(app).get(base(complejo, reserva_id)).json()["devolucion"] == "hecha"


# --- Cambio de horario ---


def cambiar(complejo: dict, reserva_id: str, hora: int, dias: int = 0, telefono="11 5555-1234"):
    return TestClient(app).post(
        f"{base(complejo, reserva_id)}/cambiar",
        json={"telefono": telefono, "inicio": complejo["a_las"](hora, dias).isoformat()},
    )


def test_cambiar_el_horario_una_sola_vez(complejo, api_mp) -> None:
    reserva_id = reserva_pagada(complejo, api_mp, hora=20)
    respuesta = cambiar(complejo, reserva_id, 22, dias=1)
    assert respuesta.status_code == 200, respuesta.text
    datos = respuesta.json()
    # La seña se mantiene; la diferencia del turno más caro se paga en la cancha.
    assert (datos["hora"], datos["precio"], datos["sena"], datos["saldo"]) == (
        "22:00",
        "70000.00",
        "11000.00",
        "59000.00",
    )
    assert (datos["ya_cambio_horario"], datos["puede_cambiar"]) == (True, False)
    assert cambiar(complejo, reserva_id, 19).status_code == 409
    # El turno viejo quedó libre.
    assert reservar(complejo, 20, telefono="11 4444-0000").status_code == 201


def test_no_se_cambia_fuera_de_la_politica(complejo, api_mp, admin) -> None:
    reserva_id = reserva_pagada(complejo, api_mp)
    admin.get(Negocio, complejo["id"]).horas_cancelacion = 24 * 30
    admin.commit()
    assert cambiar(complejo, reserva_id, 22).status_code == 409


def test_no_se_cambia_a_un_turno_ocupado(complejo, api_mp) -> None:
    reserva_id = reserva_pagada(complejo, api_mp, hora=20)
    reservar(complejo, 21, telefono="11 2222-2222")
    reservar(complejo, 21, telefono="11 3333-3333")
    assert cambiar(complejo, reserva_id, 21).status_code == 409
    assert en_db(complejo, reserva_id).inicio == complejo["a_las"](20)


# --- Cancelación desde el panel ---


def test_el_dueno_cancela_con_o_sin_devolver_la_sena(complejo, api_mp) -> None:
    con = reserva_pagada(complejo, api_mp, hora=19)
    sin = reserva_pagada(complejo, api_mp, hora=20)
    cliente = entrar(complejo["dueno"])
    panel = f"/panel/{complejo['slug']}/reservas"
    assert cliente.get(f"{panel}/{con}").json()["sena_online"] is True
    detalle = cliente.post(f"{panel}/{con}/cancelar").json()
    assert (detalle["estado"], detalle["devolucion"]) == ("cancelada", "hecha")
    detalle = cliente.post(f"{panel}/{sin}/cancelar", json={"devolver_sena": False}).json()
    assert (detalle["estado"], detalle["devolucion"]) == ("cancelada", None)
    assert len(api_mp.devoluciones()) == 1
    with sesion_de_negocio(complejo["id"]) as s:
        assert s.scalar(select(func.count()).select_from(Pago)) == 2
