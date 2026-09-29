"""Generación de turnos y cálculo de seña (sin base)."""

import uuid
from dataclasses import dataclass
from datetime import date, time
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from app.services.sena import calcular_sena
from app.services.turnos import turnos_del_dia

BA = ZoneInfo("America/Argentina/Buenos_Aires")
SABADO = date(2026, 10, 3)
CANCHA = uuid.uuid4()


@dataclass
class Franja:
    desde: time
    hasta: time
    duracion_turno_min: int = 60
    precio: Decimal = Decimal("70000")
    dia_semana: int = SABADO.weekday()
    recurso_id: uuid.UUID = CANCHA


def horas(franja: Franja) -> list[str]:
    return [t.inicio.strftime("%H:%M") for t in turnos_del_dia([franja], SABADO, BA)]


def test_franja_de_9_a_18_con_turnos_de_una_hora() -> None:
    assert horas(Franja(time(9), time(18))) == [f"{h:02d}:00" for h in range(9, 18)]


def test_hasta_medianoche() -> None:
    turnos = list(turnos_del_dia([Franja(time(18), time(0))], SABADO, BA))
    assert [t.inicio.hour for t in turnos] == [18, 19, 20, 21, 22, 23]
    assert turnos[-1].fin.date() == date(2026, 10, 4)


def test_franja_que_pasa_la_medianoche() -> None:
    assert horas(Franja(time(20), time(2))) == [
        "20:00",
        "21:00",
        "22:00",
        "23:00",
        "00:00",
        "01:00",
    ]


def test_padel_de_90_minutos_no_pasa_el_cierre() -> None:
    """De 8 a 17 entran 6 turnos de 90 minutos; el último termina justo a las 17."""
    turnos = list(turnos_del_dia([Franja(time(8), time(17), 90)], SABADO, BA))
    assert [t.inicio.strftime("%H:%M") for t in turnos] == [
        "08:00",
        "09:30",
        "11:00",
        "12:30",
        "14:00",
        "15:30",
    ]
    assert turnos[-1].fin.strftime("%H:%M") == "17:00"


def test_si_la_duracion_no_entra_justo_sobra_el_final() -> None:
    assert horas(Franja(time(8), time(12), 90)) == ["08:00", "09:30"]


def test_otro_dia_no_genera_turnos() -> None:
    assert horas(Franja(time(9), time(18), dia_semana=(SABADO.weekday() + 1) % 7)) == []


def test_los_turnos_quedan_en_la_zona_del_negocio() -> None:
    turno = next(turnos_del_dia([Franja(time(21), time(22))], SABADO, BA))
    assert turno.inicio.utcoffset().total_seconds() == -3 * 3600


@dataclass
class Negocio:
    sena_tipo: str
    sena_valor: Decimal


@pytest.mark.parametrize(
    ("tipo", "valor", "precio", "esperada"),
    [
        ("porcentaje", "20", "85000", "17000.00"),
        ("porcentaje", "30", "52500", "15750.00"),
        ("porcentaje", "20", "33333", "6666.60"),
        ("porcentaje", "0", "70000", "0.00"),
        ("fija", "10000", "36000", "10000.00"),
        ("fija", "50000", "36000", "36000.00"),  # nunca más que el turno
    ],
)
def test_calculo_de_sena(tipo: str, valor: str, precio: str, esperada: str) -> None:
    assert calcular_sena(Negocio(tipo, Decimal(valor)), Decimal(precio)) == Decimal(esperada)
