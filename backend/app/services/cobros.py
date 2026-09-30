"""Cobro de la seña: crear el link de pago, acreditar pagos y devolverlos.

Un turno solo pasa a `confirmada` por `acreditar_pago`, con lo que informa el proveedor
al consultarlo (nunca con lo que dice el cuerpo de un webhook). El proveedor es Mercado
Pago con el token del complejo o, solo en desarrollo, uno simulado.
"""

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
from app.services.reservas import EXCLUSION_VIOLATION

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
    MONTO_INVALIDO = "monto_invalido"
    A_DEVOLVER = "a_devolver"  # hay que reembolsarlo


class ProveedorDePagos(Protocol):
    simulado: bool

    def crear_cobro(self, negocio: Negocio, reserva: Reserva, descripcion: str) -> str | None:
        """Crea el cobro de la seña y devuelve la URL a la que va el jugador a pagar
        (None si el pago se hace en la propia página, como en el simulado)."""
        ...

    def reembolsar(self, negocio: Negocio, pago_id: str) -> None: ...


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


def proveedor_para(negocio: Negocio) -> ProveedorDePagos | None:
    """Con qué cobra este complejo. None: todavía no toma reservas online."""
    if negocio.mp_access_token_enc:
        from app.services.mercadopago import ProveedorMercadoPago

        return ProveedorMercadoPago()
    if get_settings().pagos_simulados:
        return ProveedorSimulado()
    return None


def acreditar_pago(session: Session, negocio: Negocio, pago: PagoInformado) -> Resultado:
    """Registra el pago y, si corresponde, confirma la reserva. No hace commit.

    Si devuelve A_DEVOLVER, quien llama tiene que reembolsar el pago (y marcarlo)."""
    if pago.reserva_id is None:
        return Resultado.SIN_RESERVA
    reserva = session.scalar(
        select(Reserva)
        .where(Reserva.id == pago.reserva_id, Reserva.negocio_id == negocio.id)
        .with_for_update()
    )
    if reserva is None:
        return Resultado.SIN_RESERVA

    nuevo = session.execute(
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
    if nuevo is None:
        return Resultado.YA_REGISTRADO

    if pago.estado != "approved":
        return Resultado.NO_APROBADO
    if pago.moneda != MONEDA or pago.monto != reserva.sena:
        return Resultado.MONTO_INVALIDO

    if reserva.estado == "pendiente_pago":
        reserva.estado, reserva.vence_a = "confirmada", None
        session.flush()
        return Resultado.CONFIRMADA
    if reserva.estado == "vencida":
        # Si el turno sigue libre, se confirma igual; si otro lo tomó, la base lo impide.
        try:
            with session.begin_nested():
                reserva.estado, reserva.vence_a = "confirmada", None
                session.flush()
            return Resultado.CONFIRMADA
        except IntegrityError as error:
            if getattr(error.orig, "sqlstate", None) != EXCLUSION_VIOLATION:
                raise
            session.refresh(reserva)
            return Resultado.A_DEVOLVER
    # Cancelada, o ya confirmada por otro pago (pagó dos veces): se devuelve.
    return Resultado.A_DEVOLVER


def marcar_devuelto(session: Session, negocio: Negocio, pago_id: str) -> None:
    session.execute(
        update(Pago)
        .where(Pago.negocio_id == negocio.id, Pago.mp_payment_id == pago_id)
        .values(estado="refunded")
    )


def pago_aprobado_de(session: Session, negocio: Negocio, reserva: Reserva) -> Pago | None:
    """El pago aprobado (no devuelto) de una reserva, si lo tiene."""
    return session.scalar(
        select(Pago).where(
            Pago.negocio_id == negocio.id,
            Pago.reserva_id == reserva.id,
            Pago.estado == "approved",
        )
    )
