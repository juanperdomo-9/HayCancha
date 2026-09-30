"""Tarea periódica que corre el cron job de Render cada minuto.

- Vence las reservas pendientes de pago cuyo tiempo para pagar ya pasó, así esos turnos
  vuelven a quedar libres. (Las rutas también las liberan al reservar, pero esto deja la
  agenda al día aunque nadie reserve.)
- Cada 10 minutos, reintenta las devoluciones de señas que Mercado Pago no aceptó.
- Una vez por hora, renueva los tokens de Mercado Pago que están por vencer.
"""

import logging

from app.db import sesion_admin
from app.services.cobros import reintentar_devoluciones
from app.services.disponibilidad import ahora
from app.services.mercadopago import renovar_tokens_por_vencer
from app.services.reservas import vencer_pendientes

logger = logging.getLogger(__name__)


def main(*, renovar_tokens: bool | None = None, devoluciones: bool | None = None) -> None:
    with sesion_admin() as session, session.begin():
        vencidas = vencer_pendientes(session)
    logger.info("tick: %s reservas vencidas", vencidas)

    if devoluciones if devoluciones is not None else ahora().minute % 10 == 0:
        with sesion_admin() as session:
            devueltas, pendientes = reintentar_devoluciones(session)
        logger.info("tick: %s devoluciones hechas, %s pendientes", devueltas, pendientes)

    # Los tokens duran 180 días y se renuevan 30 antes: alcanza con probar una vez por hora
    # (si Mercado Pago falla un rato, se reintenta a la hora siguiente).
    if renovar_tokens if renovar_tokens is not None else ahora().minute == 0:
        with sesion_admin() as session, session.begin():
            resultado = renovar_tokens_por_vencer(session)
        logger.info("tick: tokens de Mercado Pago %s", resultado)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    main()
