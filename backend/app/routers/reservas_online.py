"""Reserva online del jugador: crear la reserva pendiente, verla, pagar la seña, cancelarla
y cambiarle el horario.

El turno queda en `pendiente_pago` hasta que se acredita el pago (webhook de Mercado Pago
o, solo en desarrollo, el pago simulado). El jugador no necesita cuenta: para cancelar o
cambiar el horario confirma con el teléfono que usó al reservar.
"""

import hashlib
import hmac
import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session, sesion_de_negocio
from app.models import Cliente, Deporte, Negocio, Recurso, Reserva
from app.routers.publico import DIAS_RESERVABLES, buscar_negocio
from app.schemas import reserva_online as esquemas
from app.services import avisos
from app.services.agenda import saldo
from app.services.cancelaciones import (
    CambioNoPermitido,
    a_tiempo,
    cambiar_como_jugador,
    cancelar_como_jugador,
    limite_para_cancelar,
    puede_cambiar,
)
from app.services.cobros import (
    ErrorDePago,
    ProveedorSimulado,
    Resultado,
    acreditar_pago,
    devolucion_de,
    devolver,
    link_de_la_reserva,
    nuevo_codigo,
    pago_aprobado_de,
    proveedor_para,
)
from app.services.disponibilidad import ahora, hoy_en_el_negocio, zona_del_negocio
from app.services.reservas import (
    DatosCliente,
    TurnoInvalido,
    TurnoNoDisponible,
    normalizar_telefono,
    reservar,
)

router = APIRouter(prefix="/publico/complejos/{slug}/reservas", tags=["reserva online"])

SesionPublica = Annotated[Session, Depends(get_session)]

# Reservas esperando el pago al mismo tiempo, por complejo: por teléfono y por conexión.
MAX_PENDIENTES_POR_TELEFONO = 2
MAX_PENDIENTES_POR_CONEXION = 4

MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def _descripcion(negocio: Negocio, cancha: str, reserva: Reserva) -> str:
    """Lo que ve el jugador en Mercado Pago: "Seña: Cancha 1, sáb 3/10 21:00"."""
    inicio = reserva.inicio.astimezone(zona_del_negocio(negocio))
    return f"Seña: {cancha}, {DIAS[inicio.weekday()]} {inicio.day}/{inicio.month} {inicio:%H:%M}"


def _conexion(request: Request) -> str:
    """La conexión del jugador, transformada con una clave (no se guarda la IP).

    Detrás del proxy de Render, la IP real es la última de X-Forwarded-For (la que agrega
    el proxy; las anteriores las puede inventar cualquiera)."""
    reenviada = request.headers.get("x-forwarded-for", "")
    ip = reenviada.split(",")[-1].strip() if reenviada else ""
    ip = ip or (request.client.host if request.client else "desconocida")
    clave = get_settings().jwt_secret.encode()
    return hmac.new(clave, f"conexion:{ip}".encode(), hashlib.sha256).hexdigest()[:32]


