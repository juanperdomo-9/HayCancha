"""Adicionales: lo que el complejo alquila aparte (paletas, parrilla). Se eligen al reservar
o los suma el dueño después, y se pagan en la cancha con el saldo: la seña no cambia."""

from decimal import Decimal

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_agenda import complejo, entrar  # noqa: F401


def crear(dueno: TestClient, slug: str, **datos) -> list[dict]:
    respuesta = dueno.post(f"/panel/{slug}/adicionales", json=datos)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def reservar_online(complejo: dict, adicionales: list[dict], hora: int = 21):  # noqa: F811
    return TestClient(app).post(
        f"/publico/complejos/{complejo['slug']}/reservas",
        json={
            "deporte": "futbol7",
            "inicio": complejo["a_las"](hora).isoformat(),
            "nombre": "Ana",
            "telefono": "1155550123",
            "adicionales": adicionales,
        },  # fmt: skip
    )


def test_adicionales_al_reservar_online(complejo, monkeypatch) -> None:  # noqa: F811
    monkeypatch.setattr(get_settings(), "pagos_simulados", True)
    slug, dueno = complejo["slug"], entrar(complejo["dueno"])
    crear(dueno, slug, nombre="Parrilla", precio="10000")
    lista = crear(dueno, slug, nombre="Alquiler de paleta", precio="3000", deporte="padel")
    parrilla = next(a for a in lista if a["nombre"] == "Parrilla")
    paleta = next(a for a in lista if a["nombre"] == "Alquiler de paleta")

    # La página del complejo los muestra (la paleta, marcada como de pádel).
    publico = TestClient(app).get(f"/publico/complejos/{slug}").json()
    assert {(a["nombre"], a["deporte"]) for a in publico["adicionales"]} == {
        ("Parrilla", None),
        ("Alquiler de paleta", "padel"),
    }

    # La paleta es de pádel: no se pide en un turno de fútbol 7.
    assert reservar_online(complejo, [{"id": paleta["id"]}]).status_code == 422

    creada = reservar_online(complejo, [{"id": parrilla["id"], "cantidad": 2}])
    assert creada.status_code == 201, creada.text
    reserva = TestClient(app).get(f"/publico/complejos/{slug}/reservas/{creada.json()['id']}")
    datos = reserva.json()
    # Turno de $80.000 con seña del 20%: la seña sigue en $16.000 y el saldo suma $20.000.
    assert Decimal(datos["sena"]) == Decimal("16000")
    assert Decimal(datos["total_adicionales"]) == Decimal("20000")
    assert Decimal(datos["saldo"]) == Decimal("84000")
    assert [(a["nombre"], a["cantidad"]) for a in datos["adicionales"]] == [("Parrilla", 2)]

    # Si el precio cambia después, esta reserva guarda el suyo.
    dueno.patch(f"/panel/{slug}/adicionales/{parrilla['id']}", json={"precio": "15000"})
    detalle = dueno.get(f"/panel/{slug}/reservas/{creada.json()['id']}").json()
    assert Decimal(detalle["total_adicionales"]) == Decimal("20000")


def test_el_dueno_y_el_empleado_los_suman_desde_la_agenda(complejo) -> None:  # noqa: F811
    slug, dueno = complejo["slug"], entrar(complejo["dueno"])
    parrilla = crear(dueno, slug, nombre="Parrilla", precio="10000")[0]
    manual = dueno.post(
        f"/panel/{slug}/reservas",
        json={
            "recurso_id": str(complejo["canchas"][0]),
            "nombre": "Beto",
            "inicio": complejo["a_las"](20).isoformat(),
            "telefono": "1155550456",
        },  # fmt: skip
    ).json()
    empleado = entrar(complejo["empleado"])
    # El empleado no configura adicionales, pero sí los ve y los suma a una reserva.
    assert (
        empleado.post(f"/panel/{slug}/adicionales", json={"nombre": "X", "precio": "1"}).status_code
        == 403
    )
    assert [a["nombre"] for a in empleado.get(f"/panel/{slug}/adicionales").json()] == ["Parrilla"]
    sumado = empleado.put(
        f"/panel/{slug}/reservas/{manual['id']}/adicionales",
        json=[{"id": parrilla["id"], "cantidad": 1}],
    )
    assert sumado.status_code == 200, sumado.text
    assert Decimal(sumado.json()["saldo"]) == Decimal(manual["saldo"]) + Decimal("10000")
    # Y se pueden sacar.
    sacado = empleado.put(f"/panel/{slug}/reservas/{manual['id']}/adicionales", json=[])
    assert Decimal(sacado.json()["saldo"]) == Decimal(manual["saldo"])


def test_quitar_un_adicional(complejo) -> None:  # noqa: F811
    slug, dueno = complejo["slug"], entrar(complejo["dueno"])
    crear(dueno, slug, nombre="Pelota", precio="2000")
    parrilla = crear(dueno, slug, nombre="Parrilla", precio="10000")[-1]
    pelota = next(
        a for a in dueno.get(f"/panel/{slug}/adicionales").json() if a["nombre"] == "Pelota"
    )
    manual = dueno.post(
        f"/panel/{slug}/reservas",
        json={
            "recurso_id": str(complejo["canchas"][0]),
            "nombre": "Beto",
            "inicio": complejo["a_las"](19).isoformat(),
            "telefono": "1155550456",
        },  # fmt: skip
    ).json()
    dueno.put(f"/panel/{slug}/reservas/{manual['id']}/adicionales", json=[{"id": parrilla["id"]}])
    # Nunca pedido: se borra. Ya pedido: se desactiva (la reserva lo conserva).
    quedan = dueno.delete(f"/panel/{slug}/adicionales/{pelota['id']}").json()
    assert [a["nombre"] for a in quedan] == ["Parrilla"]
    quedan = dueno.delete(f"/panel/{slug}/adicionales/{parrilla['id']}").json()
    assert [(a["nombre"], a["activo"]) for a in quedan] == [("Parrilla", False)]
    assert TestClient(app).get(f"/publico/complejos/{slug}").json()["adicionales"] == []
    # Nombre repetido: no.
    repetido = dueno.post(f"/panel/{slug}/adicionales", json={"nombre": "Parrilla", "precio": "1"})
    assert repetido.status_code == 409
