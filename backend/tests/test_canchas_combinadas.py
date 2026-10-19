"""Canchas unidas: dos de fútbol 5 forman una de fútbol 7. Reservar la grande bloquea sus
partes, reservar una parte bloquea la grande, y los espejos siguen a la reserva original."""

import uuid
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import sesion_admin
from app.jobs.tick import main as tick
from app.main import app
from app.models import Horario, Negocio, Reserva, Usuario
from app.services.auth import hashear_clave
from app.services.disponibilidad import hoy_en_el_negocio
from tests.test_agenda import BA, CLAVE, entrar


@pytest.fixture
def predio(admin: Session, crear_negocio, crear_recurso) -> dict:
    """Una de fútbol 7 ("Grande") que se arma con Chica 1 y Chica 2 (fútbol 5), y una
    Chica 3 aparte. Todas de 18 a 24, turnos de una hora."""
    negocio_id = crear_negocio(sena_tipo="porcentaje", sena_valor=Decimal("20"))
    grande = crear_recurso(negocio_id, "futbol7", "Grande")
    chicas = [crear_recurso(negocio_id, "futbol5", f"Chica {i}") for i in (1, 2, 3)]
    for recurso_id in [grande, *chicas]:
        for dia in range(7):
            admin.add(Horario(negocio_id=negocio_id, recurso_id=recurso_id, dia_semana=dia,
                              desde=time(18), hasta=time(0), duracion_turno_min=60,
                              precio=Decimal("60000")))  # fmt: skip
    dueno = f"dueno-{uuid.uuid4().hex[:6]}@prueba.example"
    admin.add(Usuario(email=dueno, rol="dueno", negocio_id=negocio_id,
                      password_hash=hashear_clave(CLAVE)))  # fmt: skip
    admin.commit()
    negocio = admin.get(Negocio, negocio_id)
    manana = hoy_en_el_negocio(negocio) + timedelta(days=1)
    cliente = entrar(dueno)
    unida = cliente.put(
        f"/panel/{negocio.slug}/canchas/{grande}/partes",
        json={"partes": [str(chicas[0]), str(chicas[1])]},
    )
    assert unida.status_code == 200, unida.text
    return {
        "negocio": negocio,
        "slug": negocio.slug,
        "grande": grande,
        "chicas": chicas,
        "dueno": cliente,
        "fecha": manana,
        "a_las": lambda h: datetime.combine(manana, time(h), tzinfo=BA),
    }


def cargar(predio: dict, recurso_id, hora: int):
    return predio["dueno"].post(
        f"/panel/{predio['slug']}/reservas",
        json={
            "recurso_id": str(recurso_id),
            "inicio": predio["a_las"](hora).isoformat(),
            "nombre": "Martín Gómez",
            "telefono": "11 5555-1234",
        },  # fmt: skip
    )


def libres(predio: dict, deporte: str, hora: str) -> int:
    dia = (
        TestClient(app)
        .get(
            f"/publico/complejos/{predio['slug']}/disponibilidad",
            params={"deporte": deporte, "fecha": predio["fecha"].isoformat()},
        )
        .json()
    )
    return next((len(t["libres"]) for t in dia["turnos"] if t["hora"] == hora), 0)


def estado_en_agenda(predio: dict, recurso_id, hora: str) -> dict | None:
    agenda = (
        predio["dueno"]
        .get(f"/panel/{predio['slug']}/agenda", params={"fecha": predio["fecha"].isoformat()})
        .json()
    )
    cancha = next(c for c in agenda["canchas"] if c["id"] == str(recurso_id))
    return next(t for t in cancha["turnos"] if t["hora"] == hora)["reserva"]


def test_la_combinacion_se_ve_en_el_panel(predio) -> None:
    canchas = predio["dueno"].get(f"/panel/{predio['slug']}/canchas").json()
    grande = next(c for c in canchas if c["id"] == str(predio["grande"]))
    assert set(grande["partes"]) == {str(predio["chicas"][0]), str(predio["chicas"][1])}


def test_reservar_la_grande_bloquea_sus_partes(predio) -> None:
    assert cargar(predio, predio["grande"], 21).status_code == 201
    for chica in predio["chicas"][:2]:
        espejo = estado_en_agenda(predio, chica, "21:00")
        assert (espejo["estado"], espejo["motivo_bloqueo"]) == ("bloqueada", "Se usa en Grande")
    # La Chica 3 no es parte: sigue libre. Online solo queda esa de fútbol 5.
    assert estado_en_agenda(predio, predio["chicas"][2], "21:00") is None
    assert libres(predio, "futbol5", "21:00") == 1
    assert cargar(predio, predio["chicas"][0], 21).status_code == 409


def test_reservar_una_parte_bloquea_la_grande(predio) -> None:
    assert cargar(predio, predio["chicas"][1], 20).status_code == 201
    assert estado_en_agenda(predio, predio["grande"], "20:00")["estado"] == "bloqueada"
    assert libres(predio, "futbol7", "20:00") == 0
    assert cargar(predio, predio["grande"], 20).status_code == 409
    # La otra parte sigue libre (no comparte lugar con la Chica 2).
    assert cargar(predio, predio["chicas"][0], 20).status_code == 201


