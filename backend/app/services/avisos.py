"""Avisos por email al dueño. Cada función abre su propia sesión (corren en segundo plano,
después de responder) y nunca lanzan: un email que no sale no puede romper nada."""

import logging
import uuid
from datetime import datetime

from app.db import sesion_de_negocio
from app.models import Cliente, Negocio, Pago, Recurso, Reserva
from app.services import email
from app.services.agenda import saldo

logger = logging.getLogger(__name__)


def _datos(s, negocio_id: uuid.UUID, reserva_id: uuid.UUID):
    negocio = s.get(Negocio, negocio_id)
    reserva = s.get(Reserva, reserva_id)
    cliente = s.get(Cliente, reserva.cliente_id) if reserva and reserva.cliente_id else None
    cancha = s.get(Recurso, reserva.recurso_id).nombre if reserva else ""
    return negocio, reserva, cliente, cancha


def _sin_romper(funcion):
    def envuelta(*args, **kwargs):
        try:
            funcion(*args, **kwargs)
        except Exception:  # noqa: BLE001 — un aviso nunca rompe nada
            logger.exception("No se pudo armar el aviso %s", funcion.__name__)

    envuelta.__name__ = funcion.__name__
    return envuelta


@_sin_romper
def reserva_confirmada(negocio_id: uuid.UUID, reserva_id: uuid.UUID) -> None:
    with sesion_de_negocio(negocio_id) as s:
        negocio, reserva, cliente, cancha = _datos(s, negocio_id, reserva_id)
        email.enviar(
            email.reserva_nueva(
                negocio,
                email.emails_de_duenos(s, negocio_id),
                jugador=cliente.nombre,
                telefono=cliente.telefono,
                cancha=cancha,
                inicio=reserva.inicio,
                sena=reserva.sena,
                saldo=saldo(reserva),
            )
        )


@_sin_romper
def reserva_cancelada(negocio_id: uuid.UUID, reserva_id: uuid.UUID) -> None:
    from app.services.cobros import devolucion_de, pago_aprobado_de

    with sesion_de_negocio(negocio_id) as s:
        negocio, reserva, cliente, cancha = _datos(s, negocio_id, reserva_id)
        if devolucion_de(s, negocio, reserva) is not None:
            devuelta: bool | None = True
        elif pago_aprobado_de(s, negocio, reserva) is not None:
            devuelta = False
        else:
            devuelta = None
        email.enviar(
            email.cancelacion(
                negocio,
                email.emails_de_duenos(s, negocio_id),
                jugador=cliente.nombre,
                cancha=cancha,
                inicio=reserva.inicio,
                sena=reserva.sena,
                devuelta=devuelta,
            )
        )


@_sin_romper
def horario_cambiado(negocio_id: uuid.UUID, reserva_id: uuid.UUID, antes: datetime) -> None:
    with sesion_de_negocio(negocio_id) as s:
        negocio, reserva, cliente, cancha = _datos(s, negocio_id, reserva_id)
        email.enviar(
            email.cambio_de_horario(
                negocio,
                email.emails_de_duenos(s, negocio_id),
                jugador=cliente.nombre,
                antes=antes,
                cancha=cancha,
                ahora=reserva.inicio,
                saldo=saldo(reserva),
            )
        )


@_sin_romper
def devolucion_pendiente(negocio_id: uuid.UUID, pago_id: uuid.UUID) -> None:
    with sesion_de_negocio(negocio_id) as s:
        pago = s.get(Pago, pago_id)
        negocio, _, cliente, _ = _datos(s, negocio_id, pago.reserva_id)
        email.enviar(
            email.devolucion_pendiente(
                negocio,
                email.emails_de_duenos(s, negocio_id),
                jugador=cliente.nombre if cliente else "un jugador",
                monto=pago.monto,
            )
        )
