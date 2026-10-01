"""Asistentes de IA (fase 3). Por ahora, el buscador de la página principal.

Sin cuenta: la conversación la guarda el navegador y se manda entera en cada pedido
(solo los textos). Para cuidar el cupo del proveedor hay límites por conversación y por
conexión por día. Si el proveedor no está o se quedó sin cupo, se responde 503 con un
mensaje amable y la página sigue funcionando.
"""

import logging
import threading
import uuid
from collections import defaultdict
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session, sesion_de_negocio
from app.dependencias import PanelDeConfiguracion
from app.models import ConsultaSinRespuesta
from app.routers.reservas_online import _conexion
from app.services import buscador, ia

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/asistente", tags=["asistente"])

SesionPublica = Annotated[Session, Depends(get_session)]

MAX_MENSAJES_POR_CONVERSACION = 20
MAX_MENSAJES_POR_DIA = 40

_usados: dict[tuple[date, str], int] = defaultdict(int)
_candado = threading.Lock()


def _contar(conexion: str) -> bool:
    """Suma un mensaje de esta conexión hoy. False si ya llegó al tope del día.
    En memoria: alcanza con un solo servidor; se reinicia con cada deploy."""
    hoy = date.today()
    with _candado:
        for clave in [k for k in _usados if k[0] != hoy]:
            del _usados[clave]
        if _usados[(hoy, conexion)] >= MAX_MENSAJES_POR_DIA:
            return False
        _usados[(hoy, conexion)] += 1
        return True


class Mensaje(BaseModel):
    rol: Literal["usuario", "asistente"]
    texto: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


class Conversacion(BaseModel):
    mensajes: Annotated[list[Mensaje], Field(min_length=1, max_length=40)]


class ResultadoBusqueda(BaseModel):
    complejo: str
    slug: str
    barrio: str | None
    deporte: str
    deporte_codigo: str
    cancha: str
    caracteristicas: str | None
    fecha: date
    hora: str
    hora_fin: str
    precio: str
    sena: str


class RespuestaDelBuscador(BaseModel):
    respuesta: str
    resultados: list[ResultadoBusqueda]


NO_DISPONIBLE = "El asistente se tomó un descanso. Mientras tanto, buscá con los filtros de abajo."


@router.post("/buscar")
def buscar(datos: Conversacion, request: Request, session: SesionPublica) -> RespuestaDelBuscador:
    if datos.mensajes[-1].rol != "usuario":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Falta tu mensaje.")
    usuario = sum(1 for m in datos.mensajes if m.rol == "usuario")
    if usuario > MAX_MENSAJES_POR_CONVERSACION:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Esta charla ya es muy larga. Empezá una nueva búsqueda.",
        )
    if not ia.disponible():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE)
    if not _contar(_conexion(request)):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Llegaste al límite de búsquedas por hoy. Usá los filtros de abajo.",
        )
    # Solo los últimos mensajes: alcanza para el contexto y cuida el cupo.
    historial = [m.model_dump() for m in datos.mensajes[-10:]]
    try:
        texto, resultados = buscador.conversar(session, historial)
    except ia.ErrorDeIA as error:
        logger.warning("Buscador sin IA: %s", error)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE) from error
    return RespuestaDelBuscador(
        respuesta=texto,
        resultados=[ResultadoBusqueda(**vars(r)) for r in resultados],
    )


# --- Asistente de cada complejo ---


class TurnoDelAsistente(ResultadoBusqueda):
    pass


class RespuestaDelComplejo(BaseModel):
    respuesta: str
    turnos: list[TurnoDelAsistente]
    # Si dejó una reserva pendiente: el link de la reserva y el de pago.
    reserva: dict[str, str | None] | None


@router.post("/complejos/{slug}")
def charlar_con_el_complejo(
    slug: str, datos: Conversacion, request: Request, session: SesionPublica
) -> RespuestaDelComplejo:
    from app.routers.publico import buscar_negocio
    from app.routers.reservas_online import crear_reserva_online
    from app.schemas.reserva_online import NuevaReserva
    from app.services import asistente_complejo

    negocio = buscar_negocio(session, slug)
    if datos.mensajes[-1].rol != "usuario":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Falta tu mensaje.")
    if sum(1 for m in datos.mensajes if m.rol == "usuario") > MAX_MENSAJES_POR_CONVERSACION:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Esta charla ya es muy larga. Empezá una nueva."
        )
    if not negocio.asistente_activo or not ia.disponible():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE_COMPLEJO)
    conexion = _conexion(request)
    if not _contar(conexion):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Llegaste al límite de mensajes por hoy."
        )

    def reservar(a: dict) -> asistente_complejo.Reservado:
        nueva = NuevaReserva(
            deporte=str(a.get("deporte") or ""),
            inicio=asistente_complejo.inicio_del_turno(negocio, a.get("fecha"), a.get("hora")),
            nombre=str(a.get("nombre") or ""),
            telefono=str(a.get("telefono") or ""),
        )
        creada = crear_reserva_online(negocio, nueva, conexion, origen="bot")
        return asistente_complejo.Reservado(link=creada.link, url_pago=creada.url_pago)

    historial = [m.model_dump() for m in datos.mensajes[-10:]]
    try:
        texto, turnos, reserva = asistente_complejo.conversar(session, negocio, historial, reservar)
    except ia.ErrorDeIA as error:
        logger.warning("Asistente de %s sin IA: %s", slug, error)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DISPONIBLE_COMPLEJO) from error
    return RespuestaDelComplejo(
        respuesta=texto.replace("**", ""),
        turnos=[TurnoDelAsistente(**vars(t)) for t in turnos],
        reserva={"link": reserva.link, "url_pago": reserva.url_pago} if reserva else None,
    )


NO_DISPONIBLE_COMPLEJO = "El asistente se tomó un descanso. Podés elegir tu turno en la página."


# --- Panel: preguntas que el asistente no supo contestar ---

router_panel = APIRouter(prefix="/panel/{slug}/asistente", tags=["asistente"])


class ConsultaPendiente(BaseModel):
    id: uuid.UUID
    pregunta: str
    creado_a: datetime


@router_panel.get("/consultas")
def consultas_sin_respuesta(panel: PanelDeConfiguracion) -> list[ConsultaPendiente]:
    with sesion_de_negocio(panel.negocio_id) as s:
        filas = s.scalars(
            select(ConsultaSinRespuesta)
            .where(
                ConsultaSinRespuesta.negocio_id == panel.negocio_id,
                ConsultaSinRespuesta.resuelta.is_(False),
            )
            .order_by(ConsultaSinRespuesta.creado_a.desc())
            .limit(100)
        )
        return [ConsultaPendiente(id=c.id, pregunta=c.pregunta, creado_a=c.creado_a) for c in filas]


@router_panel.post("/consultas/{consulta_id}/resolver", status_code=status.HTTP_204_NO_CONTENT)
def resolver_consulta(consulta_id: uuid.UUID, panel: PanelDeConfiguracion) -> None:
    with sesion_de_negocio(panel.negocio_id) as s:
        consulta = s.scalar(
            select(ConsultaSinRespuesta).where(
                ConsultaSinRespuesta.id == consulta_id,
                ConsultaSinRespuesta.negocio_id == panel.negocio_id,
            )
        )
        if consulta is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa pregunta.")
        consulta.resuelta = True
        s.commit()
