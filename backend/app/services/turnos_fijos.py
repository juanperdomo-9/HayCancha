"""Turnos fijos de juego: un cliente que juega todas las semanas en la misma cancha y hora.

Se guardan como reservas confirmadas de verdad para las próximas semanas (DIAS_ADELANTE),
así se manejan igual que cualquier otra (seña en efectivo, si vino, saldo) y suman a las
métricas. Liberar un día es cancelar esa reserva; dar de baja el turno fijo cancela las
que vienen. La tarea periódica va creando las semanas siguientes.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Cliente, Deporte, Negocio, Recurso, Reserva, TurnoFijo
from app.services.disponibilidad import ahora, hoy_en_el_negocio, zona_del_negocio
from app.services.reservas import (
    DatosCliente,
    TurnoInvalido,
    TurnoNoDisponible,
    reservar,
    turno_de_la_cancha,
)

DIAS_ADELANTE = 30


@dataclass
class Generadas:
    creadas: int = 0
    # Fechas que no se pudieron reservar (ya estaban ocupadas o bloqueadas).
    omitidas: list[datetime] = field(default_factory=list)


def inicio_en(
    session: Session, negocio: Negocio, cancha: Recurso, dia: date, hora
) -> datetime | None:
    """El inicio del turno de ese día a esa hora. Si la franja pasa la medianoche, el turno
    de "el viernes a la 1" empieza el sábado a la 1."""
    zona = zona_del_negocio(negocio)
    # De madrugada, primero el turno de la franja de ese día que sigue al día siguiente
    # (como lo muestra la agenda).
    fechas = (dia + timedelta(days=1), dia) if hora.hour < 6 else (dia,)
    for fecha in fechas:
        turno = turno_de_la_cancha(
            session, negocio, cancha, datetime.combine(fecha, hora, tzinfo=zona)
        )
        if turno is not None:
            return turno.inicio
    return None


def generar(
    session: Session, negocio: Negocio, fijo: TurnoFijo, hasta: date | None = None
) -> Generadas:
    """Crea las reservas del turno fijo que faltan hasta `hasta` (sin commit)."""
    hoy = hoy_en_el_negocio(negocio)
    hasta = hasta or hoy + timedelta(days=DIAS_ADELANTE)
    dia = max(hoy, fijo.generado_hasta + timedelta(days=1) if fijo.generado_hasta else hoy)
    cancha = session.get(Recurso, fijo.recurso_id)
    cliente = session.get(Cliente, fijo.cliente_id)
    deporte = session.scalar(select(Deporte.codigo).where(Deporte.id == cancha.deporte_id))
    resultado = Generadas()
    while dia <= hasta:
        if dia.weekday() == fijo.dia_semana:
            inicio = inicio_en(session, negocio, cancha, dia, fijo.desde)
            if inicio is not None and inicio > ahora():
                try:
                    reserva = reservar(
                        session,
                        negocio,
                        deporte_codigo=deporte,
                        inicio=inicio,
                        recurso_id=cancha.id,
                        cliente=DatosCliente(cliente.nombre, cliente.telefono, cliente.email),
                        origen="panel",
                        estado="confirmada",
                        cobrar_sena=False,
                    )
                    reserva.turno_fijo_id = fijo.id
                    session.flush()
                    resultado.creadas += 1
                except (TurnoNoDisponible, TurnoInvalido):
                    resultado.omitidas.append(inicio)
        dia += timedelta(days=1)
    fijo.generado_hasta = hasta
    return resultado


def dar_de_baja(session: Session, fijo: TurnoFijo) -> int:
    """Libera para siempre: cancela las reservas que vienen y no crea más."""
    fijo.activo = False
    canceladas = session.execute(
        update(Reserva)
        .where(
            Reserva.negocio_id == fijo.negocio_id,
            Reserva.turno_fijo_id == fijo.id,
            Reserva.estado == "confirmada",
            Reserva.inicio > ahora(),
        )
        .values(estado="cancelada")
    )
    return canceladas.rowcount


def completar_todos(session_admin: Session) -> int:
    """Para la tarea periódica: crea las semanas que faltan de todos los turnos fijos."""
    from app.db import sesion_de_negocio

    negocio_ids = set(
        session_admin.scalars(select(TurnoFijo.negocio_id).where(TurnoFijo.activo)).all()
    )
    creadas = 0
    for negocio_id in negocio_ids:
        with sesion_de_negocio(negocio_id) as s:
            negocio = s.get(Negocio, negocio_id)
            for fijo in s.scalars(
                select(TurnoFijo).where(TurnoFijo.negocio_id == negocio_id, TurnoFijo.activo)
            ):
                creadas += generar(s, negocio, fijo).creadas
            s.commit()
    return creadas
