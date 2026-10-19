"""Adicionales: lo que el complejo alquila aparte del turno (paletas, pelotas, parrilla).
Se eligen al reservar (o los carga el dueño después) y se pagan en la cancha con el
saldo: la seña no cambia."""

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.models import Adicional, Recurso, Reserva, ReservaAdicional

MAX_POR_ADICIONAL = 20


class AdicionalInvalido(ValueError):
    pass


@dataclass(frozen=True)
class Pedido:
    adicional_id: uuid.UUID
    cantidad: int


def ofrecidos(session: Session, negocio_id: uuid.UUID) -> list[Adicional]:
    """Los activos, en el orden que eligió el complejo."""
    return list(
        session.scalars(
            select(Adicional)
            .where(Adicional.negocio_id == negocio_id, Adicional.activo)
            .order_by(Adicional.orden, Adicional.nombre)
        )
    )


def pedidos_de(session: Session, reserva: Reserva) -> list[ReservaAdicional]:
    return list(
        session.scalars(
            select(ReservaAdicional)
            .where(
                ReservaAdicional.negocio_id == reserva.negocio_id,
                ReservaAdicional.reserva_id == reserva.id,
            )
            .order_by(ReservaAdicional.nombre)
        )
    )


def fijar_adicionales(session: Session, reserva: Reserva, pedidos: list[Pedido]) -> Decimal:
    """Reemplaza lo pedido en la reserva y actualiza el total. Copia el nombre y el precio
    de ahora: si el complejo cambia el precio después, esta reserva no cambia."""
    cantidades: dict[uuid.UUID, int] = {}
    for pedido in pedidos:
        cantidades[pedido.adicional_id] = cantidades.get(pedido.adicional_id, 0) + pedido.cantidad
    if any(not 0 <= c <= MAX_POR_ADICIONAL for c in cantidades.values()):
        raise AdicionalInvalido(f"Se pueden pedir hasta {MAX_POR_ADICIONAL} de cada uno.")
    cantidades = {i: c for i, c in cantidades.items() if c > 0}

    deporte_id = session.scalar(
        select(Recurso.deporte_id).where(
            Recurso.negocio_id == reserva.negocio_id, Recurso.id == reserva.recurso_id
        )
    )
    adicionales = {
        a.id: a
        for a in session.scalars(
            select(Adicional).where(
                Adicional.negocio_id == reserva.negocio_id,
                Adicional.id.in_(cantidades),
                Adicional.activo,
                or_(Adicional.deporte_id.is_(None), Adicional.deporte_id == deporte_id),
            )
        )
    }
    if set(cantidades) - set(adicionales):
        raise AdicionalInvalido("Uno de los adicionales no está disponible para esta cancha.")

    session.execute(
        delete(ReservaAdicional).where(
            ReservaAdicional.negocio_id == reserva.negocio_id,
            ReservaAdicional.reserva_id == reserva.id,
        )
    )
    total = Decimal("0")
    for adicional_id, cantidad in cantidades.items():
        a = adicionales[adicional_id]
        session.add(
            ReservaAdicional(
                negocio_id=reserva.negocio_id,
                reserva_id=reserva.id,
                adicional_id=a.id,
                nombre=a.nombre,
                precio=a.precio,
                cantidad=cantidad,
            )
        )
        total += a.precio * cantidad
    reserva.total_adicionales = total
    session.flush()
    return total
