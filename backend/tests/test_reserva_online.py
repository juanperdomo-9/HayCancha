"""Reserva online del jugador (pago simulado) y acreditación de pagos."""

import uuid
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import sesion_admin, sesion_de_negocio
from app.jobs.tick import main as tick
from app.main import app
from app.models import Horario, Negocio, Pago, Reserva
from app.services.cobros import PagoInformado, Resultado, acreditar_pago
from app.services.disponibilidad import hoy_en_el_negocio
from app.services.reservas import DatosCliente, reservar

BA = ZoneInfo("America/Argentina/Buenos_Aires")


@pytest.fixture
def simulados(monkeypatch):
    monkeypatch.setattr(get_settings(), "pagos_simulados", True)


@pytest.fixture
def complejo(admin: Session, crear_negocio, crear_recurso) -> dict:
    """1 cancha de fútbol 5 de 18 a 24 a $55.000, seña 20% ($11.000)."""
    negocio_id = crear_negocio(sena_tipo="porcentaje", sena_valor=Decimal("20"))
    cancha = crear_recurso(negocio_id, "futbol5", "Cancha 1")
    for dia in range(7):
        admin.add(Horario(negocio_id=negocio_id, recurso_id=cancha, dia_semana=dia,
                          desde=time(18), hasta=time(0), duracion_turno_min=60,
                          precio=Decimal("55000")))  # fmt: skip
    admin.commit()
    negocio = admin.get(Negocio, negocio_id)
    manana = hoy_en_el_negocio(negocio) + timedelta(days=1)
    return {
        "negocio": negocio,
        "slug": negocio.slug,
        "cancha": cancha,
        "a_las": lambda h: datetime.combine(manana, time(h), tzinfo=BA),
    }


def reservar_online(complejo: dict, hora: int = 21, telefono: str = "11 5555-1234"):
    return TestClient(app).post(
        f"/publico/complejos/{complejo['slug']}/reservas",
        json={
            "deporte": "futbol5",
            "inicio": complejo["a_las"](hora).isoformat(),
            "nombre": "Juan Pérez",
            "telefono": telefono,
        },
    )


def ver(complejo: dict, reserva_id: str) -> dict:
    return (
        TestClient(app).get(f"/publico/complejos/{complejo['slug']}/reservas/{reserva_id}").json()
    )


def test_sin_mercado_pago_no_toma_reservas_online(complejo) -> None:
    respuesta = reservar_online(complejo)
    assert respuesta.status_code == 409
    detalle = TestClient(app).get(f"/publico/complejos/{complejo['slug']}").json()
    assert detalle["reservas_online"] is False


def test_reserva_pendiente_con_vencimiento(complejo, simulados) -> None:
    creada = reservar_online(complejo)
    assert creada.status_code == 201, creada.text
    reserva = ver(complejo, creada.json()["id"])
    assert (reserva["estado"], reserva["jugador"], reserva["sena"]) == (
        "pendiente_pago",
        "Juan",
        "11000.00",
    )
    assert reserva["pago_simulado"] is True
    vence = datetime.fromisoformat(reserva["vence_a"])
    assert timedelta(minutes=9) < vence - datetime.now(UTC) <= timedelta(minutes=10)

    publico = (
        TestClient(app)
        .get(
            f"/publico/complejos/{complejo['slug']}/disponibilidad",
            params={"deporte": "futbol5", "fecha": complejo["a_las"](21).date().isoformat()},
        )
        .json()
    )
    assert next(t for t in publico["turnos"] if t["hora"] == "21:00")["libres"] == []


def test_el_mismo_turno_no_se_reserva_dos_veces(complejo, simulados) -> None:
    reservar_online(complejo)
    otra = reservar_online(complejo, telefono="11 4444-0000")
    assert otra.status_code == 409


def test_tope_de_pendientes_por_telefono(complejo, simulados) -> None:
    assert reservar_online(complejo, 19).status_code == 201
    assert reservar_online(complejo, 20).status_code == 201
    tercera = reservar_online(complejo, 22)
    assert tercera.status_code == 429


def test_simular_pago_confirma_una_sola_vez(complejo, simulados) -> None:
    reserva_id = reservar_online(complejo).json()["id"]
    base = f"/publico/complejos/{complejo['slug']}/reservas/{reserva_id}"
    pagada = TestClient(app).post(f"{base}/simular-pago")
    assert pagada.json()["estado"] == "confirmada"
    assert TestClient(app).post(f"{base}/simular-pago").status_code == 409
    with sesion_de_negocio(complejo["negocio"].id) as s:
        assert s.scalar(select(func.count()).select_from(Pago)) == 1


def test_sin_modo_simulado_no_se_puede_simular(complejo, simulados, monkeypatch) -> None:
    reserva_id = reservar_online(complejo).json()["id"]
    monkeypatch.setattr(get_settings(), "pagos_simulados", False)
    respuesta = TestClient(app).post(
        f"/publico/complejos/{complejo['slug']}/reservas/{reserva_id}/simular-pago"
    )
    assert respuesta.status_code == 404


def test_la_tarea_vence_las_impagas_y_libera_el_turno(complejo, simulados) -> None:
    reserva_id = reservar_online(complejo).json()["id"]
    with sesion_admin() as s, s.begin():
        s.execute(
            update(Reserva)
            .where(Reserva.id == uuid.UUID(reserva_id))
            .values(vence_a=datetime.now(UTC) - timedelta(minutes=1))
        )
    tick()
    assert ver(complejo, reserva_id)["estado"] == "vencida"
    assert reservar_online(complejo, telefono="11 4444-0000").status_code == 201


