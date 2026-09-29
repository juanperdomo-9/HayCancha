"""Arma los turnos de un día a partir de las franjas horarias de cada cancha.

Todo en la zona horaria del negocio. Un turno pertenece al día de su franja: si el
viernes se alquila de 18 a 02, el turno de la 01:00 aparece el viernes (así lo piensa
el jugador: "el viernes a la 1").
"""

import uuid
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Protocol
from zoneinfo import ZoneInfo


class FranjaHoraria(Protocol):
    recurso_id: uuid.UUID
    dia_semana: int
    desde: time
    hasta: time
    duracion_turno_min: int
    precio: Decimal


@dataclass(frozen=True)
class Turno:
    recurso_id: uuid.UUID
    inicio: datetime
    fin: datetime
    precio: Decimal


def turnos_del_dia(
    franjas: Iterable[FranjaHoraria], fecha: date, zona: ZoneInfo
) -> Iterator[Turno]:
    for franja in franjas:
        if franja.dia_semana != fecha.weekday():
            continue
        inicio = datetime.combine(fecha, franja.desde, tzinfo=zona)
        fin_franja = datetime.combine(fecha, franja.hasta, tzinfo=zona)
        if franja.hasta <= franja.desde:
            fin_franja += timedelta(days=1)  # termina al día siguiente (o a medianoche)
        duracion = timedelta(minutes=franja.duracion_turno_min)
        while inicio + duracion <= fin_franja:
            yield Turno(franja.recurso_id, inicio, inicio + duracion, franja.precio)
            inicio += duracion


def se_superponen(inicio_a: datetime, fin_a: datetime, inicio_b: datetime, fin_b: datetime) -> bool:
    """Intervalos [inicio, fin): uno que termina a las 22 no choca con otro que empieza a las 22."""
    return inicio_a < fin_b and inicio_b < fin_a
