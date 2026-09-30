"""Tarea periódica que corre el cron job de Render cada minuto.

Vence las reservas pendientes de pago cuyo tiempo para pagar ya pasó, así esos turnos
vuelven a quedar libres. (Las rutas también las liberan al reservar, pero esto deja la
agenda al día aunque nadie reserve.)
"""

import logging

from app.db import sesion_admin
from app.services.reservas import vencer_pendientes

logger = logging.getLogger(__name__)


def main() -> None:
    with sesion_admin() as session, session.begin():
        vencidas = vencer_pendientes(session)
    logger.info("tick: %s reservas vencidas", vencidas)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    main()
