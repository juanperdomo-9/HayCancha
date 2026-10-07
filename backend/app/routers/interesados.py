"""Dueños de complejos que dejan su contacto en la página principal ("Tengo un complejo").

La página pública solo inserta (con app_user, que no puede leer la tabla). El superadmin
los ve y les cambia el estado con la conexión de administrador."""

import threading
import uuid
from collections import defaultdict
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, StringConstraints
from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.db import get_session, sesion_admin
from app.dependencias import Superadmin
from app.models import Interesado
from app.routers.reservas_online import _conexion

router = APIRouter(tags=["interesados"])

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Opcional = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Estado = Literal["nuevo", "contactado", "se_sumo", "no_interesado"]

# Para que nadie llene la lista con un script: pocos envíos por conexión por día.
MAX_POR_CONEXION = 5
_envios: dict[tuple[str, date], int] = defaultdict(int)
_candado = threading.Lock()


class NuevoInteresado(BaseModel):
    nombre: Texto
    complejo: Texto
    zona: Opcional | None = None
    whatsapp: Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=40)]
    canchas: Opcional | None = None
    como_reserva: Opcional | None = None
    # Trampa para bots: un campo oculto que una persona nunca completa.
    sitio_web: str | None = None


class InteresadoAdmin(BaseModel):
    id: uuid.UUID
    nombre: str
    complejo: str
    zona: str | None
    whatsapp: str
    canchas: str | None
    como_reserva: str | None
    estado: Estado
    creado_a: datetime


@router.post("/publico/interesados", status_code=status.HTTP_201_CREATED)
def dejar_contacto(
    datos: NuevoInteresado,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, bool]:
    if datos.sitio_web:
        return {"ok": True}  # un bot: se le dice que sí y no se guarda nada
    clave = (_conexion(request), date.today())
    with _candado:
        if _envios[clave] >= MAX_POR_CONEXION:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, "Ya recibimos tus datos. Te escribimos pronto."
            )
        _envios[clave] += 1
    campos = datos.model_dump(exclude={"sitio_web"})
    # Sin RETURNING: app_user puede insertar pero no leer la tabla.
    session.execute(insert(Interesado).values(**campos))
    session.commit()
    return {"ok": True}


@router.get("/admin/interesados")
def ver_interesados(_: Superadmin) -> list[InteresadoAdmin]:
    with sesion_admin() as s:
        filas = s.scalars(select(Interesado).order_by(Interesado.creado_a.desc()).limit(500))
        return [InteresadoAdmin.model_validate(f, from_attributes=True) for f in filas]


class CambioDeEstado(BaseModel):
    estado: Estado


@router.patch("/admin/interesados/{interesado_id}")
def cambiar_estado(
    interesado_id: uuid.UUID, cambio: CambioDeEstado, _: Superadmin
) -> InteresadoAdmin:
    with sesion_admin() as s:
        interesado = s.get(Interesado, interesado_id)
        if interesado is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese contacto.")
        interesado.estado = cambio.estado
        s.commit()
        s.refresh(interesado)
        return InteresadoAdmin.model_validate(interesado, from_attributes=True)