def _pendientes(session: Session, negocio: Negocio, *condiciones) -> int:
    return session.scalar(
        select(func.count())
        .select_from(Reserva)
        .join(Cliente, Cliente.id == Reserva.cliente_id)
        .where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado == "pendiente_pago",
            Reserva.vence_a > ahora(),
            *condiciones,
        )
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def reservar_online(
    slug: str, datos: esquemas.NuevaReserva, request: Request, session: SesionPublica
) -> esquemas.ReservaCreada:
    negocio = buscar_negocio(session, slug)
    proveedor = proveedor_para(negocio)
    if proveedor is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Este complejo todavía no toma reservas online."
        )
    # La página solo ofrece turnos por venir dentro del plazo; el backend lo exige igual.
    if datos.inicio <= ahora():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Ese turno ya empezó. Elegí otro."
        )
    fecha = datos.inicio.astimezone(zona_del_negocio(negocio)).date()
    if fecha >= hoy_en_el_negocio(negocio) + timedelta(days=DIAS_RESERVABLES):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Se puede reservar hasta {DIAS_RESERVABLES} días para adelante.",
        )

    conexion = _conexion(request)
    telefono = normalizar_telefono(datos.telefono)
    with sesion_de_negocio(negocio.id) as s:
        if (
            _pendientes(s, negocio, Cliente.telefono == telefono) >= MAX_PENDIENTES_POR_TELEFONO
            or _pendientes(s, negocio, Reserva.conexion == conexion) >= MAX_PENDIENTES_POR_CONEXION
        ):
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

        reserva.conexion = conexion
        reserva.codigo = nuevo_codigo(negocio, reserva)
        cancha = s.get(Recurso, reserva.recurso_id).nombre
        try:
            reserva.url_pago = proveedor.crear_cobro(
                negocio, reserva, _descripcion(negocio, cancha, reserva)
            )
        except ErrorDePago as error:
            # Sin link de pago no se guarda la reserva: el turno sigue libre.
            s.rollback()
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "No pudimos preparar el pago con Mercado Pago. Probá de nuevo en un minuto.",
            ) from error
        s.commit()
        return esquemas.ReservaCreada(
            id=reserva.id, url_pago=reserva.url_pago, link=link_de_la_reserva(negocio, reserva)
        )


def _buscar(
    s: Session, negocio: Negocio, reserva_id: uuid.UUID | None = None, codigo: str | None = None
) -> Reserva:
    clave = Reserva.id == reserva_id if codigo is None else Reserva.codigo == codigo.lower()
    reserva = s.scalar(
        select(Reserva)
        .where(
            clave,
            Reserva.negocio_id == negocio.id,
            Reserva.origen == "web",
        )
        .with_for_update()
    )
    if reserva is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa reserva.")
    # Si se le pasó el tiempo para pagar, está vencida aunque la tarea no haya corrido.
    if reserva.estado == "pendiente_pago" and reserva.vence_a and reserva.vence_a <= ahora():
        reserva.estado, reserva.url_pago = "vencida", None
        s.flush()
    return reserva


def _del_jugador(s: Session, negocio: Negocio, reserva_id: uuid.UUID, telefono: str) -> Reserva:
    """La reserva, si el teléfono es el que se usó al reservar."""
    reserva = _buscar(s, negocio, reserva_id)
    cliente = s.get(Cliente, reserva.cliente_id)
    if cliente is None or not hmac.compare_digest(cliente.telefono, normalizar_telefono(telefono)):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Ese no es el teléfono con el que se hizo la reserva."
        )
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
    activa = reserva.estado in ("pendiente_pago", "confirmada") and reserva.inicio > ahora()
    pagada = pago_aprobado_de(s, negocio, reserva) is not None
    devuelto = devolucion_de(s, negocio, reserva)
    return esquemas.ReservaPublica(
        id=reserva.id,
        link=link_de_la_reserva(negocio, reserva),
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
        saldo=saldo(reserva),
        vence_a=reserva.vence_a if pendiente else None,
        url_pago=reserva.url_pago if pendiente else None,
        pago_simulado=pendiente and proveedor is not None and proveedor.simulado,
        horas_cancelacion=negocio.horas_cancelacion,
        direccion=negocio.direccion,
        barrio=negocio.barrio,
        referencia=negocio.referencia,
        deporte_codigo=deporte.codigo,
        cancha_id=recurso.id,
        sena_pagada=pagada,
        cancelable_hasta=limite_para_cancelar(negocio, reserva),
        puede_cancelar=activa,
        recupera_sena=pagada and a_tiempo(negocio, reserva),
        puede_cambiar=activa and puede_cambiar(negocio, reserva),
        ya_cambio_horario=reserva.cambios_de_horario > 0,
        devolucion=devuelto.devolucion if devuelto else None,
        monto_devuelto=devuelto.monto if devuelto else None,
    )


