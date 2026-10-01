"""Asistentes de IA (fase 3). Por ahora, el buscador de la página principal.

Sin cuenta: la conversación la guarda el navegador y se manda entera en cada pedido
(solo los textos). Para cuidar el cupo del proveedor hay límites por conversación y por
conexión por día. Si el proveedor no está o se quedó sin cupo, se responde 503 con un
mensaje amable y la página sigue funcionando.
"""

import logging
import threading
from collections import defaultdict
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from app.db import get_session
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
