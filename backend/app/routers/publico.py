"""Rutas públicas: sin login. Las usan la página principal y la página de cada complejo."""

import re
import unicodedata
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session, sesion_de_negocio
from app.models import Deporte, Foto, Horario, Negocio, Recurso
from app.schemas import publico as esquemas
from app.services import ia
from app.services.cobros import proveedor_para
from app.services.disponibilidad import (
    disponibilidad,
    hoy_en_el_negocio,
    proximo_turno_libre,
    zona_del_negocio,
)

# Hasta cuántos días para adelante se puede reservar.
DIAS_RESERVABLES = 30

router = APIRouter(prefix="/publico", tags=["público"])

SesionPublica = Annotated[Session, Depends(get_session)]


def negocios_visibles():
    return select(Negocio).where(Negocio.activo, Negocio.estado_cuenta != "suspendido")


def buscar_negocio(session: Session, slug: str) -> Negocio:
    negocio = session.scalar(negocios_visibles().where(Negocio.slug == slug))
    if negocio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese complejo.")
    return negocio


def deportes_del_negocio(
    session: Session, negocio_id: uuid.UUID
) -> list[esquemas.DeporteDelComplejo]:
    """Deportes con canchas activas del negocio, en el orden de sus canchas."""
    filas = session.execute(
        select(Deporte, Recurso)
        .join(Recurso, Recurso.deporte_id == Deporte.id)
        .where(Recurso.negocio_id == negocio_id, Recurso.activo)
        .order_by(Recurso.orden, Recurso.nombre)
    ).all()
    precios = dict(
        session.execute(
            select(Horario.recurso_id, func.min(Horario.precio))
            .where(Horario.negocio_id == negocio_id)
            .group_by(Horario.recurso_id)
        ).all()
    )
    duraciones: dict[uuid.UUID, set[int]] = {}
    for recurso_id, duracion in session.execute(
        select(Horario.recurso_id, Horario.duracion_turno_min)
        .where(Horario.negocio_id == negocio_id)
        .distinct()
    ):
        duraciones.setdefault(recurso_id, set()).add(duracion)

    resultado: dict[str, esquemas.DeporteDelComplejo] = {}
    for deporte, recurso in filas:
        item = resultado.setdefault(
            deporte.codigo,
            esquemas.DeporteDelComplejo(
                codigo=deporte.codigo,
                nombre=deporte.nombre,
                duraciones_min=[],
                precio_desde=None,
                canchas=[],
            ),
        )
        item.canchas.append(
            esquemas.Cancha(
                id=recurso.id, nombre=recurso.nombre, caracteristicas=recurso.caracteristicas
            )
        )
        precio = precios.get(recurso.id)
        if precio is not None and (item.precio_desde is None or precio < item.precio_desde):
            item.precio_desde = precio
        item.duraciones_min = sorted(set(item.duraciones_min) | duraciones.get(recurso.id, set()))
    return list(resultado.values())


@router.get("/complejos")
def listar_complejos(
    session: SesionPublica, deporte: str | None = None
) -> list[esquemas.ComplejoResumen]:
    resumenes = []
    for negocio in session.scalars(negocios_visibles().order_by(Negocio.nombre)):
        with sesion_de_negocio(negocio.id) as s:
            deportes = deportes_del_negocio(s, negocio.id)
            # Un complejo recién dado de alta, sin canchas, todavía no se muestra.
            if not deportes or (deporte and all(d.codigo != deporte for d in deportes)):
                continue
            caracteristicas = caracteristicas_de(deportes)
            codigos = [deporte] if deporte else [d.codigo for d in deportes]
            proximo = proximo_turno_libre(s, negocio, codigos)
        zona = zona_del_negocio(negocio)
        resumenes.append(
            esquemas.ComplejoResumen(
                slug=negocio.slug,
                nombre=negocio.nombre,
                barrio=negocio.barrio,
                logo_url=negocio.logo_url,
                portada_url=negocio.portada_url,
                color_primario=negocio.color_primario,
                color_secundario=negocio.color_secundario,
                deportes=[esquemas.Deporte(codigo=d.codigo, nombre=d.nombre) for d in deportes],
                hoy=hoy_en_el_negocio(negocio),
                latitud=negocio.latitud,
                longitud=negocio.longitud,
                caracteristicas=caracteristicas,
                proximo_turno=esquemas.ProximoTurno(
                    fecha=proximo.inicio.astimezone(zona).date(),
                    hora=proximo.inicio.astimezone(zona).strftime("%H:%M"),
                )
                if proximo
                else None,
            )
        )
    return resumenes


