"""Bloqueos que se repiten todas las semanas. No son reservas: se calculan cuando hacen
falta (disponibilidad, agenda y al reservar), así un bloqueo fijo vale para siempre sin
crear filas por cada semana."""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BloqueoFijo, Negocio
from app.services.turnos import se_superponen


@dataclass(frozen=True)
class Ocurrencia:
    """Un bloqueo fijo en una fecha concreta."""

    bloqueo_id: uuid.UUID
    inicio: datetime
    fin: datetime
    motivo: str


def ocurrencias(
    session: Session,
    negocio: Negocio,
    recurso_ids: list[uuid.UUID],
    desde: datetime,
    hasta: datetime,
) -> dict[uuid.UUID, list[Ocurrencia]]:
    """Para cada cancha, los bloqueos fijos que caen en el intervalo [desde, hasta)."""
    from app.services.disponibilidad import zona_del_negocio

    resultado: dict[uuid.UUID, list[Ocurrencia]] = defaultdict(list)
    if not recurso_ids:
        return resultado
    bloqueos = list(
        session.scalars(select(BloqueoFijo).where(BloqueoFijo.negocio_id == negocio.id))
    )
    if not bloqueos:
        return resultado
    from app.services.combinadas import en_conflicto

    # Un bloqueo fijo en una cancha también ocupa las que comparten lugar con ella
    # (canchas combinadas): bloquear la de fútbol 7 cierra sus dos de fútbol 5.
    alcance: dict[uuid.UUID, set[uuid.UUID]] = {}
    for b in bloqueos:
        if b.recurso_id and b.recurso_id not in alcance:
            alcance[b.recurso_id] = {b.recurso_id} | en_conflicto(session, negocio.id, b.recurso_id)
    zona = zona_del_negocio(negocio)
    # Desde un día antes: un bloqueo de 23 a 02 del día anterior puede tocar el intervalo.
    dia: date = desde.astimezone(zona).date() - timedelta(days=1)
    ultimo = hasta.astimezone(zona).date()
    while dia <= ultimo:
        for b in bloqueos:
            if b.dia_semana != dia.weekday():
                continue
            inicio = datetime.combine(dia, b.desde, tzinfo=zona)
            fin = datetime.combine(dia, b.hasta, tzinfo=zona)
            if b.hasta <= b.desde:
                fin += timedelta(days=1)  # termina al día siguiente (o a medianoche)
            if not se_superponen(inicio, fin, desde, hasta):
                continue
            for recurso_id in alcance[b.recurso_id] if b.recurso_id else recurso_ids:
                if recurso_id in recurso_ids:
                    resultado[recurso_id].append(Ocurrencia(b.id, inicio, fin, b.motivo))
        dia += timedelta(days=1)
    return resultado


def bloqueo_en(
    ocupacion: dict[uuid.UUID, list[Ocurrencia]],
    recurso_id: uuid.UUID,
    inicio: datetime,
    fin: datetime,
) -> Ocurrencia | None:
    return next(
        (o for o in ocupacion.get(recurso_id, []) if se_superponen(inicio, fin, o.inicio, o.fin)),
        None,
    )


def esta_bloqueado(
    session: Session, negocio: Negocio, recurso_id: uuid.UUID, inicio: datetime, fin: datetime
) -> bool:
    return (
        bloqueo_en(
            ocurrencias(session, negocio, [recurso_id], inicio, fin), recurso_id, inicio, fin
        )
        is not None
    )
