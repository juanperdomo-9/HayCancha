"""Agenda del panel: grilla del día, carga manual, bloqueos, mover, cancelar y la semana."""

import uuid
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.main import app
from app.models import Horario, Negocio, Reserva, Usuario
from app.services.auth import hashear_clave
from app.services.disponibilidad import hoy_en_el_negocio
from app.services.reservas import DatosCliente, TurnoNoDisponible, reservar

BA = ZoneInfo("America/Argentina/Buenos_Aires")
CLAVE = "clave-de-prueba-1"


def entrar(email: str) -> TestClient:
    cliente = TestClient(app)
    assert cliente.post("/auth/ingresar", json={"email": email, "clave": CLAVE}).status_code == 200
    return cliente


@pytest.fixture
def complejo(admin: Session, crear_negocio, crear_recurso) -> dict:
    """2 canchas de fútbol 7 de 18 a 24 ($80.000, seña 20%) y un dueño y un empleado."""
    negocio_id = crear_negocio(sena_tipo="porcentaje", sena_valor=Decimal("20"))
    canchas = [crear_recurso(negocio_id, "futbol7", f"Cancha {i}") for i in (1, 2)]
    for dia in range(7):
        for recurso_id in canchas:
            admin.add(Horario(negocio_id=negocio_id, recurso_id=recurso_id, dia_semana=dia,
                              desde=time(18), hasta=time(0), duracion_turno_min=60,
                              precio=Decimal("80000")))  # fmt: skip
    usuarios = {}
    for rol in ("dueno", "empleado"):
        usuarios[rol] = f"{rol}-{uuid.uuid4().hex[:6]}@prueba.example"
        admin.add(Usuario(email=usuarios[rol], rol=rol, negocio_id=negocio_id,
                          password_hash=hashear_clave(CLAVE)))  # fmt: skip
    admin.commit()
    negocio = admin.get(Negocio, negocio_id)
    manana = hoy_en_el_negocio(negocio) + timedelta(days=1)
    return {
        "negocio": negocio,
        "slug": negocio.slug,
        "canchas": canchas,
        "fecha": manana,
        "a_las": lambda h: datetime.combine(manana, time(h), tzinfo=BA),
        **usuarios,
    }


def turno(agenda: dict, cancha_id: uuid.UUID, hora: str) -> dict:
    cancha = next(c for c in agenda["canchas"] if c["id"] == str(cancha_id))
    return next(t for t in cancha["turnos"] if t["hora"] == hora)


def agenda(cliente: TestClient, complejo: dict) -> dict:
    respuesta = cliente.get(
        f"/panel/{complejo['slug']}/agenda", params={"fecha": complejo["fecha"].isoformat()}
    )
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def cargar(cliente: TestClient, complejo: dict, cancha: int, hora: int, **extra):
    return cliente.post(
        f"/panel/{complejo['slug']}/reservas",
        json={
            "recurso_id": str(complejo["canchas"][cancha]),
            "inicio": complejo["a_las"](hora).isoformat(),
            "nombre": "Martín Gómez",
            "telefono": "11 5555-1234",
            **extra,
        },
    )