@router.get("/complejos/{slug}")
def ver_complejo(slug: str, session: SesionPublica) -> esquemas.ComplejoDetalle:
    negocio = buscar_negocio(session, slug)
    with sesion_de_negocio(negocio.id) as s:
        deportes = deportes_del_negocio(s, negocio.id)
        fotos = list(
            s.scalars(
                select(Foto.url)
                .where(Foto.negocio_id == negocio.id)
                .order_by(Foto.orden, Foto.creado_a)
            )
        )
    return esquemas.ComplejoDetalle(
        slug=negocio.slug,
        nombre=negocio.nombre,
        barrio=negocio.barrio,
        direccion=negocio.direccion,
        referencia=negocio.referencia,
        whatsapp=negocio.whatsapp,
        asistente={
            "nombre": negocio.asistente_nombre or "Asistente",
            "bienvenida": negocio.asistente_bienvenida
            or f"¡Hola! Soy el asistente de {negocio.nombre}. ¿En qué te ayudo?",
        }
        if get_settings().asistentes_de_complejo and negocio.asistente_activo and ia.disponible()
        else None,
        servicios=negocio.servicios,
        logo_url=negocio.logo_url,
        portada_url=negocio.portada_url,
        color_primario=negocio.color_primario,
        color_secundario=negocio.color_secundario,
        hoy=hoy_en_el_negocio(negocio),
        dias_reservables=DIAS_RESERVABLES,
        sena_tipo=negocio.sena_tipo,
        sena_valor=negocio.sena_valor,
        horas_cancelacion=negocio.horas_cancelacion,
        minutos_para_pagar=negocio.minutos_para_pagar,
        reservas_online=proveedor_para(negocio) is not None,
        deportes=deportes,
        fotos=fotos,
    )


def caracteristicas_de(deportes: list[esquemas.DeporteDelComplejo]) -> list[str]:
    """Las características de las canchas ("techada, sintético") como lista sin repetir."""
    vistas: dict[str, str] = {}
    for deporte in deportes:
        for cancha in deporte.canchas:
            for parte in re.split(r"[,;/]|\by\b", cancha.caracteristicas or ""):
                parte = parte.strip()
                clave = "".join(
                    c
                    for c in unicodedata.normalize("NFD", parte.lower())
                    if unicodedata.category(c) != "Mn"
                )
                if parte and clave not in vistas:
                    vistas[clave] = parte[:1].upper() + parte[1:]
    return list(vistas.values())


@router.get("/libres")
def complejos_con_lugar(
    session: SesionPublica,
    fecha: date,
    hora: time | None = None,
    deporte: str | None = None,
    caracteristicas: Annotated[list[str] | None, Query()] = None,
) -> list[esquemas.ComplejoConLugar]:
    """Mapa general: qué complejos tienen lugar ese día (y desde esa hora, dentro de la
    hora siguiente), con cuántas canchas libres en el primer horario que encaja."""
    from app.services.buscador import buscar_turnos

    hoy = date.today()
    if not hoy - timedelta(days=1) <= fecha <= hoy + timedelta(days=DIAS_RESERVABLES):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Elegí una fecha más cercana.")
    hasta = None
    if hora is not None:
        fin = datetime.combine(fecha, hora) + timedelta(minutes=59)
        hasta = fin.time() if fin.date() == fecha else time(23, 59)
    turnos = buscar_turnos(
        session,
        fecha=fecha,
        deporte=deporte,
        hora_desde=hora,
        hora_hasta=hasta,
        caracteristicas=caracteristicas,
        limite=None,
    )
    por_complejo: dict[str, list] = {}
    for turno in turnos:
        por_complejo.setdefault(turno.slug, []).append(turno)
    resultado = []
    for slug, lista in por_complejo.items():
        primera = min(t.hora for t in lista)
        en_la_primera = [t for t in lista if t.hora == primera]
        resultado.append(
            esquemas.ComplejoConLugar(
                slug=slug,
                fecha=fecha,
                deporte_codigo=en_la_primera[0].deporte_codigo,
                hora=primera,
                canchas=len(en_la_primera),
                horas=sorted({t.hora for t in lista})[:4],
                precio_desde=min(Decimal(t.precio) for t in lista),
            )
        )
    return resultado


@router.get("/complejos/{slug}/disponibilidad")
def ver_disponibilidad(
    slug: str,
    session: SesionPublica,
    deporte: Annotated[str, Query(min_length=1)],
    fecha: date | None = None,
) -> esquemas.Disponibilidad:
    negocio = buscar_negocio(session, slug)
    hoy = hoy_en_el_negocio(negocio)
    fecha = fecha or hoy
    if not hoy <= fecha < hoy + timedelta(days=DIAS_RESERVABLES):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Elegí un día entre hoy y los próximos {DIAS_RESERVABLES} días.",
        )

    zona = zona_del_negocio(negocio)
    with sesion_de_negocio(negocio.id) as s:
        turnos = disponibilidad(s, negocio, deporte, fecha)
        return esquemas.Disponibilidad(
            fecha=fecha,
            deporte=deporte,
            turnos=[
                esquemas.Turno(
                    inicio=t.inicio,
                    fin=t.fin,
                    hora=t.inicio.astimezone(zona).strftime("%H:%M"),
                    hora_fin=t.fin.astimezone(zona).strftime("%H:%M"),
                    duracion_min=int((t.fin - t.inicio).total_seconds() // 60),
                    precio=t.precio,
                    canchas_total=t.canchas_total,
                    libres=[
                        esquemas.CanchaLibre(
                            id=c.recurso.id,
                            nombre=c.recurso.nombre,
                            caracteristicas=c.recurso.caracteristicas,
                            precio=c.precio,
                            sena=c.sena,
                        )
                        for c in t.libres
                    ],
                )
                for t in turnos
            ],
        )
