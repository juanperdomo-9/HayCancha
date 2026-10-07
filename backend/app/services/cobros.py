"""Cobro de la seña: crear el link de pago, acreditar pagos y devolverlos.

Un turno solo pasa a `confirmada` por `acreditar_pago`, con lo que informa el proveedor
al consultarlo (nunca con lo que dice el cuerpo de un webhook). El proveedor es Mercado
Pago con el token del complejo o, solo en desarrollo, uno simulado.

Devoluciones: un pago que hay que devolver queda con `devolucion = "pendiente"` en la
misma transacción en que se decide. Después se le pide a Mercado Pago (`devolver`); si
no la acepta (por ejemplo, el complejo no tiene saldo), la tarea periódica la reintenta.
Así ninguna devolución se pierde aunque algo falle en el medio.
"""

import logging
import secrets
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum
from typing import Any, Protocol

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Negocio, Pago, Reserva
from app.services.disponibilidad import ahora
from app.services.reservas import EXCLUSION_VIOLATION

logger = logging.getLogger(__name__)

MONEDA = "ARS"


@dataclass(frozen=True)
class PagoInformado:
    """Un pago tal como lo informa el proveedor al consultarlo."""

    id: str
    estado: str
    monto: Decimal
    moneda: str
    reserva_id: uuid.UUID | None
    detalle: dict[str, Any] = field(default_factory=dict)


class Resultado(StrEnum):
    CONFIRMADA = "confirmada"
    YA_REGISTRADO = "ya_registrado"  # el mismo pago llegó otra vez
    SIN_RESERVA = "sin_reserva"
    NO_APROBADO = "no_aprobado"
    MONTO_INVALIDO = "monto_invalido"  # aprobado pero por otro monto: se devuelve
    A_DEVOLVER = "a_devolver"  # aprobado, pero el turno ya no es suyo: se devuelve


class ErrorDePago(Exception):
    """El proveedor no pudo hacer lo que se le pidió (crear el cobro, devolver…)."""


class ProveedorDePagos(Protocol):
    simulado: bool

    def crear_cobro(self, negocio: Negocio, reserva: Reserva, descripcion: str) -> str | None:
        """Crea el cobro de la seña y devuelve la URL a la que va el jugador a pagar
        (None si el pago se hace en la propia página, como en el simulado)."""
        ...

    def reembolsar(self, negocio: Negocio, pago_id: str) -> None:
        """Devuelve el pago completo. Si no puede, lanza ErrorDePago."""
        ...


class ProveedorSimulado:
    """Solo desarrollo (PAGOS_SIMULADOS=true): no cobra nada."""

    simulado = True

    def crear_cobro(self, negocio: Negocio, reserva: Reserva, descripcion: str) -> str | None:
        return None

    def reembolsar(self, negocio: Negocio, pago_id: str) -> None:
        return None

    @staticmethod
    def pago_aprobado(reserva: Reserva) -> PagoInformado:
        return PagoInformado(
            id=f"SIM-{uuid.uuid4().hex[:16]}",
            estado="approved",
            monto=reserva.sena,
            moneda=MONEDA,
            reserva_id=reserva.id,
            detalle={"simulado": True},
        )


# Sin 0/o, 1/l/i: el código se puede dictar o copiar a mano sin confundirse.
ALFABETO_DEL_CODIGO = "abcdefghjkmnpqrstuvwxyz23456789"
DIAS_DEL_CODIGO = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]


def nuevo_codigo(negocio: Negocio, reserva: Reserva) -> str:
    """El código del link de la reserva, por ejemplo "sab3-21hs-k7m2q9xa": día y hora (en
    la zona del complejo) para reconocerlo, y 8 caracteres al azar (unos 40 bits) para que
    nadie pueda adivinar el de otro. No lleva datos personales."""
    from app.services.disponibilidad import zona_del_negocio

    inicio = reserva.inicio.astimezone(zona_del_negocio(negocio))
    hora = f"{inicio:%H}hs" if inicio.minute == 0 else f"{inicio:%H%M}hs"
    azar = "".join(secrets.choice(ALFABETO_DEL_CODIGO) for _ in range(8))
    return f"{DIAS_DEL_CODIGO[inicio.weekday()]}{inicio.day}-{hora}-{azar}"


def link_de_la_reserva(negocio: Negocio, reserva: Reserva) -> str:
    """La ruta de la página de la reserva (las viejas, sin código, van por el id)."""
    if reserva.codigo:
        return f"/{negocio.slug}/r/{reserva.codigo}"
    return f"/{negocio.slug}/reserva/{reserva.id}"


def proveedor_para(negocio: Negocio) -> ProveedorDePagos | None:
    """Con qué cobra este complejo. None: todavía no toma reservas online.

    Con Mercado Pago vinculado (y la app de HayCanchas configurada) cobra en la cuenta del
    complejo. Sin vincular, solo en desarrollo, el pago simulado."""
    settings = get_settings()
    if negocio.mp_access_token_enc and settings.mercadopago_configurado:
        from app.services.mercadopago import ProveedorMercadoPago

        return ProveedorMercadoPago()
    if settings.pagos_simulados:
        return ProveedorSimulado()
    return None


