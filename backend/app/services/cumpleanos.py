"""Cumpleaños: una cancha por un tiempo fijo, a precio cerrado.

Un cumpleaños empieza donde empieza un turno de la cancha y necesita turnos seguidos y
libres hasta cubrir su duración (uno de 2 horas, en una cancha de turnos de 1 hora, ocupa
dos turnos). La regla de superposición de la base hace el resto, igual que con un turno.
"""

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Cumpleanos, Negocio, Recurso, Reserva
from app.services.disponibilidad import (
    CanchaLibre,
    TurnoDisponible,
    ahora,
    reservas_que_ocupan,
    turnos_de_canchas,
    zona_del_negocio,
)
from app.services.turnos import Turno, se_superponen


def ofrecidos(session: Session, negocio_id: uuid.UUID) -> list[Cumpleanos]:
    """Los activos, en el orden que eligió el complejo."""
    return list(
        session.scalars(
            select(Cumpleanos)
            .where(Cumpleanos.negocio_id == negocio_id, Cumpleanos.activo)
            .order_by(Cumpleanos.orden, Cumpleanos.nombre)
        )
    )


def fin_del_cumpleanos(turnos: list[Turno], inicio: datetime, duracion_min: int) -> datetime | None:
    """Hasta cuándo dura un cumpleaños que empieza en `inicio`, si los turnos de la cancha
    (ordenados) lo cubren sin cortes. None si `inicio` no es un turno o no alcanza."""
    fin = inicio + timedelta(minutes=duracion_min)
    hasta = inicio
    for turno in turnos:
        if turno.inicio < hasta:
            continue
        if turno.inicio > hasta:
            break  # hay un hueco (la franja se corta antes)
        if hasta == inicio and turno.inicio != inicio:
            return None
        hasta = turno.fin
        if hasta >= fin:
            return fin
    return None


def turnos_alrededor(
    session: Session, negocio: Negocio, cancha: Recurso, inicio: datetime
) -> list[Turno]:
    """Los turnos de la cancha del día de `inicio` y del anterior (por las franjas que pasan
    la medianoche), ordenados."""
    fecha = inicio.astimezone(zona_del_negocio(negocio)).date()
    turnos = turnos_de_canchas(session, negocio, [cancha], fecha - timedelta(days=1))
    turnos += turnos_de_canchas(session, negocio, [cancha], fecha)
    return sorted(turnos, key=lambda t: t.inicio)


def disponibilidad_cumpleanos(
    session: Session, negocio: Negocio, cumpleanos: Cumpleanos, canchas: list[Recurso], fecha: date
) -> list[TurnoDisponible]:
    """Los horarios en que puede empezar el cumpleaños ese día, con las canchas libres."""
    turnos = turnos_de_canchas(session, negocio, canchas, fecha)
    if not turnos:
        return []
    # El día siguiente también, por si el cumpleaños sigue en una franja que pasa la medianoche.
    siguientes = turnos_de_canchas(session, negocio, canchas, fecha + timedelta(days=1))
    por_cancha: dict[uuid.UUID, list[Turno]] = defaultdict(list)
    for turno in sorted(turnos + siguientes, key=lambda t: t.inicio):
        por_cancha[turno.recurso_id].append(turno)

    duracion = timedelta(minutes=cumpleanos.duracion_min)
    desde, hasta = turnos[0].inicio, max(t.fin for t in turnos) + duracion
    ocupacion: dict[uuid.UUID, list[Reserva]] = defaultdict(list)
    for reserva in reservas_que_ocupan(session, negocio.id, [c.id for c in canchas], desde, hasta):
        ocupacion[reserva.recurso_id].append(reserva)

    from app.services.bloqueos_fijos import bloqueo_en, ocurrencias

    fijos = ocurrencias(session, negocio, [c.id for c in canchas], desde, hasta)
    primero = ahora() + timedelta(hours=negocio.horas_anticipacion or 0)
    # Por ahora los cumpleaños no llevan seña: el precio entero se paga en la cancha.
    sena = Decimal("0.00")
    agrupados: dict[tuple[datetime, datetime], TurnoDisponible] = {}
    for cancha in canchas:
        for turno in (t for t in turnos if t.recurso_id == cancha.id):
            if turno.inicio <= primero:
                continue
            fin = fin_del_cumpleanos(por_cancha[cancha.id], turno.inicio, cumpleanos.duracion_min)
            if fin is None:
                continue
            grupo = agrupados.setdefault((turno.inicio, fin), TurnoDisponible(turno.inicio, fin, 0))
            grupo.canchas_total += 1
            ocupada = (
                any(se_superponen(turno.inicio, fin, r.inicio, r.fin) for r in ocupacion[cancha.id])
                or bloqueo_en(fijos, cancha.id, turno.inicio, fin) is not None
            )
            if not ocupada:
                grupo.libres.append(CanchaLibre(cancha, cumpleanos.precio, sena))
    return sorted(agrupados.values(), key=lambda t: t.inicio)
