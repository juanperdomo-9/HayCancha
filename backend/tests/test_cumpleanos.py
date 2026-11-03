"""Cumpleaños: una cancha por un tiempo fijo, a precio cerrado y (por ahora) sin seña. Se
reserva desde la página aunque el complejo no tenga Mercado Pago, ocupa todos los turnos que
cubre y los detalles se arreglan por WhatsApp."""

from decimal import Decimal

from fastapi.testclient import TestClient

from app.db import sesion_de_negocio
from app.main import app
from app.models import Negocio
from tests.test_agenda import agenda, cargar, complejo, entrar, turno  # noqa: F401


def crear_cumple(complejo: dict, **datos) -> dict:  # noqa: F811
    dueno = entrar(complejo["dueno"])
    respuesta = dueno.post(
        f"/panel/{complejo['slug']}/cumpleanos",
        json={
            "nombre": "Cumple fútbol 7",
            "deporte": "futbol7",
            "duracion_min": 120,
            "precio": "150000",
            "condiciones": "Máximo 20 chicos.",
            **datos,
        },  # fmt: skip
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()[-1]


def horarios(complejo: dict, cumple: dict) -> dict[str, dict]:  # noqa: F811
    respuesta = TestClient(app).get(
        f"/publico/complejos/{complejo['slug']}/disponibilidad",
        params={
            "deporte": "futbol7",
            "fecha": complejo["fecha"].isoformat(),
            "cumpleanos": cumple["id"],
        },  # fmt: skip
    )
    assert respuesta.status_code == 200, respuesta.text
    return {t["hora"]: t for t in respuesta.json()["turnos"]}


def reservar_cumple(complejo: dict, cumple: dict, hora: int, telefono="1155550123", **extra):  # noqa: F811
    return TestClient(app).post(
        f"/publico/complejos/{complejo['slug']}/reservas",
        json={
            "deporte": "futbol7",
            "inicio": complejo["a_las"](hora).isoformat(),
            "nombre": "Laura Díaz",
            "telefono": telefono,
            "cumpleanos_id": cumple["id"],
            **extra,
        },  # fmt: skip
    )


def test_se_reserva_sin_sena_y_ocupa_los_turnos_que_cubre(complejo) -> None:  # noqa: F811
    cumple = crear_cumple(complejo)
    with sesion_de_negocio(complejo["negocio"].id) as s:
        s.get(Negocio, complejo["negocio"].id).whatsapp = "5491155550000"
        s.commit()

    publico = TestClient(app).get(f"/publico/complejos/{complejo['slug']}").json()
    assert [(c["nombre"], c["duracion_min"]) for c in publico["cumpleanos"]] == [
        ("Cumple fútbol 7", 120)
    ]
    # Se alquila de 18 a 24 en turnos de 1 hora: un cumpleaños de 2 horas puede empezar
    # hasta las 22. El precio es el del cumpleaños y no hay seña.
    libres = horarios(complejo, cumple)
    assert list(libres) == ["18:00", "19:00", "20:00", "21:00", "22:00"]
    assert libres["22:00"]["hora_fin"] == "00:00"
    assert {(c["precio"], c["sena"]) for c in libres["20:00"]["libres"]} == {("150000.00", "0.00")}

    # El complejo no tiene Mercado Pago, pero el cumpleaños se reserva igual.
    creada = reservar_cumple(complejo, cumple, 20, recurso_id=str(complejo["canchas"][0]),
                             nota="Tomi, 8 años, 15 chicos")  # fmt: skip
    assert creada.status_code == 201, creada.text
    assert creada.json()["url_pago"] is None
    reserva = (
        TestClient(app)
        .get(f"/publico/complejos/{complejo['slug']}/reservas/{creada.json()['id']}")
        .json()
    )
    assert reserva["estado"] == "confirmada"
    assert (reserva["hora"], reserva["hora_fin"]) == ("20:00", "22:00")
    assert Decimal(reserva["sena"]) == 0 and Decimal(reserva["saldo"]) == Decimal("150000")
    assert reserva["cumpleanos"]["condiciones"] == "Máximo 20 chicos."
    assert reserva["whatsapp"] == "5491155550000"
    assert reserva["nota"] == "Tomi, 8 años, 15 chicos"
    assert reserva["puede_cambiar"] is False

    # En la agenda ocupa los dos turnos, marcado como cumpleaños, y nadie más los toma.
    dueno = entrar(complejo["dueno"])
    grilla = agenda(dueno, complejo)
    for hora in ("20:00", "21:00"):
        ocupado = turno(grilla, complejo["canchas"][0], hora)["reserva"]
        assert ocupado["cumpleanos"] == "Cumple fútbol 7"
    assert turno(grilla, complejo["canchas"][0], "22:00")["reserva"] is None
    assert cargar(dueno, complejo, 0, 21).status_code == 409
    detalle = dueno.get(f"/panel/{complejo['slug']}/reservas/{creada.json()['id']}").json()
    assert detalle["nota"] == "Tomi, 8 años, 15 chicos"

    # Un cumpleaños no se mueve desde la agenda.
    movida = dueno.post(
        f"/panel/{complejo['slug']}/reservas/{creada.json()['id']}/mover",
        json={
            "recurso_id": str(complejo["canchas"][1]),
            "inicio": complejo["a_las"](18).isoformat(),
        },
    )
    assert movida.status_code == 422


def test_necesita_turnos_seguidos_libres(complejo) -> None:  # noqa: F811
    cumple = crear_cumple(complejo)
    dueno = entrar(complejo["dueno"])
    for cancha in (0, 1):
        assert cargar(dueno, complejo, cancha, 21).status_code == 201

    libres = horarios(complejo, cumple)
    # A las 20 no alcanza (a las 21 está todo ocupado); a las 18 y a las 22, sí.
    assert libres["20:00"]["libres"] == []
    assert len(libres["18:00"]["libres"]) == 2
    assert len(libres["22:00"]["libres"]) == 2
    assert reservar_cumple(complejo, cumple, 20).status_code == 409
    # A las 23 no entra: la franja termina a medianoche.
    assert reservar_cumple(complejo, cumple, 23).status_code == 422


def test_topes_y_cumpleanos_desactivados(complejo) -> None:  # noqa: F811
    cumple = crear_cumple(complejo)
    assert reservar_cumple(complejo, cumple, 18).status_code == 201
    # Sin seña, un mismo teléfono tiene un cumpleaños por venir por complejo.
    assert reservar_cumple(complejo, cumple, 22).status_code == 429

    dueno = entrar(complejo["dueno"])
    # Ya tiene una reserva: se desactiva en vez de borrarse, y deja de ofrecerse.
    lista = dueno.delete(f"/panel/{complejo['slug']}/cumpleanos/{cumple['id']}").json()
    assert lista[0]["activo"] is False
    assert TestClient(app).get(f"/publico/complejos/{complejo['slug']}").json()["cumpleanos"] == []
    assert reservar_cumple(complejo, cumple, 22, telefono="1155559999").status_code == 404


def test_el_empleado_no_configura_cumpleanos(complejo) -> None:  # noqa: F811
    empleado = entrar(complejo["empleado"])
    assert empleado.get(f"/panel/{complejo['slug']}/cumpleanos").status_code == 403


def test_dias_y_horarios_propios(complejo) -> None:  # noqa: F811
    dia = complejo["fecha"].weekday()
    cumple = crear_cumple(
        complejo, franjas=[{"dia_semana": dia, "desde": "19:00", "hasta": "22:00"}]
    )
    # De 2 horas, entre las 19 y las 22: solo puede empezar a las 19 o a las 20.
    assert list(horarios(complejo, cumple)) == ["19:00", "20:00"]
    assert reservar_cumple(complejo, cumple, 18).status_code == 422

    # Otro día de la semana no se ofrece.
    dueno = entrar(complejo["dueno"])
    otro = (dia + 1) % 7
    dueno.patch(
        f"/panel/{complejo['slug']}/cumpleanos/{cumple['id']}",
        json={"franjas": [{"dia_semana": otro, "desde": "19:00", "hasta": "22:00"}]},
    )
    assert horarios(complejo, cumple) == {}

    # Sin franjas, vuelve a cualquier turno de la cancha.
    lista = dueno.patch(
        f"/panel/{complejo['slug']}/cumpleanos/{cumple['id']}", json={"franjas": []}
    )
    assert lista.json()[0]["franjas"] == []
    assert len(horarios(complejo, cumple)) == 5