def test_la_grilla_muestra_cada_estado_con_el_nombre(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    cargar(dueno, complejo, 0, 19, sena_en_efectivo=True)
    with sesion_de_negocio(complejo["negocio"].id) as s:
        reservar(s, complejo["negocio"], deporte_codigo="futbol7", inicio=complejo["a_las"](20),
                 cliente=DatosCliente("Sofía Ruiz", "1155556666"), origen="web",
                 estado="pendiente_pago", recurso_id=complejo["canchas"][0],
                 vence_a=datetime.now(UTC) + timedelta(minutes=8))  # fmt: skip
        s.commit()
    dueno.post(
        f"/panel/{complejo['slug']}/bloqueos",
        json={"turnos": [{"recurso_id": str(complejo["canchas"][0]),
                          "inicio": complejo["a_las"](21).isoformat()}], "motivo": "Torneo"},
    )  # fmt: skip

    grilla = agenda(dueno, complejo)
    cancha = complejo["canchas"][0]
    reservada = turno(grilla, cancha, "19:00")["reserva"]
    pendiente = turno(grilla, cancha, "20:00")["reserva"]
    bloqueada = turno(grilla, cancha, "21:00")["reserva"]
    assert turno(grilla, cancha, "18:00")["reserva"] is None
    assert turno(grilla, cancha, "18:00")["sena"] == "16000.00"
    assert (reservada["estado"], reservada["cliente"], reservada["origen"]) == (
        "confirmada",
        "Martín Gómez",
        "panel",
    )
    assert (reservada["sena"], reservada["saldo"]) == ("16000.00", "64000.00")
    assert (pendiente["estado"], pendiente["cliente"]) == ("pendiente_pago", "Sofía Ruiz")
    assert 6 <= pendiente["minutos_para_pagar"] <= 8
    assert (bloqueada["estado"], bloqueada["motivo_bloqueo"]) == ("bloqueada", "Torneo")

    resumen = grilla["resumen"]
    assert (resumen["ocupados"], resumen["bloqueados"], resumen["libres"]) == (2, 1, 9)
    assert (resumen["senas_cobradas"], resumen["saldo_por_cobrar"]) == ("16000.00", "64000.00")


def test_una_reserva_por_telefono_ocupa_el_turno_para_la_web(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    assert cargar(dueno, complejo, 0, 21).status_code == 201
    assert cargar(dueno, complejo, 1, 21).status_code == 201

    publico = (
        TestClient(app)
        .get(
            f"/publico/complejos/{complejo['slug']}/disponibilidad",
            params={"deporte": "futbol7", "fecha": complejo["fecha"].isoformat()},
        )
        .json()
    )
    a_las_21 = next(t for t in publico["turnos"] if t["hora"] == "21:00")
    assert a_las_21["libres"] == []

    with sesion_de_negocio(complejo["negocio"].id) as s, pytest.raises(TurnoNoDisponible):
        reservar(s, complejo["negocio"], deporte_codigo="futbol7", inicio=complejo["a_las"](21),
                 cliente=DatosCliente("Online", "1144443333"), origen="web")  # fmt: skip


def test_sin_sena_en_efectivo_la_sena_es_cero(complejo) -> None:
    detalle = cargar(entrar(complejo["dueno"]), complejo, 0, 19).json()
    assert (detalle["sena"], detalle["saldo"], detalle["sena_en_efectivo"]) == (
        "0.00",
        "80000.00",
        False,
    )


def test_no_se_carga_encima_de_otra(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    cargar(dueno, complejo, 0, 19)
    assert cargar(dueno, complejo, 0, 19).status_code == 409


def test_el_empleado_maneja_la_agenda(complejo) -> None:
    empleado = entrar(complejo["empleado"])
    assert agenda(empleado, complejo)["canchas"]
    assert cargar(empleado, complejo, 1, 22).status_code == 201


def test_otro_complejo_no_ve_esta_agenda(complejo, crear_negocio, admin: Session) -> None:
    otro = crear_negocio()
    email = f"otro-{uuid.uuid4().hex[:6]}@prueba.example"
    admin.add(
        Usuario(email=email, rol="dueno", negocio_id=otro, password_hash=hashear_clave(CLAVE))
    )
    admin.commit()
    assert entrar(email).get(f"/panel/{complejo['slug']}/agenda").status_code == 403


def test_marcar_asistencia_y_saldo(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    reserva = cargar(dueno, complejo, 0, 19).json()
    cambio = dueno.patch(
        f"/panel/{complejo['slug']}/reservas/{reserva['id']}",
        json={"asistencia": "vino", "saldo_cobrado": True},
    ).json()
    assert (cambio["asistencia"], cambio["saldo_cobrado"]) == ("vino", True)
    assert agenda(dueno, complejo)["resumen"]["saldo_por_cobrar"] == "0.00"


def test_cancelar_libera_el_turno(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    reserva = cargar(dueno, complejo, 0, 19).json()
    cancelada = dueno.post(f"/panel/{complejo['slug']}/reservas/{reserva['id']}/cancelar").json()
    assert cancelada["estado"] == "cancelada"
    assert turno(agenda(dueno, complejo), complejo["canchas"][0], "19:00")["reserva"] is None
    assert cargar(dueno, complejo, 0, 19).status_code == 201


def test_mover_a_otra_cancha_y_horario(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    reserva = cargar(dueno, complejo, 0, 19).json()
    cargar(dueno, complejo, 1, 22)
    base = f"/panel/{complejo['slug']}/reservas/{reserva['id']}/mover"

    ocupado = dueno.post(base, json={"recurso_id": str(complejo["canchas"][1]),
                                     "inicio": complejo["a_las"](22).isoformat()})  # fmt: skip
    assert ocupado.status_code == 409

    movida = dueno.post(base, json={"recurso_id": str(complejo["canchas"][1]),
                                    "inicio": complejo["a_las"](23).isoformat()})  # fmt: skip
    assert movida.status_code == 200
    assert (movida.json()["cancha"], movida.json()["hora"]) == ("Cancha 2", "23:00")
    grilla = agenda(dueno, complejo)
    assert turno(grilla, complejo["canchas"][0], "19:00")["reserva"] is None


def test_bloquear_varios_turnos_saltea_los_ocupados_y_se_puede_desbloquear(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    cargar(dueno, complejo, 0, 19)
    pedido = [
        {"recurso_id": str(cancha), "inicio": complejo["a_las"](hora).isoformat()}
        for cancha in complejo["canchas"]
        for hora in (18, 19)
    ]
    resultado = dueno.post(
        f"/panel/{complejo['slug']}/bloqueos", json={"turnos": pedido, "motivo": "Lluvia"}
    ).json()
    assert resultado == {"bloqueados": 3, "omitidos": 1}

    bloqueo = turno(agenda(dueno, complejo), complejo["canchas"][1], "18:00")["reserva"]
    dueno.post(f"/panel/{complejo['slug']}/reservas/{bloqueo['id']}/cancelar")
    assert turno(agenda(dueno, complejo), complejo["canchas"][1], "18:00")["reserva"] is None


def test_la_semana_cuenta_libres_y_ocupados(complejo) -> None:
    dueno = entrar(complejo["dueno"])
    cargar(dueno, complejo, 0, 19)
    semana = dueno.get(
        f"/panel/{complejo['slug']}/semana", params={"desde": complejo["fecha"].isoformat()}
    ).json()
    assert len(semana) == 7
    assert (semana[0]["ocupados"], semana[0]["libres"]) == (1, 11)
    assert (semana[1]["ocupados"], semana[1]["libres"]) == (0, 12)


def test_las_reservas_quedan_con_quien_las_cargo(complejo, admin: Session) -> None:
    dueno = entrar(complejo["dueno"])
    reserva_id = cargar(dueno, complejo, 0, 19).json()["id"]
    reserva = admin.get(Reserva, uuid.UUID(reserva_id))
    creador = admin.get(Usuario, reserva.creado_por)
    assert creador.email == complejo["dueno"]
