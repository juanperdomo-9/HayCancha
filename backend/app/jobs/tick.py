"""Tarea periódica que corre el cron job de Render cada minuto.

En la fase 0 solo verifica la conexión con la base. En la fase 2 se le suma
el vencimiento de las reservas pendientes de pago.
"""

import logging

from sqlalchemy import text

from app.db import get_engine

logger = logging.getLogger(__name__)


def main() -> None:
    with get_engine().connect() as conexion:
        conexion.execute(text("SELECT 1"))
    logger.info("tick ok")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    main()
