"""Turnos fijos de juego (reservas de verdad todas las semanas) y seña en efectivo con otro
monto."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app.db import sesion_de_negocio
from app.main import app
from app.models import TurnoFijo
from app.services.turnos_fijos import generar
from tests.test_agenda import agenda, cargar, complejo, entrar, turno  # noqa: F401


def crear_fijo(dueno: TestClient, complejo: dict, hora: str = "21:00"):  # noqa: F811
    return dueno.post(
        f"/panel/{complejo['slug']}/turnos-fijos",
        json={
            "recurso_id": str(complejo["canchas"][0]),
            "dia_semana": complejo["fecha"].weekday(),
            "desde": hora,
            "nombre": "Martín Fijo",
            "telefono": "1155557777",
        },  # fmt: skip
    )


def test_reserva_todas_las_semanas_y_se_maneja_como_una_reserva(complejo) -> None:  # noqa: F811
    dueno = entrar(complejo["dueno"])
    creado = crear_fijo(dueno, complejo)
    assert creado.status_code == 201, creado.text
    # Las próximas 4 o 5 semanas (30 días), desde mañana.
    assert creado.json()["creadas"] in (4, 5)
    assert creado.json()["omitidas"] == []

    ocupado = turno(agenda(dueno, complejo), complejo["canchas"][0], "21:00")["reserva"]
    assert ocupado["cliente"] == "Martín Fijo" and ocupado["turno_fijo"] is True
    detalle = dueno.get(f"/panel/{complejo['slug']}/reservas/{ocupado['id']}").json()
    assert detalle["turno_fijo"].endswith("a las 21:00")

    # Es una reserva más: seña en efectivo con otro monto, asistencia y saldo.
    cambio = dueno.patch(
        f"/panel/{complejo['slug']}/reservas/{ocupado['id']}",
        json={"sena_efectivo": "10000", "asistencia": "vino"},
    )
    assert cambio.status_code == 200, cambio.text
    assert (cambio.json()["sena"], cambio.json()["saldo"]) == ("10000.00", "70000.00")

    # La web ya no ofrece esa cancha a esa hora.
    libres = (
        TestClient(app)
        .get(
            f"/publico/complejos/{complejo['slug']}/disponibilidad",
            params={"deporte": "futbol7", "fecha": complejo["fecha"].isoformat()},
        )
        .json()["turnos"]
    )
    a_las_21 = next(t for t in libres if t["hora"] == "21:00")
    assert [c["id"] for c in a_las_21["libres"]] == [str(complejo["canchas"][1])]

    # Liberar ese día: se cancela solo esa fecha y no se vuelve a crear.
    liberado = dueno.post(f"/panel/{complejo['slug']}/reservas/{ocupado['id']}/cancelar", json={})
    assert liberado.status_code == 200, liberado.text
    with sesion_de_negocio(complejo["negocio"].id) as s:
        fijo = s.get(TurnoFijo, creado.json()["turno_fijo"]["id"])
        hasta = fijo.generado_hasta + timedelta(days=14)
        assert generar(s, complejo["negocio"], fijo, hasta).creadas == 2
        s.commit()
    assert turno(agenda(dueno, complejo), complejo["canchas"][0], "21:00")["reserva"] is None

    # Liberar para siempre: cancela las que vienen y deja de figurar.
    baja = dueno.delete(
        f"/panel/{complejo['slug']}/turnos-fijos/{creado.json()['turno_fijo']['id']}"
    )
    assert baja.status_code == 204
    assert dueno.get(f"/panel/{complejo['slug']}/turnos-fijos").json() == []
    semana = complejo["fecha"] + timedelta(days=7)
    otra = dueno.get(f"/panel/{complejo['slug']}/agenda", params={"fecha": semana.isoformat()})
    assert turno(otra.json(), complejo["canchas"][0], "21:00")["reserva"] is None


def test_saltea_las_fechas_ocupadas_y_valida_la_hora(complejo) -> None:  # noqa: F811
    dueno = entrar(complejo["dueno"])
    assert cargar(dueno, complejo, 0, 21).status_code == 201
    creado = crear_fijo(dueno, complejo)
    assert creado.status_code == 201, creado.text
    assert len(creado.json()["omitidas"]) == 1
    # 21:30 no es un turno (son de 60 minutos desde las 18).
    assert crear_fijo(dueno, complejo, "21:30").status_code == 422


def test_sena_en_efectivo_con_otro_monto(complejo) -> None:  # noqa: F811
    dueno = entrar(complejo["dueno"])
    cargada = cargar(dueno, complejo, 0, 19, sena_en_efectivo=True, sena_monto="10000")
    assert cargada.status_code == 201, cargada.text
    assert (cargada.json()["sena"], cargada.json()["saldo"]) == ("10000.00", "70000.00")
    reserva = cargada.json()["id"]
    # No puede ser más que el turno.
    mucho = dueno.patch(
        f"/panel/{complejo['slug']}/reservas/{reserva}", json={"sena_efectivo": "90000"}
    )
    assert mucho.status_code == 422
