"""Rutas públicas: sin login. Las usan la página principal y la página de cada complejo."""

import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_session, sesion_de_negocio
from app.models import Deporte, Horario, Negocio, Recurso
from app.schemas import publico as esquemas
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
            if deporte and all(d.codigo != deporte for d in deportes):
                continue
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
    return esquemas.ComplejoDetalle(
        slug=negocio.slug,
        nombre=negocio.nombre,
        barrio=negocio.barrio,
        direccion=negocio.direccion,
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
        deportes=deportes,
    )


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
