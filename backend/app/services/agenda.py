"""La agenda del panel: cada cancha con sus turnos del día y en qué estado está cada uno."""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Cliente, Deporte, Negocio, Recurso, Reserva
from app.services.disponibilidad import ahora, reservas_que_ocupan, turnos_de_canchas
from app.services.turnos import Turno, se_superponen

CERO = Decimal("0.00")


@dataclass
class TurnoDeAgenda:
    turno: Turno
    reserva: Reserva | None
    cliente: Cliente | None


@dataclass
class CanchaDeAgenda:
    recurso: Recurso
    deporte: Deporte
    turnos: list[TurnoDeAgenda] = field(default_factory=list)


@dataclass
class ResumenDelDia:
    ocupados: int = 0
    libres: int = 0
    bloqueados: int = 0
    senas_cobradas: Decimal = CERO
    saldo_por_cobrar: Decimal = CERO


def saldo_efectivo(reserva: Reserva) -> Decimal | None:
    """Lo que falta si el saldo se paga en efectivo (None si no hay precio en efectivo)."""
    if reserva.precio_efectivo is None:
        return None
    return max(CERO, reserva.precio_efectivo - reserva.sena)


def saldo(reserva: Reserva) -> Decimal:
    # Si el turno quedó más barato que la seña (un cambio de horario), no queda nada por cobrar.
    return max(CERO, (reserva.precio or CERO) - reserva.sena)


def agenda_del_dia(session: Session, negocio: Negocio, fecha: date) -> list[CanchaDeAgenda]:
    filas = session.execute(
        select(Recurso, Deporte)
        .join(Deporte, Deporte.id == Recurso.deporte_id)
        .where(Recurso.negocio_id == negocio.id, Recurso.activo)
        .order_by(Recurso.orden, Recurso.nombre)
    ).all()
    canchas = [CanchaDeAgenda(recurso, deporte) for recurso, deporte in filas]
    por_id = {c.recurso.id: c for c in canchas}

    turnos = turnos_de_canchas(session, negocio, [c.recurso for c in canchas], fecha)
    if not turnos:
        return canchas

    reservas = reservas_que_ocupan(
        session, negocio.id, list(por_id), turnos[0].inicio, max(t.fin for t in turnos)
    )
    ids_clientes = {r.cliente_id for r in reservas if r.cliente_id}
    clientes = (
        {c.id: c for c in session.scalars(select(Cliente).where(Cliente.id.in_(ids_clientes)))}
        if ids_clientes
        else {}
    )
    ocupacion: dict[uuid.UUID, list[Reserva]] = defaultdict(list)
    for reserva in reservas:
        ocupacion[reserva.recurso_id].append(reserva)

    for turno in turnos:
        reserva = next(
            (
                r
                for r in ocupacion[turno.recurso_id]
                if se_superponen(turno.inicio, turno.fin, r.inicio, r.fin)
            ),
            None,
        )
        por_id[turno.recurso_id].turnos.append(
            TurnoDeAgenda(turno, reserva, clientes.get(reserva.cliente_id) if reserva else None)
        )
    return canchas


def resumen(canchas: list[CanchaDeAgenda]) -> ResumenDelDia:
    total = ResumenDelDia()
    contadas: set[uuid.UUID] = set()
    for cancha in canchas:
        for t in cancha.turnos:
            if t.reserva is None:
                total.libres += 1
                continue
            if t.reserva.estado == "bloqueada":
                total.bloqueados += 1
            else:
                total.ocupados += 1
            if t.reserva.id in contadas:
                continue
            contadas.add(t.reserva.id)
            if t.reserva.estado == "confirmada":
                total.senas_cobradas += t.reserva.sena
                if not t.reserva.saldo_cobrado:
                    total.saldo_por_cobrar += saldo(t.reserva)
    return total


def minutos_para_pagar(reserva: Reserva) -> int | None:
    if reserva.estado != "pendiente_pago" or reserva.vence_a is None:
        return None
    return max(0, int((reserva.vence_a - ahora()).total_seconds() // 60))
