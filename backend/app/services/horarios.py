"""Validación de las franjas horarias que carga el dueño (o el equipo de HayCancha)."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import time
from decimal import Decimal

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MINUTOS_DIA = 24 * 60
MINUTOS_SEMANA = 7 * MINUTOS_DIA


class HorariosInvalidos(ValueError):
    pass


@dataclass(frozen=True)
class FranjaNueva:
    dias: Sequence[int]
    desde: time
    hasta: time
    duracion_turno_min: int
    precio: Decimal
    precio_efectivo: Decimal | None = None


def _minutos(hora: time) -> int:
    return hora.hour * 60 + hora.minute


def _texto(franja: FranjaNueva) -> str:
    return f"{franja.desde:%H:%M} a {franja.hasta:%H:%M}"


def largo_de_franja(franja: FranjaNueva) -> int:
    """Minutos que dura. Si hasta <= desde, termina al día siguiente."""
    return (_minutos(franja.hasta) - _minutos(franja.desde)) % MINUTOS_DIA


def validar_franjas(franjas: Sequence[FranjaNueva]) -> None:
    tramos: list[tuple[int, int, int, FranjaNueva]] = []
    for franja in franjas:
        if not franja.dias:
            raise HorariosInvalidos(f"Elegí al menos un día para la franja de {_texto(franja)}.")
        if any(not 0 <= d <= 6 for d in franja.dias):
            raise HorariosInvalidos("Los días van de 0 (lunes) a 6 (domingo).")
        if franja.desde.second or franja.hasta.second:
            raise HorariosInvalidos("Los horarios van en horas y minutos.")
        largo = largo_de_franja(franja)
        if largo == 0:
            raise HorariosInvalidos(f"La franja de {_texto(franja)} no dura nada.")
        if franja.duracion_turno_min <= 0 or franja.duracion_turno_min > largo:
            raise HorariosInvalidos(
                f"En la franja de {_texto(franja)} no entra un turno de "
                f"{franja.duracion_turno_min} minutos."
            )
        if franja.precio < 0:
            raise HorariosInvalidos("El precio no puede ser negativo.")
        if franja.precio_efectivo is not None and not 0 <= franja.precio_efectivo <= franja.precio:
            raise HorariosInvalidos("El precio en efectivo tiene que ser igual o menor al normal.")
        for dia in set(franja.dias):
            inicio = dia * MINUTOS_DIA + _minutos(franja.desde)
            fin = inicio + largo
            # La semana es circular: el domingo a la noche sigue en el lunes.
            if fin > MINUTOS_SEMANA:
                tramos.append((inicio, MINUTOS_SEMANA, dia, franja))
                tramos.append((0, fin - MINUTOS_SEMANA, dia, franja))
            else:
                tramos.append((inicio, fin, dia, franja))

    tramos.sort(key=lambda t: t[0])
    for (_, fin_a, dia_a, a), (inicio_b, _, _, b) in zip(tramos, tramos[1:], strict=False):
        if inicio_b < fin_a:
            raise HorariosInvalidos(
                f"Las franjas del {DIAS[dia_a]} se pisan ({_texto(a)} y {_texto(b)})."
            )
