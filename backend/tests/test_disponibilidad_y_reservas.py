"""Disponibilidad y el servicio de reservas contra la base (como app_user, con RLS)."""

import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.models import Cliente, Horario, Negocio, Reserva
from app.services.disponibilidad import disponibilidad, hoy_en_el_negocio
from app.services.reservas import DatosCliente, TurnoInvalido, TurnoNoDisponible, reservar

BA = ZoneInfo("America/Argentina/Buenos_Aires")


@pytest.fixture
def complejo(
    admin: Session,
    crear_negocio: Callable[..., uuid.UUID],
    crear_recurso: Callable[..., uuid.UUID],
) -> dict:
    """4 canchas de fútbol 7 (60 min, $85.000) y 1 de pádel (90 min, $36.000), todos los
    días de 18 a 24. Seña del 20%."""
    negocio_id = crear_negocio(sena_tipo="porcentaje", sena_valor=Decimal("20"))
    futbol = [crear_recurso(negocio_id, "futbol7", f"Cancha {i}") for i in range(1, 5)]
    padel = crear_recurso(negocio_id, "padel", "Pádel 1")
    for dia in range(7):
        for recurso_id in futbol:
            admin.add(Horario(negocio_id=negocio_id, recurso_id=recurso_id, dia_semana=dia,
                              desde=time(18), hasta=time(0), duracion_turno_min=60,
                              precio=Decimal("85000")))  # fmt: skip
        admin.add(Horario(negocio_id=negocio_id, recurso_id=padel, dia_semana=dia,
                          desde=time(18), hasta=time(0), duracion_turno_min=90,
                          precio=Decimal("36000")))  # fmt: skip
    admin.commit()
    negocio = admin.get(Negocio, negocio_id)
    manana = hoy_en_el_negocio(negocio) + timedelta(days=1)
    return {
        "negocio": negocio,
        "futbol": futbol,
        "padel": padel,
        "fecha": manana,
        "a_las_21": datetime.combine(manana, time(21), tzinfo=BA),
    }


def jugador(n: int = 0) -> DatosCliente:
    return DatosCliente(nombre=f"Jugador {n}", telefono=f"11 5555-{1000 + n}")


def turno_de_las(complejo: dict, deporte: str, hora: str):
    with sesion_de_negocio(complejo["negocio"].id) as s:
        turnos = disponibilidad(s, complejo["negocio"], deporte, complejo["fecha"])
    return next(t for t in turnos if t.inicio.astimezone(BA).strftime("%H:%M") == hora)


def test_cada_deporte_con_su_duracion_y_su_precio(complejo) -> None:
    futbol = turno_de_las(complejo, "futbol7", "21:00")
    padel = turno_de_las(complejo, "padel", "19:30")
    assert (futbol.fin - futbol.inicio, futbol.precio) == (timedelta(minutes=60), Decimal("85000"))
    assert (padel.fin - padel.inicio, padel.precio) == (timedelta(minutes=90), Decimal("36000"))
    assert futbol.libres[0].sena == Decimal("17000.00")
    assert padel.libres[0].sena == Decimal("7200.00")


def test_una_reserva_resta_una_cancha(complejo) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        reservar(s, complejo["negocio"], deporte_codigo="futbol7", inicio=complejo["a_las_21"],
                 cliente=jugador(), origen="panel")  # fmt: skip
        s.commit()
    turno = turno_de_las(complejo, "futbol7", "21:00")
    assert (turno.canchas_total, len(turno.libres)) == (4, 3)


def test_cuatro_reservas_en_cuatro_canchas_y_la_quinta_falla(complejo) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        canchas = {
            reservar(s, complejo["negocio"], deporte_codigo="futbol7",
                     inicio=complejo["a_las_21"], cliente=jugador(i), origen="panel").recurso_id
            for i in range(4)
        }  # fmt: skip
        s.commit()
        with pytest.raises(TurnoNoDisponible):
            reservar(s, complejo["negocio"], deporte_codigo="futbol7",
                     inicio=complejo["a_las_21"], cliente=jugador(5), origen="panel")  # fmt: skip
    assert canchas == set(complejo["futbol"])
    assert turno_de_las(complejo, "futbol7", "21:00").libres == []


def test_cinco_reservas_al_mismo_tiempo(complejo) -> None:
    """Llegan todas juntas, cada una en su propia conexión: 4 entran y 1 no."""

    def intentar(i: int) -> uuid.UUID | None:
        with sesion_de_negocio(complejo["negocio"].id) as s:
            try:
                reserva = reservar(s, complejo["negocio"], deporte_codigo="futbol7",
                                   inicio=complejo["a_las_21"], cliente=jugador(10 + i),
                                   origen="web")  # fmt: skip
                s.commit()
                return reserva.recurso_id
            except TurnoNoDisponible:
                return None

    with ThreadPoolExecutor(max_workers=5) as pool:
        resultados = list(pool.map(intentar, range(5)))

    canchas = [r for r in resultados if r is not None]
    assert len(canchas) == 4
    assert set(canchas) == set(complejo["futbol"])


