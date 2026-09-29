from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.ejemplo import SLUG_EJEMPLO, cargar_ejemplo
from app.main import app
from app.models import Negocio
from app.services.disponibilidad import hoy_en_el_negocio


@pytest.fixture
def cliente(admin: Session) -> TestClient:
    cargar_ejemplo(admin, reemplazar=True)
    admin.commit()
    return TestClient(app)


def test_la_pagina_principal_lista_los_complejos(cliente: TestClient) -> None:
    complejos = {c["slug"]: c for c in cliente.get("/publico/complejos").json()}
    potrero = complejos[SLUG_EJEMPLO]
    assert [d["codigo"] for d in potrero["deportes"]] == ["futbol7", "futbol5", "padel"]
    assert potrero["proximo_turno"] is not None
    assert "mp_access_token_enc" not in potrero


def test_filtro_por_deporte(cliente: TestClient) -> None:
    slugs = {c["slug"] for c in cliente.get("/publico/complejos?deporte=tenis").json()}
    assert SLUG_EJEMPLO not in slugs


def test_un_complejo_suspendido_no_aparece(cliente: TestClient, admin: Session) -> None:
    admin.execute(
        update(Negocio).where(Negocio.slug == SLUG_EJEMPLO).values(estado_cuenta="suspendido")
    )
    admin.commit()
    slugs = {c["slug"] for c in cliente.get("/publico/complejos").json()}
    assert SLUG_EJEMPLO not in slugs
    assert cliente.get(f"/publico/complejos/{SLUG_EJEMPLO}").status_code == 404


def test_detalle_del_complejo(cliente: TestClient) -> None:
    detalle = cliente.get(f"/publico/complejos/{SLUG_EJEMPLO}").json()
    futbol7 = detalle["deportes"][0]
    assert (futbol7["duraciones_min"], futbol7["precio_desde"]) == ([60], "70000.00")
    assert len(futbol7["canchas"]) == 4
    assert detalle["horas_cancelacion"] == 24


def test_un_slug_que_no_existe_da_404(cliente: TestClient) -> None:
    assert cliente.get("/publico/complejos/no-existe").status_code == 404


def test_disponibilidad_de_manana(cliente: TestClient, admin: Session) -> None:
    negocio = admin.query(Negocio).filter_by(slug=SLUG_EJEMPLO).one()
    manana = hoy_en_el_negocio(negocio) + timedelta(days=1)
    respuesta = cliente.get(
        f"/publico/complejos/{SLUG_EJEMPLO}/disponibilidad",
        params={"deporte": "futbol7", "fecha": manana.isoformat()},
    ).json()
    turnos = respuesta["turnos"]
    assert [t["hora"] for t in turnos][:2] == ["09:00", "10:00"]
    assert turnos[-1]["hora_fin"] == "00:00"
    a_las_21 = next(t for t in turnos if t["hora"] == "21:00")
    assert (a_las_21["precio"], a_las_21["canchas_total"]) == ("85000.00", 4)
    assert a_las_21["libres"][0]["sena"] == "17000.00"


@pytest.mark.parametrize("dias", [-1, 30])
def test_no_se_puede_pedir_fuera_de_rango(cliente: TestClient, admin: Session, dias: int) -> None:
    negocio = admin.query(Negocio).filter_by(slug=SLUG_EJEMPLO).one()
    fecha = hoy_en_el_negocio(negocio) + timedelta(days=dias)
    respuesta = cliente.get(
        f"/publico/complejos/{SLUG_EJEMPLO}/disponibilidad",
        params={"deporte": "futbol7", "fecha": fecha.isoformat()},
    )
    assert respuesta.status_code == 400
