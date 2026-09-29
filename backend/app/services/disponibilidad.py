"""Qué turnos quedan libres en un negocio, por deporte y día."""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import ESTADOS_QUE_OCUPAN, Deporte, Horario, Negocio, Recurso, Reserva
from app.services.sena import calcular_sena
from app.services.turnos import Turno, se_superponen, turnos_del_dia


@dataclass
class CanchaLibre:
    recurso: Recurso
    precio: Decimal
    sena: Decimal


@dataclass
class TurnoDisponible:
    inicio: datetime
    fin: datetime
    canchas_total: int
    libres: list[CanchaLibre] = field(default_factory=list)

    @property
    def precio(self) -> Decimal | None:
        """El más barato de las canchas libres (casi siempre todas cuestan lo mismo)."""
        return min((c.precio for c in self.libres), default=None)


def ahora() -> datetime:
    return datetime.now(UTC)


def zona_del_negocio(negocio: Negocio) -> ZoneInfo:
    return ZoneInfo(negocio.zona_horaria)


def hoy_en_el_negocio(negocio: Negocio) -> date:
    return ahora().astimezone(zona_del_negocio(negocio)).date()


def canchas_del_deporte(
    session: Session, negocio_id: uuid.UUID, deporte_codigo: str
) -> list[Recurso]:
    """Canchas activas de un deporte del negocio."""
    return list(
        session.scalars(
            select(Recurso)
            .join(Deporte, Deporte.id == Recurso.deporte_id)
            .where(
                Recurso.negocio_id == negocio_id, Deporte.codigo == deporte_codigo, Recurso.activo
            )
            .order_by(Recurso.orden, Recurso.nombre)
        )
    )


def reservas_que_ocupan(
    session: Session,
    negocio_id: uuid.UUID,
    recurso_ids: list[uuid.UUID],
    desde: datetime,
    hasta: datetime,
) -> list[Reserva]:
    """Reservas activas que tocan el intervalo. Una pendiente de pago con vence_a pasado
    ya no ocupa, aunque el job todavía no la haya marcado como vencida."""
    return list(
        session.scalars(
            select(Reserva).where(
                Reserva.negocio_id == negocio_id,
                Reserva.recurso_id.in_(recurso_ids),
                Reserva.estado.in_(ESTADOS_QUE_OCUPAN),
                or_(
                    Reserva.estado != "pendiente_pago",
                    Reserva.vence_a.is_(None),
                    Reserva.vence_a > ahora(),
                ),
                and_(Reserva.inicio < hasta, Reserva.fin > desde),
            )
        )
    )


def turnos_de_canchas(
    session: Session, negocio: Negocio, canchas: list[Recurso], fecha: date
) -> list[Turno]:
    if not canchas:
        return []
    franjas = session.scalars(
        select(Horario).where(
            Horario.negocio_id == negocio.id,
            Horario.recurso_id.in_([c.id for c in canchas]),
            Horario.dia_semana == fecha.weekday(),
        )
    )
    return sorted(
        turnos_del_dia(franjas, fecha, zona_del_negocio(negocio)),
        key=lambda t: (t.inicio, t.fin),
    )


def disponibilidad(
    session: Session, negocio: Negocio, deporte_codigo: str, fecha: date
) -> list[TurnoDisponible]:
    """Turnos del día para un deporte, agrupando las canchas que tienen el mismo horario.
    Incluye los completos (sin canchas libres) y omite los que ya empezaron."""
    canchas = canchas_del_deporte(session, negocio.id, deporte_codigo)
    turnos = turnos_de_canchas(session, negocio, canchas, fecha)
    if not turnos:
        return []

    por_id = {c.id: c for c in canchas}
    reservas = reservas_que_ocupan(
        session, negocio.id, list(por_id), turnos[0].inicio, max(t.fin for t in turnos)
    )
    ocupacion: dict[uuid.UUID, list[Reserva]] = defaultdict(list)
    for reserva in reservas:
        ocupacion[reserva.recurso_id].append(reserva)

    momento = ahora()
    agrupados: dict[tuple[datetime, datetime], TurnoDisponible] = {}
    for turno in turnos:
        if turno.inicio <= momento:
            continue
        grupo = agrupados.setdefault(
            (turno.inicio, turno.fin), TurnoDisponible(turno.inicio, turno.fin, 0)
        )
        grupo.canchas_total += 1
        ocupada = any(
            se_superponen(turno.inicio, turno.fin, r.inicio, r.fin)
            for r in ocupacion[turno.recurso_id]
        )
        if not ocupada:
            grupo.libres.append(
                CanchaLibre(
                    por_id[turno.recurso_id], turno.precio, calcular_sena(negocio, turno.precio)
                )
            )

    orden = {c.id: i for i, c in enumerate(canchas)}
    for grupo in agrupados.values():
        grupo.libres.sort(key=lambda c: orden[c.recurso.id])
    return list(agrupados.values())


def proximo_turno_libre(
    session: Session, negocio: Negocio, deportes: list[str], dias: int = 7
) -> TurnoDisponible | None:
    """El primer turno con alguna cancha libre, mirando hasta `dias` días para adelante."""
    hoy = hoy_en_el_negocio(negocio)
    for i in range(dias):
        fecha = hoy + timedelta(days=i)
        candidatos = [
            t
            for codigo in deportes
            for t in disponibilidad(session, negocio, codigo, fecha)
            if t.libres
        ]
        if candidatos:
            return min(candidatos, key=lambda t: t.inicio)
    return None
