"""Un complejo nunca puede ver ni tocar datos de otro, aunque el código se equivoque (RLS)."""

import uuid
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import Session

from app.db import get_session, sesion_de_negocio
from app.models import Deporte, Negocio, Recurso, Reserva

INSUFFICIENT_PRIVILEGE = "42501"


@pytest.fixture
def dos_negocios(
    crear_negocio: Callable[..., uuid.UUID], crear_recurso: Callable[..., uuid.UUID]
) -> dict[str, uuid.UUID]:
    a, b = crear_negocio(), crear_negocio()
    return {"a": a, "b": b, "recurso_a": crear_recurso(a), "recurso_b": crear_recurso(b)}


@pytest.fixture
def sesion_publica() -> Iterator[Session]:
    yield from get_session()


def test_solo_ve_sus_canchas(dos_negocios) -> None:
    with sesion_de_negocio(dos_negocios["a"]) as s:
        ids = set(s.scalars(select(Recurso.id)))
    assert ids == {dos_negocios["recurso_a"]}


def test_no_puede_crear_filas_en_otro_negocio(dos_negocios) -> None:
    with sesion_de_negocio(dos_negocios["a"]) as s:
        deporte_id = s.scalar(select(Deporte.id).where(Deporte.codigo == "padel"))
        s.add(Recurso(negocio_id=dos_negocios["b"], deporte_id=deporte_id, nombre="Intrusa"))
        with pytest.raises(ProgrammingError) as error:
            s.flush()
    assert error.value.orig.sqlstate == INSUFFICIENT_PRIVILEGE


def test_no_puede_modificar_filas_de_otro_negocio(dos_negocios) -> None:
    with sesion_de_negocio(dos_negocios["a"]) as s:
        resultado = s.execute(
            update(Recurso).where(Recurso.id == dos_negocios["recurso_b"]).values(nombre="Tomada")
        )
        s.commit()
    assert resultado.rowcount == 0


def test_sin_negocio_no_ve_datos_de_ningun_negocio(dos_negocios, sesion_publica) -> None:
    assert sesion_publica.scalar(select(func.count()).select_from(Recurso)) == 0


def test_los_negocios_se_leen_libremente(dos_negocios, sesion_publica) -> None:
    ids = set(sesion_publica.scalars(select(Negocio.id)))
    assert {dos_negocios["a"], dos_negocios["b"]} <= ids


def test_solo_modifica_su_propio_negocio(dos_negocios) -> None:
    with sesion_de_negocio(dos_negocios["a"]) as s:
        propio = s.execute(
            update(Negocio).where(Negocio.id == dos_negocios["a"]).values(barrio="Palermo")
        )
        ajeno = s.execute(
            update(Negocio).where(Negocio.id == dos_negocios["b"]).values(barrio="Palermo")
        )
        s.commit()
    assert (propio.rowcount, ajeno.rowcount) == (1, 0)


@pytest.mark.parametrize("campo", ["slug", "estado_cuenta", "activo"])
def test_no_puede_tocar_campos_del_alta(dos_negocios, campo: str) -> None:
    valores = {"slug": "otro-slug", "estado_cuenta": "al_dia", "activo": True}
    with sesion_de_negocio(dos_negocios["a"]) as s, pytest.raises(ProgrammingError) as error:
        s.execute(
            update(Negocio).where(Negocio.id == dos_negocios["a"]).values({campo: valores[campo]})
        )
    assert error.value.orig.sqlstate == INSUFFICIENT_PRIVILEGE


def test_no_puede_crear_negocios(dos_negocios) -> None:
    with sesion_de_negocio(dos_negocios["a"]) as s, pytest.raises(ProgrammingError):
        s.add(Negocio(slug="colado", nombre="Colado", horas_cancelacion=24))
        s.flush()


def test_sigue_aislado_despues_de_un_commit(dos_negocios) -> None:
    """after_begin vuelve a fijar el negocio en cada transacción nueva."""
    with sesion_de_negocio(dos_negocios["a"]) as s:
        s.scalars(select(Recurso.id)).all()
        s.commit()
        ids = set(s.scalars(select(Recurso.id)))
    assert ids == {dos_negocios["recurso_a"]}


def test_una_conexion_reutilizada_no_falla(dos_negocios) -> None:
    """Después de set_config(..., true), la conexión devuelve '' y no NULL: el NULLIF
    de las políticas evita el error ''::uuid al reutilizarla sin negocio."""
    for _ in range(3):
        with sesion_de_negocio(dos_negocios["a"]) as s:
            s.scalars(select(Recurso.id)).all()
        for s in get_session():
            assert s.scalar(select(func.count()).select_from(Recurso)) == 0


def test_una_reserva_no_puede_apuntar_a_una_cancha_de_otro_negocio(
    dos_negocios, admin: Session, crear_cliente: Callable[..., uuid.UUID]
) -> None:
    """Clave compuesta (negocio_id, recurso_id): ni la conexión de admin puede mezclarlos."""
    inicio = datetime(2026, 10, 3, 0, 0, tzinfo=UTC)
    admin.add(
        Reserva(
            negocio_id=dos_negocios["a"],
            recurso_id=dos_negocios["recurso_b"],
            cliente_id=crear_cliente(dos_negocios["a"]),
            inicio=inicio,
            fin=inicio + timedelta(hours=1),
            estado="confirmada",
            origen="panel",
        )
    )
    with pytest.raises(IntegrityError):
        admin.flush()
    admin.rollback()
