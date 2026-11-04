from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
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


def cargo_de_servicio(pct: Decimal, sena: Decimal) -> Decimal:
    """Lo que paga el jugador encima de la seña para que, después de la comisión de Mercado
    Pago (que se cobra sobre el total), al complejo le quede la seña entera. Se redondea
    hacia arriba a $10."""
    if pct <= 0 or sena <= 0:
        return Decimal("0.00")
    total = sena / (1 - pct / 100)
    cargo = ((total - sena) / 10).to_integral_value(rounding=ROUND_CEILING) * 10
    return cargo.quantize(CENTAVOS)