def acreditar_pago(session: Session, negocio: Negocio, pago: PagoInformado) -> Resultado:
    """Registra el pago y, si corresponde, confirma la reserva. No hace commit.

    Si hay que devolver la plata (A_DEVOLVER o MONTO_INVALIDO), el pago queda con
    devolucion = "pendiente": después de hacer commit, quien llama usa `devolver`."""
    if pago.reserva_id is None:
        return Resultado.SIN_RESERVA
    reserva = session.scalar(
        select(Reserva)
        .where(Reserva.id == pago.reserva_id, Reserva.negocio_id == negocio.id)
        .with_for_update()
    )
    if reserva is None:
        return Resultado.SIN_RESERVA

    registrado = session.execute(
        insert(Pago)
        .values(
            negocio_id=negocio.id,
            reserva_id=reserva.id,
            mp_payment_id=pago.id,
            monto=pago.monto,
            moneda=pago.moneda,
            estado=pago.estado,
            detalle=pago.detalle,
        )
        .on_conflict_do_nothing(index_elements=["mp_payment_id"])
        .returning(Pago.id)
    ).scalar_one_or_none()
    if registrado is None:
        return Resultado.YA_REGISTRADO

    def a_devolver(resultado: Resultado) -> Resultado:
        session.execute(update(Pago).where(Pago.id == registrado).values(devolucion="pendiente"))
        return resultado

    if pago.estado != "approved":
        return Resultado.NO_APROBADO
    if pago.moneda != MONEDA or pago.monto != reserva.sena:
        return a_devolver(Resultado.MONTO_INVALIDO)

    if reserva.estado == "pendiente_pago":
        reserva.estado, reserva.vence_a, reserva.url_pago = "confirmada", None, None
        session.flush()
        return Resultado.CONFIRMADA
    if reserva.estado == "vencida":
        # Si el turno sigue libre, se confirma igual; si otro lo tomó, la base lo impide.
        try:
            with session.begin_nested():
                reserva.estado, reserva.vence_a, reserva.url_pago = "confirmada", None, None
                session.flush()
            return Resultado.CONFIRMADA
        except IntegrityError as error:
            if getattr(error.orig, "sqlstate", None) != EXCLUSION_VIOLATION:
                raise
            session.refresh(reserva)
    # Cancelada, vencida con el turno tomado, o ya confirmada por otro pago (pagó dos
    # veces): se devuelve.
    return a_devolver(Resultado.A_DEVOLVER)


def pago_aprobado_de(session: Session, negocio: Negocio, reserva: Reserva) -> Pago | None:
    """El pago aprobado que confirmó la reserva (el que no hay que devolver), si lo tiene."""
    return session.scalar(
        select(Pago).where(
            Pago.negocio_id == negocio.id,
            Pago.reserva_id == reserva.id,
            Pago.estado == "approved",
            Pago.devolucion.is_(None),
        )
    )


def devolucion_de(session: Session, negocio: Negocio, reserva: Reserva) -> Pago | None:
    """El pago de la reserva que se devolvió o se está devolviendo, si hay uno.
    Si hay varios (pagó dos veces), el más reciente."""
    return session.scalar(
        select(Pago)
        .where(
            Pago.negocio_id == negocio.id,
            Pago.reserva_id == reserva.id,
            Pago.devolucion.is_not(None),
        )
        .order_by(Pago.creado_a.desc())
        .limit(1)
    )


def pedir_devolucion(pago: Pago) -> None:
    """Marca el pago para devolver (en la transacción de quien llama)."""
    if pago.devolucion is None:
        pago.devolucion = "pendiente"


def devolver(
    session: Session, negocio: Negocio, pago: Pago, proveedor: ProveedorDePagos | None
) -> bool:
    """Le pide al proveedor que devuelva un pago marcado como pendiente y hace commit.

    True si quedó devuelto. Si el proveedor no lo acepta, queda pendiente para reintentar."""
    if pago.devolucion != "pendiente":
        return pago.devolucion == "hecha"
    pago.devolucion_intentos += 1
    try:
        if proveedor is None:
            raise ErrorDePago("El complejo no tiene con qué devolver (Mercado Pago sin vincular)")
        proveedor.reembolsar(negocio, pago.mp_payment_id)
    except ErrorDePago as error:
        logger.warning("No se pudo devolver el pago %s: %s", pago.mp_payment_id, error)
        primera_vez = pago.devolucion_intentos == 1
        session.commit()
        if primera_vez:
            from app.services import avisos

            avisos.devolucion_pendiente(negocio.id, pago.id)
        return False
    pago.devolucion, pago.estado, pago.devuelto_a = "hecha", "refunded", ahora()
    session.commit()
    logger.info("Pago %s devuelto", pago.mp_payment_id)
    return True


def reintentar_devoluciones(session_admin: Session) -> tuple[int, int]:
    """Reintenta las devoluciones pendientes de todos los complejos (tarea periódica).

    Devuelve (devueltas, siguen_pendientes)."""
    from app.db import sesion_de_negocio

    pendientes = session_admin.execute(
        select(Pago.id, Pago.negocio_id).where(Pago.devolucion == "pendiente")
    ).all()
    devueltas = 0
    for pago_id, negocio_id in pendientes:
        with sesion_de_negocio(negocio_id) as s:
            negocio = s.get(Negocio, negocio_id)
            pago = s.get(Pago, pago_id, with_for_update=True)
            if pago is None or pago.devolucion != "pendiente":
                s.rollback()
                continue
            if devolver(s, negocio, pago, proveedor_para(negocio)):
                devueltas += 1
    return devueltas, len(pendientes) - devueltas
