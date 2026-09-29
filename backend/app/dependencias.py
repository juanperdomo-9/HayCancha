"""Quién está pidiendo y a qué puede entrar.

- dueño: el panel completo de su complejo.
- empleado: solo la agenda de su complejo (no la configuración ni los pagos).
- superadmin: cualquier complejo, más /admin.
"""

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Negocio
from app.services.auth import (
    COOKIE_SESION,
    TokenInvalido,
    Usuario,
    leer_token_de_sesion,
    usuario_por_id,
)

SesionPublica = Annotated[Session, Depends(get_session)]


def usuario_actual(request: Request, session: SesionPublica) -> Usuario:
    no_autorizado = HTTPException(status.HTTP_401_UNAUTHORIZED, "Tenés que ingresar de nuevo.")
    token = request.cookies.get(COOKIE_SESION)
    if not token:
        raise no_autorizado
    try:
        usuario_id = leer_token_de_sesion(token)
    except (TokenInvalido, ValueError) as error:
        raise no_autorizado from error
    usuario = usuario_por_id(session, usuario_id)
    if usuario is None or not usuario.activo:
        raise no_autorizado
    return usuario


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]


@dataclass(frozen=True)
class Panel:
    negocio: Negocio
    usuario: Usuario

    @property
    def negocio_id(self) -> uuid.UUID:
        return self.negocio.id


def acceso_panel(slug: str, usuario: UsuarioActual, session: SesionPublica) -> Panel:
    negocio = session.scalar(select(Negocio).where(Negocio.slug == slug))
    if negocio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese complejo.")
    if not (usuario.es_superadmin or usuario.negocio_id == negocio.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a este complejo.")
    return Panel(negocio, usuario)


PanelActual = Annotated[Panel, Depends(acceso_panel)]


def acceso_configuracion(panel: PanelActual) -> Panel:
    if panel.usuario.rol == "empleado":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Solo el dueño puede cambiar la configuración del complejo."
        )
    return panel


PanelDeConfiguracion = Annotated[Panel, Depends(acceso_configuracion)]


def solo_superadmin(usuario: UsuarioActual) -> Usuario:
    if not usuario.es_superadmin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta sección es solo para HayCancha.")
    return usuario


Superadmin = Annotated[Usuario, Depends(solo_superadmin)]
