"""Cancelar una reserva y cambiarle el horario, con la política de cada complejo.

La política es `horas_cancelacion` del complejo (la elige cada uno: 24, 5, las que
quiera). Con más anticipación que eso, el jugador recupera la seña si cancela y puede
cambiar el horario una vez. Con menos, si cancela la seña queda para el complejo.

Estas funciones no hacen commit. Si devuelven un pago, quien llama hace commit y después
llama a `cobros.devolver` (así la devolución queda registrada aunque Mercado Pago falle).
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Deporte, Negocio, Pago, Recurso, Reserva
from app.services.cobros import pago_aprobado_de, pedir_devolucion
from app.services.disponibilidad import ahora, canchas_del_deporte
from app.services.reservas import (
    EXCLUSION_VIOLATION,
    TurnoInvalido,
    TurnoNoDisponible,
    esperar_turno_para_reservar,
    liberar_vencidas,
    turno_de_la_cancha,
)

# El jugador puede cambiar el horario de su reserva una sola vez.
MAX_CAMBIOS_DE_HORARIO = 1


class CambioNoPermitido(Exception):
    """El pedido no cumple la política (se le muestra el mensaje al jugador)."""


def limite_para_cancelar(negocio: Negocio, reserva: Reserva) -> datetime:
    """Hasta cuándo se puede cancelar recuperando la seña (y cambiar el horario)."""
    return reserva.inicio - timedelta(hours=negocio.horas_cancelacion)


def a_tiempo(negocio: Negocio, reserva: Reserva, momento: datetime | None = None) -> bool:
    return (momento or ahora()) <= limite_para_cancelar(negocio, reserva)


def cancelar(
    session: Session, negocio: Negocio, reserva: Reserva, *, devolver_sena: bool
) -> Pago | None:
    """Cancela la reserva (y sus espejos de canchas combinadas).

    Si tenía la seña pagada online y `devolver_sena`, marca el pago para devolver y lo
    devuelve. La seña en efectivo no la toca: la maneja el dueño en persona."""
    reserva.estado, reserva.vence_a, reserva.url_pago = "cancelada", None, None
    session.execute(
        update(Reserva)
        .where(Reserva.negocio_id == negocio.id, Reserva.reserva_origen_id == reserva.id)
        .values(estado="cancelada")
    )
    pago = pago_aprobado_de(session, negocio, reserva)
    if pago is None or not devolver_sena:
        return None
    pedir_devolucion(pago)
    session.flush()
    return pago


def cancelar_como_jugador(session: Session, negocio: Negocio, reserva: Reserva) -> Pago | None:
    """El jugador cancela desde su página: recupera la seña solo si está a tiempo."""
    if reserva.estado not in ("pendiente_pago", "confirmada"):
        raise CambioNoPermitido("Esta reserva ya no está activa.")
    if reserva.inicio <= ahora():
        raise CambioNoPermitido("El turno ya empezó: no se puede cancelar.")
    return cancelar(session, negocio, reserva, devolver_sena=a_tiempo(negocio, reserva))


def _deporte_de(session: Session, negocio: Negocio, reserva: Reserva) -> str:
    return session.scalar(
        select(Deporte.codigo)
        .join(Recurso, Recurso.deporte_id == Deporte.id)
        .where(Recurso.id == reserva.recurso_id, Recurso.negocio_id == negocio.id)
    )


def reprogramar(
    session: Session,
    negocio: Negocio,
    reserva: Reserva,
    *,
    inicio: datetime,
    recurso_id: uuid.UUID | None = None,
) -> None:
    """Pasa la reserva a otro turno libre del mismo deporte: la cancha pedida o, si no se
    eligió, la primera libre. El precio pasa a ser el del turno nuevo; la seña no cambia.

    Lanza TurnoInvalido si ese horario no es un turno, o TurnoNoDisponible si está tomado."""
    canchas = canchas_del_deporte(session, negocio.id, _deporte_de(session, negocio, reserva))
    if recurso_id is not None:
        canchas = [c for c in canchas if c.id == recurso_id]
    turnos = {c.id: turno_de_la_cancha(session, negocio, c, inicio) for c in canchas}
    candidatas = [c for c in canchas if turnos[c.id] is not None]
    if not candidatas:
        raise TurnoInvalido("Ese horario no es un turno de esa cancha.")

    esperar_turno_para_reservar(session, negocio.id)
    liberar_vencidas(session, negocio.id, [c.id for c in candidatas])
    for cancha in candidatas:
        turno = turnos[cancha.id]
        try:
            with session.begin_nested():
                reserva.recurso_id, reserva.inicio, reserva.fin = cancha.id, turno.inicio, turno.fin
                reserva.precio, reserva.precio_efectivo = turno.precio, turno.precio_efectivo
                session.flush()
            return
        except IntegrityError as error:
            if getattr(error.orig, "sqlstate", None) != EXCLUSION_VIOLATION:
                raise
    raise TurnoNoDisponible("Ese horario ya no está disponible.")


def puede_cambiar(negocio: Negocio, reserva: Reserva) -> bool:
    return (
        reserva.estado == "confirmada"
        and reserva.cambios_de_horario < MAX_CAMBIOS_DE_HORARIO
        and a_tiempo(negocio, reserva)
    )


def cambiar_como_jugador(
    session: Session,
    negocio: Negocio,
    reserva: Reserva,
    *,
    inicio: datetime,
    recurso_id: uuid.UUID | None = None,
) -> None:
    """El jugador cambia el horario desde su página: una vez y con la anticipación de la
    política del complejo. El turno nuevo tiene que ser futuro."""
    if reserva.estado != "confirmada":
        raise CambioNoPermitido("Solo se puede cambiar el horario de una reserva confirmada.")
    if reserva.cambios_de_horario >= MAX_CAMBIOS_DE_HORARIO:
        raise CambioNoPermitido("Esta reserva ya cambió de horario una vez.")
    if not a_tiempo(negocio, reserva):
        raise CambioNoPermitido(
            f"El horario se puede cambiar hasta {negocio.horas_cancelacion} horas antes del turno."
        )
    if inicio <= ahora():
        raise CambioNoPermitido("Elegí un turno que todavía no empezó.")
    reprogramar(session, negocio, reserva, inicio=inicio, recurso_id=recurso_id)
    reserva.cambios_de_horario += 1
