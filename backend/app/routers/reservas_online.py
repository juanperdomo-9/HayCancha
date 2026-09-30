"""Reserva online del jugador: crear la reserva pendiente, ver su estado y pagar la seña.

El turno queda en `pendiente_pago` hasta que se acredita el pago (webhook de Mercado Pago
o, solo en desarrollo, el pago simulado). El jugador no necesita cuenta.
"""

import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_session, sesion_de_negocio
from app.models import Cliente, Deporte, Negocio, Recurso, Reserva
from app.routers.publico import buscar_negocio
from app.schemas import reserva_online as esquemas
from app.services.cobros import ProveedorSimulado, Resultado, acreditar_pago, proveedor_para
from app.services.disponibilidad import ahora, zona_del_negocio
from app.services.reservas import (
    DatosCliente,
    TurnoInvalido,
    TurnoNoDisponible,
    normalizar_telefono,
    reservar,
)

router = APIRouter(prefix="/publico/complejos/{slug}/reservas", tags=["reserva online"])

SesionPublica = Annotated[Session, Depends(get_session)]

# Reservas esperando el pago al mismo tiempo, por teléfono y complejo.
MAX_PENDIENTES_POR_TELEFONO = 2

MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def _descripcion(negocio: Negocio, cancha: str, reserva: Reserva) -> str:
    """Lo que ve el jugador en Mercado Pago: "Seña: Cancha 1, sáb 3/10 21:00"."""
    inicio = reserva.inicio.astimezone(zona_del_negocio(negocio))
    return f"Seña: {cancha}, {DIAS[inicio.weekday()]} {inicio.day}/{inicio.month} {inicio:%H:%M}"


def _pendientes_del_telefono(session: Session, negocio: Negocio, telefono: str) -> int:
    return session.scalar(
        select(func.count())
        .select_from(Reserva)
        .join(Cliente, Cliente.id == Reserva.cliente_id)
        .where(
            Reserva.negocio_id == negocio.id,
            Cliente.telefono == normalizar_telefono(telefono),
            Reserva.estado == "pendiente_pago",
            Reserva.vence_a > ahora(),
        )
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def reservar_online(
    slug: str, datos: esquemas.NuevaReserva, session: SesionPublica
) -> esquemas.ReservaCreada:
    negocio = buscar_negocio(session, slug)
    proveedor = proveedor_para(negocio)
    if proveedor is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Este complejo todavía no toma reservas online."
        )

    with sesion_de_negocio(negocio.id) as s:
        if _pendientes_del_telefono(s, negocio, datos.telefono) >= MAX_PENDIENTES_POR_TELEFONO:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Ya tenés reservas esperando el pago. Pagalas o esperá unos minutos a que venzan.",
            )
        try:
            reserva = reservar(
                s,
                negocio,
                deporte_codigo=datos.deporte,
                inicio=datos.inicio,
                recurso_id=datos.recurso_id,
                cliente=DatosCliente(datos.nombre, datos.telefono, datos.email),
                origen="web",
                estado="pendiente_pago",
                vence_a=ahora() + timedelta(minutes=negocio.minutos_para_pagar),
            )
        except TurnoNoDisponible as error:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ese horario ya no está disponible. Elegí otro."
            ) from error
        except (TurnoInvalido, ValueError) as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

        cancha = s.get(Recurso, reserva.recurso_id).nombre
        url_pago = proveedor.crear_cobro(negocio, reserva, _descripcion(negocio, cancha, reserva))
        s.commit()
        return esquemas.ReservaCreada(id=reserva.id, url_pago=url_pago)


def _buscar(s: Session, negocio: Negocio, reserva_id: uuid.UUID) -> Reserva:
    reserva = s.scalar(
        select(Reserva).where(
            Reserva.id == reserva_id,
            Reserva.negocio_id == negocio.id,
            Reserva.origen == "web",
        )
    )
    if reserva is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa reserva.")
    return reserva


def _publica(s: Session, negocio: Negocio, reserva: Reserva) -> esquemas.ReservaPublica:
    recurso, deporte = s.execute(
        select(Recurso, Deporte)
        .join(Deporte, Deporte.id == Recurso.deporte_id)
        .where(Recurso.id == reserva.recurso_id, Recurso.negocio_id == negocio.id)
    ).one()
    cliente = s.get(Cliente, reserva.cliente_id)
    zona = zona_del_negocio(negocio)
    proveedor = proveedor_para(negocio)
    pendiente = reserva.estado == "pendiente_pago"
    return esquemas.ReservaPublica(
        id=reserva.id,
        estado=reserva.estado,
        complejo=negocio.nombre,
        slug=negocio.slug,
        color_primario=negocio.color_primario,
        color_secundario=negocio.color_secundario,
        logo_url=negocio.logo_url,
        jugador=cliente.nombre.split()[0] if cliente else "",
        cancha=recurso.nombre,
        deporte=deporte.nombre,
        fecha=reserva.inicio.astimezone(zona).date(),
        hora=reserva.inicio.astimezone(zona).strftime("%H:%M"),
        hora_fin=reserva.fin.astimezone(zona).strftime("%H:%M"),
        precio=reserva.precio,
        sena=reserva.sena,
        saldo=reserva.precio - reserva.sena,
        vence_a=reserva.vence_a if pendiente else None,
        url_pago=None,  # con Mercado Pago, el link de la preferencia (bloque 2C)
        pago_simulado=pendiente and proveedor is not None and proveedor.simulado,
        horas_cancelacion=negocio.horas_cancelacion,
        direccion=negocio.direccion,
        barrio=negocio.barrio,
        referencia=negocio.referencia,
    )


@router.get("/{reserva_id}")
def ver_reserva(
    slug: str, reserva_id: uuid.UUID, session: SesionPublica
) -> esquemas.ReservaPublica:
    negocio = buscar_negocio(session, slug)
    with sesion_de_negocio(negocio.id) as s:
        reserva = _buscar(s, negocio, reserva_id)
        # Si se le pasó el tiempo, se muestra vencida aunque la tarea no haya corrido.
        if reserva.estado == "pendiente_pago" and reserva.vence_a and reserva.vence_a <= ahora():
            reserva.estado = "vencida"
            s.commit()
        return _publica(s, negocio, reserva)


@router.post("/{reserva_id}/simular-pago")
def simular_pago(
    slug: str, reserva_id: uuid.UUID, session: SesionPublica
) -> esquemas.ReservaPublica:
    """SOLO DESARROLLO: acredita un pago aprobado por el mismo camino que el webhook."""
    negocio = buscar_negocio(session, slug)
    proveedor = proveedor_para(negocio)
    if not isinstance(proveedor, ProveedorSimulado):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa reserva.")
    with sesion_de_negocio(negocio.id) as s:
        reserva = _buscar(s, negocio, reserva_id)
        # Como con Mercado Pago: el cobro vence junto con la reserva.
        if reserva.estado != "pendiente_pago" or not reserva.vence_a or reserva.vence_a <= ahora():
            raise HTTPException(status.HTTP_409_CONFLICT, "Esta reserva ya no se puede pagar.")
        resultado = acreditar_pago(s, negocio, ProveedorSimulado.pago_aprobado(reserva))
        if resultado is not Resultado.CONFIRMADA:
            s.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Esta reserva ya no se puede pagar.")
        s.commit()
        return _publica(s, negocio, reserva)
