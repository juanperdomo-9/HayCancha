from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

CENTAVOS = Decimal("0.01")


class ConfiguracionSena(Protocol):
    sena_tipo: str
    sena_valor: Decimal


def calcular_sena(negocio: ConfiguracionSena, precio: Decimal) -> Decimal:
    """Seña de un turno. Siempre se calcula en el backend: nunca se confía en el frontend."""
    if negocio.sena_tipo == "fija":
        sena = min(negocio.sena_valor, precio)
    else:
        sena = precio * negocio.sena_valor / 100
    return sena.quantize(CENTAVOS, rounding=ROUND_HALF_UP)
