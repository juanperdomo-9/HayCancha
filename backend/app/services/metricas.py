"""Métricas del mes de un complejo (Plan Pro): reservas, facturación, ocupación y cuánto
trajo HayCancha. Todo sale de las reservas confirmadas (sin bloqueos ni espejos)."""

import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Horario, Negocio, Pago, Recurso, Reserva
from app.services.disponibilidad import zona_del_negocio

CERO = Decimal("0.00")


@dataclass
class Numeros:
    reservas: int = 0
    facturacion: Decimal = CERO
    senas_online: Decimal = CERO
    ocupacion: int = 0  # porcentaje
    sin_intervencion: int = 0
    a_mano: int = 0
    de_haycancha: int = 0
    facturacion_haycancha: Decimal = CERO
    faltas: int = 0


@dataclass
class Metricas:
    mes: str
    actual: Numeros
    anterior: Numeros
    # Lunes a domingo: porcentaje de ocupación de cada día de la semana.
    ocupacion_por_dia: list[int] = field(default_factory=list)
    # Los horarios más pedidos: [("21:00", 14), ...].
    horarios_top: list[tuple[str, int]] = field(default_factory=list)


def _minutos(desde: time, hasta: time) -> int:
    a, b = desde.hour * 60 + desde.minute, hasta.hour * 60 + hasta.minute
    return b - a if b > a else 24 * 60 - a + b


def _turnos_ofrecidos(
    session: Session, negocio_id: uuid.UUID, inicio: date, fin: date
) -> list[int]:
    """Cuántos turnos ofrece el complejo en el período, por día de la semana."""
    franjas = session.execute(
        select(Horario.dia_semana, Horario.desde, Horario.hasta, Horario.duracion_turno_min)
        .join(Recurso, Recurso.id == Horario.recurso_id)
        .where(Horario.negocio_id == negocio_id, Recurso.activo)
    ).all()
    por_dia_semana = [0] * 7
    for dia, desde, hasta, duracion in franjas:
        por_dia_semana[dia] += _minutos(desde, hasta) // duracion
    ofrecidos = [0] * 7
    dia = inicio
    while dia < fin:
        ofrecidos[dia.weekday()] += por_dia_semana[dia.weekday()]
        dia += timedelta(days=1)
    return ofrecidos


def _numeros(
    session: Session, negocio: Negocio, inicio: date, fin: date
) -> tuple[Numeros, list, Counter]:
    zona = zona_del_negocio(negocio)
    desde = datetime.combine(inicio, time(), zona)
    hasta = datetime.combine(fin, time(), zona)
    reservas = session.scalars(
        select(Reserva).where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado == "confirmada",
            Reserva.cliente_id.is_not(None),
            Reserva.inicio >= desde,
            Reserva.inicio < hasta,
        )
    ).all()
    n = Numeros(reservas=len(reservas))
    ocupados = [0] * 7
    horas: Counter = Counter()
    for r in reservas:
        precio = r.precio or CERO
        if r.saldo_cobrado and r.saldo_en_efectivo and r.precio_efectivo is not None:
            precio = r.precio_efectivo
        n.facturacion += precio
        if r.origen == "panel":
            n.a_mano += 1
        else:
            n.sin_intervencion += 1
        if r.llegada == "haycancha":
            n.de_haycancha += 1
            n.facturacion_haycancha += precio
        if r.asistencia == "no_vino":
            n.faltas += 1
        local = r.inicio.astimezone(zona)
        ocupados[local.weekday()] += 1
        horas[local.strftime("%H:%M")] += 1
    ids = [r.id for r in reservas]
    if ids:
        for monto in session.scalars(
            select(Pago.monto).where(
                Pago.negocio_id == negocio.id,
                Pago.reserva_id.in_(ids),
                Pago.estado == "approved",
                Pago.devolucion.is_(None),
            )
        ):
            n.senas_online += monto
    ofrecidos = _turnos_ofrecidos(session, negocio.id, inicio, fin)
    total = sum(ofrecidos)
    n.ocupacion = min(100, round(100 * n.reservas / total)) if total else 0
    por_dia = [
        min(100, round(100 * o / t)) if t else 0 for o, t in zip(ocupados, ofrecidos, strict=True)
    ]
    return n, por_dia, horas


def _mes(anio: int, mes: int) -> tuple[date, date]:
    inicio = date(anio, mes, 1)
    fin = date(anio + (mes == 12), mes % 12 + 1, 1)
    return inicio, fin


def metricas_del_mes(session: Session, negocio: Negocio, anio: int, mes: int) -> Metricas:
    inicio, fin = _mes(anio, mes)
    actual, por_dia, horas = _numeros(session, negocio, inicio, fin)
    anterior, _, _ = _numeros(session, negocio, *_mes(anio - (mes == 1), (mes - 2) % 12 + 1))
    return Metricas(
        mes=f"{anio}-{mes:02d}",
        actual=actual,
        anterior=anterior,
        ocupacion_por_dia=por_dia,
        horarios_top=horas.most_common(6),
    )
