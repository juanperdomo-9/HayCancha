"""Canchas que se combinan: dos de fútbol 5 forman una de fútbol 7.

Los espejos los mantiene la base (trigger de la migración 0020): acá se configura qué
canchas forman cada una y se averigua cuáles comparten lugar (para los bloqueos fijos,
que no son reservas)."""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Cliente, Recurso, RecursoCombinado, Reserva
from app.services.disponibilidad import ahora

EXCLUSION_VIOLATION = "23P01"
OCUPAN = ("pendiente_pago", "confirmada", "bloqueada")


class CombinacionInvalida(ValueError):
    pass


def en_conflicto(session: Session, negocio_id: uuid.UUID, recurso_id: uuid.UUID) -> set[uuid.UUID]:
    """Las canchas que comparten lugar con esta (sus partes, la grande que integra…)."""
    return set(
        session.scalars(
            text("SELECT id FROM canchas_en_conflicto(:negocio, :recurso)"),
            {"negocio": negocio_id, "recurso": recurso_id},
        )
    )


def partes_por_cancha(session: Session, negocio_id: uuid.UUID) -> dict[uuid.UUID, list[uuid.UUID]]:
    partes: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for fila in session.scalars(
        select(RecursoCombinado).where(RecursoCombinado.negocio_id == negocio_id)
    ):
        partes[fila.recurso_id].append(fila.parte_id)
    return partes


@dataclass(frozen=True)
class ReservaQueSePisa:
    cancha: str
    inicio: datetime
    nombre: str | None


def cambiar_partes(
    session: Session, negocio_id: uuid.UUID, recurso_id: uuid.UUID, partes: list[uuid.UUID]
) -> list[ReservaQueSePisa]:
    """Fija con qué canchas se arma esta (lista vacía: no se combina) y rehace los espejos
    de las reservas que vienen. Devuelve las reservas que ya se pisan con la combinación
    nueva (cargadas antes), para que el dueño las resuelva."""
    partes = list(dict.fromkeys(partes))
    if recurso_id in partes:
        raise CombinacionInvalida("Una cancha no puede ser parte de sí misma.")
    del_negocio = set(session.scalars(select(Recurso.id).where(Recurso.negocio_id == negocio_id)))
    if recurso_id not in del_negocio or not set(partes) <= del_negocio:
        raise CombinacionInvalida("Esa cancha no es de este complejo.")
    # Sin círculos: ninguna de las partes puede estar formada (ni de lejos) por esta.
    actuales = partes_por_cancha(session, negocio_id)
    actuales.pop(recurso_id, None)

    def contiene(raiz: uuid.UUID, buscada: uuid.UUID, vistas: set[uuid.UUID]) -> bool:
        if raiz == buscada:
            return True
        vistas.add(raiz)
        return any(contiene(p, buscada, vistas) for p in actuales.get(raiz, []) if p not in vistas)

    if any(contiene(parte, recurso_id, set()) for parte in partes):
        raise CombinacionInvalida(
            "Esa combinación forma un círculo: una de las partes ya incluye a esta cancha."
        )

    session.execute(
        delete(RecursoCombinado).where(
            RecursoCombinado.negocio_id == negocio_id, RecursoCombinado.recurso_id == recurso_id
        )
    )
    session.add_all(
        RecursoCombinado(negocio_id=negocio_id, recurso_id=recurso_id, parte_id=parte)
        for parte in partes
    )
    session.flush()
    return rehacer_espejos_futuros(session, negocio_id)


def rehacer_espejos_futuros(session: Session, negocio_id: uuid.UUID) -> list[ReservaQueSePisa]:
    """Rehace los espejos de las reservas que todavía no terminaron. Las que chocan quedan
    como estaban y se informan."""
    futuras = session.execute(
        select(Reserva, Recurso.nombre, Cliente.nombre)
        .join(Recurso, Recurso.id == Reserva.recurso_id)
        .outerjoin(Cliente, Cliente.id == Reserva.cliente_id)
        .where(
            Reserva.negocio_id == negocio_id,
            Reserva.reserva_origen_id.is_(None),
            Reserva.estado.in_(OCUPAN),
            Reserva.fin > ahora(),
        )
        .order_by(Reserva.creado_a)
    ).all()
    se_pisan: list[ReservaQueSePisa] = []
    for reserva, cancha, cliente in futuras:
        try:
            with session.begin_nested():
                session.execute(
                    text("SELECT rehacer_espejos(:negocio, :reserva)"),
                    {"negocio": negocio_id, "reserva": reserva.id},
                )
        except IntegrityError as error:
            if getattr(error.orig, "sqlstate", None) != EXCLUSION_VIOLATION:
                raise
            se_pisan.append(ReservaQueSePisa(cancha, reserva.inicio, cliente))
    return se_pisan