@router.get("/{reserva_id}")
def ver_reserva(
    slug: str, reserva_id: uuid.UUID, session: SesionPublica
) -> esquemas.ReservaPublica:
    negocio = buscar_negocio(session, slug)
    with sesion_de_negocio(negocio.id) as s:
        reserva = _buscar(s, negocio, reserva_id)
        s.commit()
        return _publica(s, negocio, reserva)


@router.get("/por-codigo/{codigo}")
def ver_reserva_por_codigo(
    slug: str, codigo: str, session: SesionPublica
) -> esquemas.ReservaPublica:
    """La reserva por el código de su link (/{slug}/r/{codigo})."""
    negocio = buscar_negocio(session, slug)
    with sesion_de_negocio(negocio.id) as s:
        reserva = _buscar(s, negocio, codigo=codigo)
        s.commit()
        return _publica(s, negocio, reserva)


@router.post("/{reserva_id}/cancelar")
def cancelar(
    slug: str,
    reserva_id: uuid.UUID,
    datos: esquemas.ConfirmacionDelJugador,
    session: SesionPublica,
    tareas: BackgroundTasks,
) -> esquemas.ReservaPublica:
    """Con la anticipación de la política del complejo, la seña se devuelve sola."""
    negocio = buscar_negocio(session, slug)
    with sesion_de_negocio(negocio.id) as s:
        reserva = _del_jugador(s, negocio, reserva_id, datos.telefono)
        confirmada = reserva.estado == "confirmada"
        try:
            pago = cancelar_como_jugador(s, negocio, reserva)
        except CambioNoPermitido as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
        s.commit()
        if pago is not None:
            devolver(s, negocio, pago, proveedor_para(negocio))
        if confirmada:  # una pendiente de pago que se cancela no le importa al dueño
            tareas.add_task(avisos.reserva_cancelada, negocio.id, reserva.id)
        return _publica(s, negocio, reserva)


@router.post("/{reserva_id}/cambiar")
def cambiar_horario(
    slug: str,
    reserva_id: uuid.UUID,
    datos: esquemas.CambioDeHorario,
    session: SesionPublica,
    tareas: BackgroundTasks,
) -> esquemas.ReservaPublica:
    """Una vez, con la anticipación de la política. La seña pagada se mantiene."""
    negocio = buscar_negocio(session, slug)
    with sesion_de_negocio(negocio.id) as s:
        reserva = _del_jugador(s, negocio, reserva_id, datos.telefono)
        antes = reserva.inicio
        try:
            cambiar_como_jugador(
                s, negocio, reserva, inicio=datos.inicio, recurso_id=datos.recurso_id
            )
        except CambioNoPermitido as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
        except TurnoNoDisponible as error:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ese horario ya no está disponible. Elegí otro."
            ) from error
        except TurnoInvalido as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
        s.commit()
        tareas.add_task(avisos.horario_cambiado, negocio.id, reserva.id, antes)
        return _publica(s, negocio, reserva)


@router.post("/{reserva_id}/simular-pago")
def simular_pago(
    slug: str, reserva_id: uuid.UUID, session: SesionPublica, tareas: BackgroundTasks
) -> esquemas.ReservaPublica:
    """SOLO DESARROLLO: acredita un pago aprobado por el mismo camino que el webhook."""
    negocio = buscar_negocio(session, slug)
    proveedor = proveedor_para(negocio)
    if not isinstance(proveedor, ProveedorSimulado):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa reserva.")
    with sesion_de_negocio(negocio.id) as s:
        reserva = _buscar(s, negocio, reserva_id)
        # Como con Mercado Pago: el cobro vence junto con la reserva.
        if reserva.estado != "pendiente_pago":
            s.commit()
            raise HTTPException(status.HTTP_409_CONFLICT, "Esta reserva ya no se puede pagar.")
        resultado = acreditar_pago(s, negocio, ProveedorSimulado.pago_aprobado(reserva))
        if resultado is not Resultado.CONFIRMADA:
            s.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Esta reserva ya no se puede pagar.")
        s.commit()
        tareas.add_task(avisos.reserva_confirmada, negocio.id, reserva.id)
        return _publica(s, negocio, reserva)