def test_una_reserva_de_otro_complejo_da_404(complejo, simulados, crear_negocio, admin) -> None:
    reserva_id = reservar_online(complejo).json()["id"]
    otro = admin.get(Negocio, crear_negocio()).slug
    assert (
        TestClient(app).get(f"/publico/complejos/{otro}/reservas/{reserva_id}").status_code == 404
    )


# --- Acreditación (lo mismo que va a usar el webhook de Mercado Pago) ---


@pytest.fixture
def pendiente(complejo) -> Reserva:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        reserva = reservar(s, complejo["negocio"], deporte_codigo="futbol5",
                           inicio=complejo["a_las"](21), cliente=DatosCliente("Juan", "1155551234"),
                           origen="web", estado="pendiente_pago",
                           vence_a=datetime.now(UTC) + timedelta(minutes=10))  # fmt: skip
        s.commit()
        return reserva


def pago(reserva: Reserva, **cambios) -> PagoInformado:
    datos = {"id": uuid.uuid4().hex, "estado": "approved", "monto": Decimal("11000.00"),
             "moneda": "ARS", "reserva_id": reserva.id}  # fmt: skip
    return PagoInformado(**(datos | cambios))


def acreditar(complejo: dict, informado: PagoInformado) -> Resultado:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        resultado = acreditar_pago(s, complejo["negocio"], informado)
        s.commit()
        return resultado


def estado(complejo: dict, reserva: Reserva) -> str:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        return s.get(Reserva, reserva.id).estado


def test_pago_aprobado_confirma(complejo, pendiente) -> None:
    assert acreditar(complejo, pago(pendiente)) is Resultado.CONFIRMADA
    assert estado(complejo, pendiente) == "confirmada"


def test_el_mismo_pago_dos_veces_confirma_una_sola(complejo, pendiente) -> None:
    informado = pago(pendiente)
    assert acreditar(complejo, informado) is Resultado.CONFIRMADA
    assert acreditar(complejo, informado) is Resultado.YA_REGISTRADO
    with sesion_de_negocio(complejo["negocio"].id) as s:
        assert s.scalar(select(func.count()).select_from(Pago)) == 1


@pytest.mark.parametrize(
    ("cambios", "resultado"),
    [
        ({"monto": Decimal("100.00")}, Resultado.MONTO_INVALIDO),
        ({"moneda": "USD"}, Resultado.MONTO_INVALIDO),
        ({"estado": "rejected"}, Resultado.NO_APROBADO),
    ],
)
def test_no_confirma_si_algo_no_cierra(complejo, pendiente, cambios, resultado) -> None:
    assert acreditar(complejo, pago(pendiente, **cambios)) is resultado
    assert estado(complejo, pendiente) == "pendiente_pago"


def test_vencida_con_el_turno_libre_se_confirma(complejo, pendiente) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        s.get(Reserva, pendiente.id).estado = "vencida"
        s.commit()
    assert acreditar(complejo, pago(pendiente)) is Resultado.CONFIRMADA


def test_vencida_con_el_turno_tomado_se_devuelve(complejo, pendiente) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        s.get(Reserva, pendiente.id).estado = "vencida"
        s.commit()
        reservar(s, complejo["negocio"], deporte_codigo="futbol5", inicio=complejo["a_las"](21),
                 cliente=DatosCliente("Otro", "1144440000"), origen="panel")  # fmt: skip
        s.commit()
    assert acreditar(complejo, pago(pendiente)) is Resultado.A_DEVOLVER
    assert estado(complejo, pendiente) == "vencida"


def test_cancelada_se_devuelve(complejo, pendiente) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        s.get(Reserva, pendiente.id).estado = "cancelada"
        s.commit()
    assert acreditar(complejo, pago(pendiente)) is Resultado.A_DEVOLVER


def test_un_segundo_pago_de_la_misma_reserva_se_devuelve(complejo, pendiente) -> None:
    assert acreditar(complejo, pago(pendiente)) is Resultado.CONFIRMADA
    assert acreditar(complejo, pago(pendiente)) is Resultado.A_DEVOLVER


def test_pago_de_una_reserva_de_otro_complejo_no_se_acredita(
    complejo, pendiente, crear_negocio, admin
) -> None:
    otro = admin.get(Negocio, crear_negocio())
    with sesion_de_negocio(otro.id) as s:
        assert acreditar_pago(s, otro, pago(pendiente)) is Resultado.SIN_RESERVA


@pytest.mark.parametrize("dias", [-2, 31])
def test_no_se_reserva_un_turno_pasado_ni_demasiado_lejano(complejo, simulados, dias) -> None:
    inicio = complejo["a_las"](21) + timedelta(days=dias)
    respuesta = TestClient(app).post(
        f"/publico/complejos/{complejo['slug']}/reservas",
        json={"deporte": "futbol5", "inicio": inicio.isoformat(),
              "nombre": "Juan Pérez", "telefono": "11 5555-1234"},
    )  # fmt: skip
    assert respuesta.status_code == 422


def test_pagos_simulados_no_arranca_en_produccion(monkeypatch) -> None:
    from pydantic import ValidationError

    from app.config import Settings

    monkeypatch.setenv("PAGOS_SIMULADOS", "true")
    monkeypatch.setenv("COOKIE_SEGURA", "true")
    assert Settings().pagos_simulados  # web de pruebas, sin Mercado Pago: se permite
    monkeypatch.setenv("MP_CLIENT_ID", "123")
    with pytest.raises(ValidationError, match="PAGOS_SIMULADOS"):
        Settings()
