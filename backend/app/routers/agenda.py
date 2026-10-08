"""Agenda del panel (/panel/{slug}/agenda y /reservas). La manejan el dueño y los empleados.

Todo corre con la sesión del negocio (RLS) y filtra por negocio_id. Las reglas de que
dos reservas no se pisen las pone la base: acá solo se traducen los errores.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.dependencias import PanelActual
from app.models import BloqueoFijo, Cliente, Deporte, Negocio, Recurso, Reserva
from app.schemas import agenda as esquemas
from app.services.agenda import (
    agenda_del_dia,
    minutos_para_pagar,
    resumen,
    saldo,
    saldo_efectivo,
)
from app.services.bloqueos_fijos import Ocurrencia, esta_bloqueado, ocurrencias
from app.services.cancelaciones import cancelar
from app.services.cobros import devolucion_de, devolver, pago_aprobado_de, proveedor_para
from app.services.disponibilidad import (
    ahora,
    hoy_en_el_negocio,
    reservas_que_ocupan,
    zona_del_negocio,
)
from app.services.reservas import (
    EXCLUSION_VIOLATION,
    DatosCliente,
    TurnoInvalido,
    TurnoNoDisponible,
    esperar_turno_para_reservar,
    reservar,
    turno_de_la_cancha,
)
from app.services.sena import calcular_sena
from app.services.turnos import se_superponen

router = APIRouter(prefix="/panel/{slug}", tags=["agenda"])

# Hasta dónde se puede mirar la agenda (para atrás, para ver lo que pasó).
DIAS_PARA_ATRAS = 60
DIAS_PARA_ADELANTE = 90


def _validar_fecha(negocio: Negocio, fecha: date | None) -> date:
    hoy = hoy_en_el_negocio(negocio)
    fecha = fecha or hoy
    if (
        not hoy - timedelta(days=DIAS_PARA_ATRAS)
        <= fecha
        <= hoy + timedelta(days=DIAS_PARA_ADELANTE)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esa fecha está fuera de la agenda.")
    return fecha


def _hora(momento, negocio: Negocio) -> str:
    return momento.astimezone(zona_del_negocio(negocio)).strftime("%H:%M")


@router.get("/agenda")
def ver_agenda(panel: PanelActual, fecha: date | None = None) -> esquemas.Agenda:
    negocio = panel.negocio
    fecha = _validar_fecha(negocio, fecha)
    momento = ahora()
    with sesion_de_negocio(negocio.id) as s:
        canchas = agenda_del_dia(s, negocio, fecha)
        total = resumen(canchas)
        return esquemas.Agenda(
            fecha=fecha,
            hoy=hoy_en_el_negocio(negocio),
            resumen=esquemas.Resumen(**vars(total)),
            canchas=[
                esquemas.CanchaEnAgenda(
                    id=c.recurso.id,
                    nombre=c.recurso.nombre,
                    deporte=c.deporte.codigo,
                    deporte_nombre=c.deporte.nombre,
                    caracteristicas=c.recurso.caracteristicas,
                    turnos=[
                        esquemas.TurnoEnAgenda(
                            inicio=t.turno.inicio,
                            fin=t.turno.fin,
                            hora=_hora(t.turno.inicio, negocio),
                            hora_fin=_hora(t.turno.fin, negocio),
                            precio=t.turno.precio,
                            sena=calcular_sena(negocio, t.turno.precio),
                            pasado=t.turno.fin <= momento,
                            reserva=esquemas.ReservaEnAgenda(
                                id=t.reserva.id,
                                estado=t.reserva.estado,
                                cliente=t.cliente.nombre if t.cliente else None,
                                precio=t.reserva.precio,
                                sena=t.reserva.sena,
                                sena_en_efectivo=t.reserva.sena_en_efectivo,
                                saldo=saldo(t.reserva),
                                saldo_cobrado=t.reserva.saldo_cobrado,
                                saldo_efectivo=saldo_efectivo(t.reserva),
                                saldo_en_efectivo=t.reserva.saldo_en_efectivo,
                                origen=t.reserva.origen,
                                asistencia=t.reserva.asistencia,
                                motivo_bloqueo=t.reserva.motivo_bloqueo,
                                minutos_para_pagar=minutos_para_pagar(t.reserva),
                            )
                            if t.reserva
                            else _fijo_en_agenda(t.fijo)
                            if t.fijo
                            else None,
                        )
                        for t in c.turnos
                    ],
                )
                for c in canchas
            ],
        )


@router.get("/semana")
def ver_semana(panel: PanelActual, desde: date | None = None) -> list[esquemas.DiaDeLaSemana]:
    negocio = panel.negocio
    desde = _validar_fecha(negocio, desde)
    dias = []
    with sesion_de_negocio(negocio.id) as s:
        for i in range(7):
            fecha = desde + timedelta(days=i)
            total = resumen(agenda_del_dia(s, negocio, fecha))
            dias.append(
                esquemas.DiaDeLaSemana(
                    fecha=fecha,
                    ocupados=total.ocupados,
                    libres=total.libres,
                    bloqueados=total.bloqueados,
                )
            )
    return dias


# --- Reservas ---


def _buscar_reserva(s: Session, panel, reserva_id: uuid.UUID) -> Reserva:
    reserva = s.scalar(
        select(Reserva).where(Reserva.id == reserva_id, Reserva.negocio_id == panel.negocio_id)
    )
    if reserva is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa reserva.")
    return reserva


def _detalle(s: Session, negocio: Negocio, reserva: Reserva) -> esquemas.ReservaDetalle:
    recurso, deporte = s.execute(
        select(Recurso, Deporte)
        .join(Deporte, Deporte.id == Recurso.deporte_id)
        .where(Recurso.id == reserva.recurso_id, Recurso.negocio_id == negocio.id)
    ).one()
    cliente = s.get(Cliente, reserva.cliente_id) if reserva.cliente_id else None
    zona = zona_del_negocio(negocio)
    devuelto = devolucion_de(s, negocio, reserva)
    return esquemas.ReservaDetalle(
        id=reserva.id,
        estado=reserva.estado,
        cancha_id=recurso.id,
        cancha=recurso.nombre,
        deporte=deporte.codigo,
        deporte_nombre=deporte.nombre,
        fecha=reserva.inicio.astimezone(zona).date(),
        inicio=reserva.inicio,
        fin=reserva.fin,
        hora=_hora(reserva.inicio, negocio),
        hora_fin=_hora(reserva.fin, negocio),
        precio=reserva.precio,
        sena=reserva.sena,
        sena_en_efectivo=reserva.sena_en_efectivo,
        saldo=saldo(reserva),
        saldo_cobrado=reserva.saldo_cobrado,
        saldo_efectivo=saldo_efectivo(reserva),
        saldo_en_efectivo=reserva.saldo_en_efectivo,
        asistencia=reserva.asistencia,
        origen=reserva.origen,
        motivo_bloqueo=reserva.motivo_bloqueo,
        minutos_para_pagar=minutos_para_pagar(reserva),
        cliente=esquemas.Cliente(
            nombre=cliente.nombre, telefono=cliente.telefono, email=cliente.email
        )
        if cliente
        else None,
        creado_a=reserva.creado_a,
        sena_online=pago_aprobado_de(s, negocio, reserva) is not None,
        devolucion=devuelto.devolucion if devuelto else None,
    )


def _cancha(s: Session, panel, recurso_id: uuid.UUID) -> tuple[Recurso, Deporte]:
    fila = s.execute(
        select(Recurso, Deporte)
        .join(Deporte, Deporte.id == Recurso.deporte_id)
        .where(Recurso.id == recurso_id, Recurso.negocio_id == panel.negocio_id)
    ).first()
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa cancha.")
    return fila


@router.post("/reservas", status_code=status.HTTP_201_CREATED)
def cargar_reserva(datos: esquemas.ReservaManual, panel: PanelActual) -> esquemas.ReservaDetalle:
    """Reserva de alguien que llamó o vino. Nace confirmada y ocupa el turno para la web."""
    with sesion_de_negocio(panel.negocio_id) as s:
        _, deporte = _cancha(s, panel, datos.recurso_id)
        try:
            reserva = reservar(
                s,
                panel.negocio,
                deporte_codigo=deporte.codigo,
                recurso_id=datos.recurso_id,
                inicio=datos.inicio,
                cliente=DatosCliente(datos.nombre, datos.telefono, datos.email),
                origen="panel",
                estado="confirmada",
                cobrar_sena=datos.sena_en_efectivo,
                sena_en_efectivo=datos.sena_en_efectivo,
                creado_por=panel.usuario.id,
            )
        except TurnoNoDisponible as error:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ese turno ya está ocupado.") from error
        except (TurnoInvalido, ValueError) as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
        s.commit()
        return _detalle(s, panel.negocio, reserva)


@router.get("/reservas/{reserva_id}")
def ver_reserva(reserva_id: uuid.UUID, panel: PanelActual) -> esquemas.ReservaDetalle:
    with sesion_de_negocio(panel.negocio_id) as s:
        return _detalle(s, panel.negocio, _buscar_reserva(s, panel, reserva_id))


@router.patch("/reservas/{reserva_id}")
def cambiar_reserva(
    reserva_id: uuid.UUID, cambios: esquemas.CambiosDeReserva, panel: PanelActual
) -> esquemas.ReservaDetalle:
    """Marcar si vino o no vino, y si el saldo se cobró en la cancha."""
    with sesion_de_negocio(panel.negocio_id) as s:
        reserva = _buscar_reserva(s, panel, reserva_id)
        if reserva.estado != "confirmada":
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Solo se marcan las reservas confirmadas."
            )
        for campo, valor in cambios.model_dump(exclude_unset=True).items():
            setattr(reserva, campo, valor)
        s.commit()
        return _detalle(s, panel.negocio, reserva)


@router.post("/reservas/{reserva_id}/cancelar")
def cancelar_reserva(
    reserva_id: uuid.UUID, panel: PanelActual, datos: esquemas.Cancelacion | None = None
) -> esquemas.ReservaDetalle:
    """Cancela una reserva o levanta un bloqueo, con sus espejos de canchas combinadas.
    Si la seña se pagó online, se devuelve salvo que el dueño elija no hacerlo."""
    datos = datos or esquemas.Cancelacion()
    with sesion_de_negocio(panel.negocio_id) as s:
        reserva = _buscar_reserva(s, panel, reserva_id)
        if reserva.estado not in ("pendiente_pago", "confirmada", "bloqueada"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Esa reserva ya no está activa."
            )
        pago = cancelar(s, panel.negocio, reserva, devolver_sena=datos.devolver_sena)
        s.commit()
        if pago is not None:
            devolver(s, panel.negocio, pago, proveedor_para(panel.negocio))
        return _detalle(s, panel.negocio, reserva)


@router.post("/reservas/{reserva_id}/mover")
def mover_reserva(
    reserva_id: uuid.UUID, destino: esquemas.Movimiento, panel: PanelActual
) -> esquemas.ReservaDetalle:
    """A otra cancha del mismo deporte y/o a otro horario libre."""
    with sesion_de_negocio(panel.negocio_id) as s:
        reserva = _buscar_reserva(s, panel, reserva_id)
        if reserva.estado not in ("pendiente_pago", "confirmada"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Solo se mueven reservas activas."
            )
        _, deporte_actual = _cancha(s, panel, reserva.recurso_id)
        cancha, deporte = _cancha(s, panel, destino.recurso_id)
        if deporte.id != deporte_actual.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Solo se puede mover a una cancha del mismo deporte.",
            )
        turno = turno_de_la_cancha(s, panel.negocio, cancha, destino.inicio)
        if turno is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Ese horario no es un turno de esa cancha."
            )
        if esta_bloqueado(s, panel.negocio, cancha.id, turno.inicio, turno.fin):
            raise HTTPException(status.HTTP_409_CONFLICT, "Ese horario tiene un bloqueo fijo.")
        esperar_turno_para_reservar(s, panel.negocio_id)
        reserva.recurso_id, reserva.inicio, reserva.fin = cancha.id, turno.inicio, turno.fin
        reserva.precio, reserva.precio_efectivo = turno.precio, turno.precio_efectivo
        try:
            s.commit()
        except IntegrityError as error:
            if getattr(error.orig, "sqlstate", None) == EXCLUSION_VIOLATION:
                raise HTTPException(
                    status.HTTP_409_CONFLICT, "Ese turno ya está ocupado."
                ) from error
            raise
        return _detalle(s, panel.negocio, reserva)


# --- Bloqueos ---


@router.post("/bloqueos")
def bloquear(datos: esquemas.Bloqueo, panel: PanelActual) -> esquemas.ResultadoDeBloqueo:
    """Cierra uno o varios turnos (torneo, lluvia, mantenimiento). Los que ya están
    ocupados se saltean: se informan como omitidos."""
    bloqueados = omitidos = 0
    with sesion_de_negocio(panel.negocio_id) as s:
        canchas = {
            r.id: r
            for r in s.scalars(
                select(Recurso).where(
                    Recurso.negocio_id == panel.negocio_id,
                    Recurso.id.in_({t.recurso_id for t in datos.turnos}),
                )
            )
        }
        esperar_turno_para_reservar(s, panel.negocio_id)
        for pedido in datos.turnos:
            cancha = canchas.get(pedido.recurso_id)
            turno = turno_de_la_cancha(s, panel.negocio, cancha, pedido.inicio) if cancha else None
            if turno is None:
                omitidos += 1
                continue
            try:
                with s.begin_nested():
                    s.add(
                        Reserva(
                            negocio_id=panel.negocio_id,
                            recurso_id=cancha.id,
                            inicio=turno.inicio,
                            fin=turno.fin,
                            estado="bloqueada",
                            motivo_bloqueo=datos.motivo,
                            origen="panel",
                            creado_por=panel.usuario.id,
                        )
                    )
                    s.flush()
                bloqueados += 1
            except IntegrityError as error:
                if getattr(error.orig, "sqlstate", None) != EXCLUSION_VIOLATION:
                    raise
                omitidos += 1
        s.commit()
    return esquemas.ResultadoDeBloqueo(bloqueados=bloqueados, omitidos=omitidos)


def _fijo_en_agenda(fijo: Ocurrencia) -> esquemas.ReservaEnAgenda:
    return esquemas.ReservaEnAgenda(
        id=fijo.bloqueo_id,
        estado="bloqueada",
        cliente=None,
        precio=None,
        sena=Decimal("0"),
        sena_en_efectivo=False,
        saldo=Decimal("0"),
        saldo_cobrado=False,
        origen="panel",
        asistencia=None,
        motivo_bloqueo=fijo.motivo,
        minutos_para_pagar=None,
        fijo=True,
    )


# --- Bloqueos fijos (todas las semanas) ---


def _texto_fijo(b: BloqueoFijo, canchas: dict[uuid.UUID, str]) -> esquemas.BloqueoFijo:
    return esquemas.BloqueoFijo(
        id=b.id,
        dia_semana=b.dia_semana,
        desde=b.desde,
        hasta=b.hasta,
        recurso_id=b.recurso_id,
        cancha=canchas.get(b.recurso_id) if b.recurso_id else None,
        motivo=b.motivo,
    )


def _nombres_de_canchas(s: Session, negocio_id: uuid.UUID) -> dict[uuid.UUID, str]:
    return dict(
        s.execute(select(Recurso.id, Recurso.nombre).where(Recurso.negocio_id == negocio_id)).all()
    )


@router.get("/bloqueos-fijos")
def ver_bloqueos_fijos(panel: PanelActual) -> list[esquemas.BloqueoFijo]:
    with sesion_de_negocio(panel.negocio_id) as s:
        canchas = _nombres_de_canchas(s, panel.negocio_id)
        filas = s.scalars(
            select(BloqueoFijo)
            .where(BloqueoFijo.negocio_id == panel.negocio_id)
            .order_by(BloqueoFijo.dia_semana, BloqueoFijo.desde)
        )
        return [_texto_fijo(b, canchas) for b in filas]


@router.post("/bloqueos-fijos", status_code=status.HTTP_201_CREATED)
def crear_bloqueo_fijo(
    datos: esquemas.NuevoBloqueoFijo, panel: PanelActual
) -> esquemas.BloqueoFijoCreado:
    """Bloquea ese día y horario todas las semanas. No cancela reservas que ya existan:
    avisa cuántas hay en las próximas 8 semanas para que el dueño decida."""
    if datos.desde == datos.hasta:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "El horario tiene que durar algo."
        )
    with sesion_de_negocio(panel.negocio_id) as s:
        canchas = _nombres_de_canchas(s, panel.negocio_id)
        if datos.recurso_id is not None and datos.recurso_id not in canchas:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa cancha.")
        bloqueo = BloqueoFijo(negocio_id=panel.negocio_id, **datos.model_dump())
        s.add(bloqueo)
        s.flush()
        momento = ahora()
        ids = [datos.recurso_id] if datos.recurso_id else list(canchas)
        fijos = ocurrencias(s, panel.negocio, ids, momento, momento + timedelta(weeks=8))
        existentes = {
            r.id
            for r in reservas_que_ocupan(
                s, panel.negocio_id, ids, momento, momento + timedelta(weeks=8)
            )
            if r.cliente_id is not None
            and any(
                o.bloqueo_id == bloqueo.id and se_superponen(r.inicio, r.fin, o.inicio, o.fin)
                for o in fijos.get(r.recurso_id, [])
            )
        }
        s.commit()
        return esquemas.BloqueoFijoCreado(
            bloqueo=_texto_fijo(bloqueo, canchas), reservas_existentes=len(existentes)
        )


@router.delete("/bloqueos-fijos/{bloqueo_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_bloqueo_fijo(bloqueo_id: uuid.UUID, panel: PanelActual) -> None:
    with sesion_de_negocio(panel.negocio_id) as s:
        bloqueo = s.scalar(
            select(BloqueoFijo).where(
                BloqueoFijo.id == bloqueo_id, BloqueoFijo.negocio_id == panel.negocio_id
            )
        )
        if bloqueo is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese bloqueo.")
        s.delete(bloqueo)
        s.commit()