def test_la_cancha_elegida_ocupada_no_se_cambia_por_otra(complejo) -> None:
    cancha = complejo["futbol"][2]
    with sesion_de_negocio(complejo["negocio"].id) as s:
        reservar(s, complejo["negocio"], deporte_codigo="futbol7", inicio=complejo["a_las_21"],
                 cliente=jugador(1), origen="panel", recurso_id=cancha)  # fmt: skip
        s.commit()
        with pytest.raises(TurnoNoDisponible):
            reservar(s, complejo["negocio"], deporte_codigo="futbol7",
                     inicio=complejo["a_las_21"], cliente=jugador(2), origen="panel",
                     recurso_id=cancha)  # fmt: skip


def test_un_horario_que_no_es_turno_no_se_puede_reservar(complejo) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s, pytest.raises(TurnoInvalido):
        reservar(s, complejo["negocio"], deporte_codigo="futbol7",
                 inicio=complejo["a_las_21"] + timedelta(minutes=15), cliente=jugador(),
                 origen="panel")  # fmt: skip


def test_el_precio_y_la_sena_los_pone_el_backend(complejo) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        reserva = reservar(s, complejo["negocio"], deporte_codigo="padel",
                           inicio=complejo["a_las_21"] - timedelta(minutes=90),
                           cliente=jugador(), origen="panel")  # fmt: skip
    assert (reserva.precio, reserva.sena) == (Decimal("36000"), Decimal("7200.00"))


def test_un_bloqueo_saca_la_cancha_de_la_disponibilidad(complejo) -> None:
    inicio = complejo["a_las_21"]
    with sesion_de_negocio(complejo["negocio"].id) as s:
        s.add(Reserva(negocio_id=complejo["negocio"].id, recurso_id=complejo["futbol"][0],
                      inicio=inicio, fin=inicio + timedelta(hours=1), estado="bloqueada",
                      motivo_bloqueo="Torneo", origen="panel"))  # fmt: skip
        s.commit()
    turno = turno_de_las(complejo, "futbol7", "21:00")
    assert complejo["futbol"][0] not in {c.recurso.id for c in turno.libres}


def test_una_pendiente_vencida_ya_no_ocupa(complejo) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        reservar(s, complejo["negocio"], deporte_codigo="padel",
                 inicio=complejo["a_las_21"] - timedelta(minutes=90), cliente=jugador(),
                 origen="web", estado="pendiente_pago",
                 vence_a=datetime.now(UTC) - timedelta(minutes=1))  # fmt: skip
        s.commit()
    assert len(turno_de_las(complejo, "padel", "19:30").libres) == 1

    # Y al reservar de nuevo, la vencida se marca como tal y el turno se puede tomar.
    with sesion_de_negocio(complejo["negocio"].id) as s:
        reservar(s, complejo["negocio"], deporte_codigo="padel",
                 inicio=complejo["a_las_21"] - timedelta(minutes=90), cliente=jugador(2),
                 origen="web")  # fmt: skip
        s.commit()
        estados = sorted(s.scalars(select(Reserva.estado)))
    assert estados == ["confirmada", "vencida"]


def test_filtra_por_negocio_aunque_no_haya_rls(
    complejo, admin: Session, crear_negocio: Callable[..., uuid.UUID],
    crear_recurso: Callable[..., uuid.UUID],
) -> None:  # fmt: skip
    """Las consultas filtran por negocio_id por sí mismas; RLS es la segunda barrera.
    Con la conexión de administrador (sin RLS) no aparecen canchas de otro complejo."""
    otro = crear_negocio()
    ajena = crear_recurso(otro, "futbol7", "Cancha ajena")
    for dia in range(7):
        admin.add(Horario(negocio_id=otro, recurso_id=ajena, dia_semana=dia, desde=time(18),
                          hasta=time(0), duracion_turno_min=60, precio=Decimal("1")))  # fmt: skip
    admin.commit()

    turnos = disponibilidad(admin, complejo["negocio"], "futbol7", complejo["fecha"])
    canchas = {c.recurso.id for t in turnos for c in t.libres}
    assert canchas == set(complejo["futbol"])


def test_el_mismo_telefono_es_el_mismo_jugador(complejo) -> None:
    with sesion_de_negocio(complejo["negocio"].id) as s:
        for hora in (19, 20):
            reservar(s, complejo["negocio"], deporte_codigo="futbol7",
                     inicio=datetime.combine(complejo["fecha"], time(hora), tzinfo=BA),
                     cliente=DatosCliente("Juan", "(011) 5555-1234"), origen="panel")  # fmt: skip
        s.commit()
        assert s.scalar(select(func.count()).select_from(Cliente)) == 1
