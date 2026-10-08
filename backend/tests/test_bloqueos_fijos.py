"""Anticipación mínima para reservar online y bloqueos que se repiten todas las semanas."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.main import app
from app.models import Negocio
from tests.test_agenda import complejo, entrar, turno  # noqa: F401


def libres_a_las(cliente: TestClient, slug: str, fecha, hora: str) -> int:
    dia = cliente.get(
        f"/publico/complejos/{slug}/disponibilidad",
        params={"deporte": "futbol7", "fecha": fecha.isoformat()},
    ).json()
    return next((len(t["libres"]) for t in dia["turnos"] if t["hora"] == hora), 0)


def reservar_online(cliente: TestClient, slug: str, inicio) -> int:
    datos = {"deporte": "futbol7", "inicio": inicio.isoformat(), "nombre": "Ana",
             "telefono": "1155550123"}  # fmt: skip
    return cliente.post(f"/publico/complejos/{slug}/reservas", json=datos).status_code


def test_anticipacion_minima(complejo, admin: Session, monkeypatch) -> None:  # noqa: F811
    monkeypatch.setattr(get_settings(), "pagos_simulados", True)
    slug, publico = complejo["slug"], TestClient(app)
    assert libres_a_las(publico, slug, complejo["fecha"], "21:00") == 2
    # Con 48 horas de anticipación, los turnos de mañana ya no se ofrecen ni se reservan online.
    admin.get(Negocio, complejo["negocio"].id).horas_anticipacion = 48
    admin.commit()
    assert libres_a_las(publico, slug, complejo["fecha"], "21:00") == 0
    assert reservar_online(publico, slug, complejo["a_las"](21)) == 409
    # El dueño igual carga a mano un turno de último momento.
    manual = {"recurso_id": str(complejo["canchas"][0]), "nombre": "Beto",
              "inicio": complejo["a_las"](21).isoformat(), "telefono": "1155550456"}  # fmt: skip
    assert entrar(complejo["dueno"]).post(f"/panel/{slug}/reservas", json=manual).status_code == 201


def test_bloqueo_fijo_todas_las_semanas(complejo, monkeypatch) -> None:  # noqa: F811
    monkeypatch.setattr(get_settings(), "pagos_simulados", True)
    slug, fecha, publico = complejo["slug"], complejo["fecha"], TestClient(app)
    dueno = entrar(complejo["dueno"])
    nuevo = {"dia_semana": fecha.weekday(), "desde": "21:00", "hasta": "22:00", "motivo": "Liga"}
    creado = dueno.post(f"/panel/{slug}/bloqueos-fijos", json=nuevo)
    assert creado.status_code == 201, creado.text
    assert creado.json()["reservas_existentes"] == 0

    # Ese día y el mismo día de la semana siguiente: bloqueado en todas las canchas.
    assert libres_a_las(publico, slug, fecha, "21:00") == 0
    assert libres_a_las(publico, slug, fecha + timedelta(days=7), "21:00") == 0
    # El día siguiente y otro horario del mismo día: libres.
    assert libres_a_las(publico, slug, fecha + timedelta(days=1), "21:00") == 2
    assert libres_a_las(publico, slug, fecha, "20:00") == 2
    assert reservar_online(publico, slug, complejo["a_las"](21)) == 409

    # En la agenda se ve como bloqueado, con el motivo.
    agenda = dueno.get(f"/panel/{slug}/agenda", params={"fecha": fecha.isoformat()}).json()
    reserva = turno(agenda, complejo["canchas"][0], "21:00")["reserva"]
    assert (reserva["estado"], reserva["motivo_bloqueo"], reserva["fijo"]) == (
        "bloqueada",
        "Liga",
        True,
    )

    # Al borrarlo se libera.
    lista = dueno.get(f"/panel/{slug}/bloqueos-fijos").json()
    assert [b["motivo"] for b in lista] == ["Liga"]
    assert dueno.delete(f"/panel/{slug}/bloqueos-fijos/{lista[0]['id']}").status_code == 204
    assert libres_a_las(publico, slug, fecha, "21:00") == 2