def test_cancelar_mover_y_el_espejo_no_se_toca_solo(predio) -> None:
    reserva = cargar(predio, predio["grande"], 21).json()
    espejo = estado_en_agenda(predio, predio["chicas"][0], "21:00")
    # El espejo no se levanta suelto: protege a la reserva original.
    suelto = predio["dueno"].post(f"/panel/{predio['slug']}/reservas/{espejo['id']}/cancelar")
    assert suelto.status_code == 409
    detalle = predio["dueno"].get(f"/panel/{predio['slug']}/reservas/{espejo['id']}").json()
    assert detalle["espejo"] is True

    # Mover la grande a las 22: los espejos se van con ella.
    movida = predio["dueno"].post(
        f"/panel/{predio['slug']}/reservas/{reserva['id']}/mover",
        json={"recurso_id": str(predio["grande"]), "inicio": predio["a_las"](22).isoformat()},
    )
    assert movida.status_code == 200, movida.text
    assert estado_en_agenda(predio, predio["chicas"][0], "21:00") is None
    assert estado_en_agenda(predio, predio["chicas"][0], "22:00")["estado"] == "bloqueada"

    # Cancelarla libera las partes.
    cancelada = predio["dueno"].post(
        f"/panel/{predio['slug']}/reservas/{reserva['id']}/cancelar",
        json={"devolver_sena": False},
    )
    assert cancelada.status_code == 200
    assert libres(predio, "futbol5", "22:00") == 3


def test_un_bloqueo_en_la_grande_cierra_las_partes(predio) -> None:
    bloqueo = predio["dueno"].post(
        f"/panel/{predio['slug']}/bloqueos",
        json={
            "turnos": [
                {"recurso_id": str(predio["grande"]), "inicio": predio["a_las"](19).isoformat()}
            ],
            "motivo": "Torneo",
        },  # fmt: skip
    )
    assert bloqueo.status_code == 200, bloqueo.text
    assert libres(predio, "futbol5", "19:00") == 1


def test_bloqueo_fijo_en_la_grande_cierra_las_partes(predio) -> None:
    fijo = {"dia_semana": predio["fecha"].weekday(), "desde": "23:00", "hasta": "00:00",
            "motivo": "Liga", "recurso_id": str(predio["grande"])}  # fmt: skip
    creado = predio["dueno"].post(f"/panel/{predio['slug']}/bloqueos-fijos", json=fijo)
    assert creado.status_code == 201, creado.text
    assert libres(predio, "futbol7", "23:00") == 0
    assert libres(predio, "futbol5", "23:00") == 1


def test_la_reserva_que_vence_libera_las_partes(predio, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "pagos_simulados", True)
    online = TestClient(app).post(
        f"/publico/complejos/{predio['slug']}/reservas",
        json={
            "deporte": "futbol7",
            "inicio": predio["a_las"](18).isoformat(),
            "nombre": "Ana",
            "telefono": "1155550123",
        },  # fmt: skip
    )
    assert online.status_code == 201, online.text
    assert libres(predio, "futbol5", "18:00") == 1
    with sesion_admin() as s, s.begin():
        s.execute(
            update(Reserva)
            .where(Reserva.id == uuid.UUID(online.json()["id"]))
            .values(vence_a=datetime.now(UTC) - timedelta(minutes=1))
        )
    tick()
    assert libres(predio, "futbol5", "18:00") == 3


def test_combinaciones_invalidas(predio) -> None:
    partes = f"/panel/{predio['slug']}/canchas/{predio['chicas'][0]}/partes"
    # Círculo: la Chica 1 no puede formarse con la Grande, que ya la incluye.
    circulo = predio["dueno"].put(partes, json={"partes": [str(predio["grande"])]})
    assert circulo.status_code == 422
    assert (
        predio["dueno"].put(partes, json={"partes": [str(predio["chicas"][0])]}).status_code == 422
    )
    assert predio["dueno"].put(partes, json={"partes": [str(uuid.uuid4())]}).status_code == 422


def test_unir_canchas_con_reservas_que_ya_se_pisan(predio) -> None:
    # Se separan, se reservan la grande y una chica a la misma hora, y se vuelven a unir.
    url = f"/panel/{predio['slug']}/canchas/{predio['grande']}/partes"
    assert predio["dueno"].put(url, json={"partes": []}).json()["reservas_que_se_pisan"] == []
    assert cargar(predio, predio["grande"], 21).status_code == 201
    assert cargar(predio, predio["chicas"][0], 21).status_code == 201
    unida = (
        predio["dueno"]
        .put(url, json={"partes": [str(predio["chicas"][0]), str(predio["chicas"][1])]})
        .json()
    )
    # Las dos ya chocaban: quedan como estaban y se informan para resolverlas a mano.
    assert {r["cancha"] for r in unida["reservas_que_se_pisan"]} == {"Grande", "Chica 1"}
