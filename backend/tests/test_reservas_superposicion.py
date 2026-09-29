"""La regla de que dos reservas no se pisan vive en la base (EXCLUDE en la migración 0002)."""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.models import Reserva

EXCLUSION_VIOLATION = "23P01"
LAS_21 = datetime(2026, 10, 3, 0, 0, tzinfo=UTC)  # sábado 21:00 en Buenos Aires


@pytest.fixture
def cancha(
    crear_negocio: Callable[..., uuid.UUID],
    crear_recurso: Callable[..., uuid.UUID],
    crear_cliente: Callable[..., uuid.UUID],
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]:
    negocio_id = crear_negocio()
    return (
        negocio_id,
        crear_recurso(negocio_id),
        crear_recurso(negocio_id),
        crear_cliente(negocio_id),
    )


def reservar(
    session: Session,
    negocio_id: uuid.UUID,
    recurso_id: uuid.UUID,
    cliente_id: uuid.UUID | None,
    inicio: datetime,
    minutos: int,
    estado: str = "confirmada",
) -> Reserva:
    reserva = Reserva(
        negocio_id=negocio_id,
        recurso_id=recurso_id,
        cliente_id=None if estado == "bloqueada" else cliente_id,
        inicio=inicio,
        fin=inicio + timedelta(minutes=minutos),
        estado=estado,
        origen="panel",
    )
    session.add(reserva)
    session.flush()
    return reserva


def test_dos_reservas_superpuestas_en_la_misma_cancha_fallan(cancha) -> None:
    negocio_id, recurso_id, _, cliente_id = cancha
    with sesion_de_negocio(negocio_id) as s:
        reservar(s, negocio_id, recurso_id, cliente_id, LAS_21, 60)
        with pytest.raises(IntegrityError) as error:
            reservar(s, negocio_id, recurso_id, cliente_id, LAS_21 + timedelta(minutes=30), 60)
    assert error.value.orig.sqlstate == EXCLUSION_VIOLATION


def test_se_pisan_aunque_duren_distinto(cancha) -> None:
    """Un turno de pádel de 90 minutos contra uno de 60 que empieza en el medio."""
    negocio_id, recurso_id, _, cliente_id = cancha
    with sesion_de_negocio(negocio_id) as s:
        reservar(s, negocio_id, recurso_id, cliente_id, LAS_21, 90)
        with pytest.raises(IntegrityError):
            reservar(s, negocio_id, recurso_id, cliente_id, LAS_21 + timedelta(minutes=60), 60)


def test_turnos_seguidos_no_se_pisan(cancha) -> None:
    """21:00 a 22:00 y 22:00 a 23:00: el intervalo es [inicio, fin)."""
    negocio_id, recurso_id, _, cliente_id = cancha
    with sesion_de_negocio(negocio_id) as s:
        reservar(s, negocio_id, recurso_id, cliente_id, LAS_21, 60)
        reservar(s, negocio_id, recurso_id, cliente_id, LAS_21 + timedelta(minutes=60), 60)
        s.commit()


def test_a_la_misma_hora_en_otra_cancha_se_puede(cancha) -> None:
    negocio_id, recurso_id, otro_recurso_id, cliente_id = cancha
    with sesion_de_negocio(negocio_id) as s:
        reservar(s, negocio_id, recurso_id, cliente_id, LAS_21, 60)
        reservar(s, negocio_id, otro_recurso_id, cliente_id, LAS_21, 60)
        s.commit()


def test_un_bloqueo_ocupa_el_turno(cancha) -> None:
    negocio_id, recurso_id, _, cliente_id = cancha
    with sesion_de_negocio(negocio_id) as s:
        reservar(s, negocio_id, recurso_id, None, LAS_21, 60, estado="bloqueada")
        with pytest.raises(IntegrityError):
            reservar(s, negocio_id, recurso_id, cliente_id, LAS_21, 60)


@pytest.mark.parametrize("estado_final", ["cancelada", "vencida"])
def test_una_reserva_cancelada_o_vencida_libera_el_turno(cancha, estado_final: str) -> None:
    negocio_id, recurso_id, _, cliente_id = cancha
    with sesion_de_negocio(negocio_id) as s:
        anterior = reservar(s, negocio_id, recurso_id, cliente_id, LAS_21, 60)
        anterior.estado = estado_final
        s.flush()
        reservar(s, negocio_id, recurso_id, cliente_id, LAS_21, 60)
        s.commit()


def test_una_reserva_sin_jugador_no_es_valida(cancha) -> None:
    negocio_id, recurso_id, _, _ = cancha
    with sesion_de_negocio(negocio_id) as s, pytest.raises(IntegrityError):
        s.add(
            Reserva(
                negocio_id=negocio_id,
                recurso_id=recurso_id,
                cliente_id=None,
                inicio=LAS_21,
                fin=LAS_21 + timedelta(hours=1),
                estado="confirmada",
                origen="panel",
            )
        )
        s.flush()
