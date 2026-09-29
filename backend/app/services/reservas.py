"""Crear reservas. Lo usan las reservas cargadas a mano (fase 1) y las online (fase 2).

La regla de que no se pisan la garantiza la base (reservas_sin_superposicion). Acá se
elige la cancha: la pedida, o la primera libre del deporte. Si otra transacción la
toma en el mismo instante, la base rechaza el INSERT y se prueba con la siguiente.
"""

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Cliente, Negocio, Recurso, Reserva
from app.services.disponibilidad import (
    ahora,
    canchas_del_deporte,
    turnos_de_canchas,
    zona_del_negocio,
)
from app.services.sena import calcular_sena
from app.services.turnos import Turno

EXCLUSION_VIOLATION = "23P01"


class TurnoNoDisponible(Exception):
    """Ese horario ya no está disponible."""


class TurnoInvalido(Exception):
    """El horario pedido no es un turno de esa cancha (fuera de horario o desalineado)."""


@dataclass(frozen=True)
class DatosCliente:
    nombre: str
    telefono: str
    email: str | None = None


def normalizar_telefono(telefono: str) -> str:
    return re.sub(r"\D", "", telefono)


def buscar_o_crear_cliente(
    session: Session, negocio_id: uuid.UUID, datos: DatosCliente
) -> uuid.UUID:
    """El jugador se identifica por teléfono dentro del negocio. Si ya existe, se
    actualizan su nombre y email con lo último que cargó."""
    telefono = normalizar_telefono(datos.telefono)
    if len(telefono) < 8:
        raise ValueError("El teléfono tiene que tener al menos 8 números.")
    valores = {"nombre": datos.nombre.strip(), "email": datos.email}
    consulta = (
        insert(Cliente)
        .values(negocio_id=negocio_id, telefono=telefono, **valores)
        .on_conflict_do_update(constraint="uq_clientes_negocio_id_telefono", set_=valores)
        .returning(Cliente.id)
    )
    return session.execute(consulta).scalar_one()


def liberar_vencidas(session: Session, negocio_id: uuid.UUID, recurso_ids: list[uuid.UUID]) -> None:
    """Marca como vencidas las pendientes de pago que ya pasaron su vence_a."""
    session.execute(
        update(Reserva)
        .where(
            Reserva.negocio_id == negocio_id,
            Reserva.recurso_id.in_(recurso_ids),
            Reserva.estado == "pendiente_pago",
            Reserva.vence_a < ahora(),
        )
        .values(estado="vencida")
    )


def turno_de_la_cancha(
    session: Session, negocio: Negocio, cancha: Recurso, inicio: datetime
) -> Turno | None:
    fecha_local = inicio.astimezone(zona_del_negocio(negocio)).date()
    # El turno puede ser de la franja de ese día o de la del día anterior que pasa la medianoche.
    for fecha in (fecha_local, fecha_local - timedelta(days=1)):
        for turno in turnos_de_canchas(session, negocio, [cancha], fecha):
            if turno.inicio == inicio:
                return turno
    return None


def reservar(
    session: Session,
    negocio: Negocio,
    *,
    deporte_codigo: str,
    inicio: datetime,
    cliente: DatosCliente,
    origen: str,
    estado: str = "confirmada",
    recurso_id: uuid.UUID | None = None,
    vence_a: datetime | None = None,
    cobrar_sena: bool = True,
    sena_en_efectivo: bool = False,
    creado_por: uuid.UUID | None = None,
) -> Reserva:
    """Crea la reserva en `session` (del negocio, con RLS) sin hacer commit."""
    canchas = canchas_del_deporte(session, negocio.id, deporte_codigo)
    if recurso_id is not None:
        canchas = [c for c in canchas if c.id == recurso_id]
    if not canchas:
        raise TurnoInvalido("Esa cancha no existe o no es de ese deporte.")

    turnos = {c.id: turno_de_la_cancha(session, negocio, c, inicio) for c in canchas}
    candidatas = [c for c in canchas if turnos[c.id] is not None]
    if not candidatas:
        raise TurnoInvalido("Ese horario no es un turno de esa cancha.")

    liberar_vencidas(session, negocio.id, [c.id for c in candidatas])
    cliente_id = buscar_o_crear_cliente(session, negocio.id, cliente)

    for cancha in candidatas:
        turno = turnos[cancha.id]
        assert turno is not None
        reserva = Reserva(
            negocio_id=negocio.id,
            recurso_id=cancha.id,
            cliente_id=cliente_id,
            inicio=turno.inicio,
            fin=turno.fin,
            estado=estado,
            precio=turno.precio,
            sena=calcular_sena(negocio, turno.precio) if cobrar_sena else Decimal("0.00"),
            sena_en_efectivo=sena_en_efectivo,
            vence_a=vence_a,
            origen=origen,
            creado_por=creado_por,
        )
        try:
            with session.begin_nested():
                session.add(reserva)
                session.flush()
        except IntegrityError as error:
            if getattr(error.orig, "sqlstate", None) != EXCLUSION_VIOLATION:
                raise
            continue  # otro la tomó: probamos con la siguiente cancha
        return reserva

    raise TurnoNoDisponible("Ese horario ya no está disponible.")
