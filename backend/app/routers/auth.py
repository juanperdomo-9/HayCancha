"""Ingreso de dueños, empleados y superadmin. Los jugadores nunca necesitan cuenta."""

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import sesion_de_negocio
from app.dependencias import SesionPublica, UsuarioActual
from app.models import Negocio
from app.models import Usuario as UsuarioModelo
from app.schemas import panel as esquemas
from app.services.auth import (
    COOKIE_SESION,
    DURACION_SESION,
    TokenInvalido,
    Usuario,
    autenticar,
    hashear_clave,
    token_de_sesion,
    usuario_de_invitacion,
)

router = APIRouter(prefix="/auth", tags=["sesión"])

LINK_VENCIDO = "Este link ya no sirve: se usó o venció. Pedí uno nuevo a quien te invitó."


def usuario_de_sesion(session: Session, usuario: Usuario) -> esquemas.UsuarioSesion:
    negocio = session.get(Negocio, usuario.negocio_id) if usuario.negocio_id else None
    return esquemas.UsuarioSesion(
        email=usuario.email,
        rol=usuario.rol,
        negocio=esquemas.NegocioDelUsuario(
            slug=negocio.slug,
            nombre=negocio.nombre,
            color_primario=negocio.color_primario,
            logo_url=negocio.logo_url,
        )
        if negocio
        else None,
    )


def abrir_sesion(response: Response, usuario: Usuario) -> None:
    response.set_cookie(
        COOKIE_SESION,
        token_de_sesion(usuario),
        max_age=int(DURACION_SESION.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_segura,
        path="/",
    )


@router.post("/ingresar")
def ingresar(
    datos: esquemas.Ingreso, response: Response, session: SesionPublica
) -> esquemas.UsuarioSesion:
    usuario = autenticar(session, datos.email, datos.clave)
    if usuario is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "El email o la contraseña no coinciden.")
    abrir_sesion(response, usuario)
    return usuario_de_sesion(session, usuario)


@router.post("/salir", status_code=status.HTTP_204_NO_CONTENT)
def salir(response: Response) -> None:
    response.delete_cookie(COOKIE_SESION, path="/")


@router.get("/yo")
def yo(usuario: UsuarioActual, session: SesionPublica) -> esquemas.UsuarioSesion:
    return usuario_de_sesion(session, usuario)


@router.get("/invitacion")
def ver_invitacion(token: str, session: SesionPublica) -> esquemas.Invitacion:
    try:
        usuario = usuario_de_invitacion(session, token)
    except TokenInvalido as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, LINK_VENCIDO) from error
    negocio = session.get(Negocio, usuario.negocio_id) if usuario.negocio_id else None
    return esquemas.Invitacion(email=usuario.email, negocio=negocio.nombre if negocio else None)


@router.post("/definir-clave")
def definir_clave(
    datos: esquemas.NuevaClave, response: Response, session: SesionPublica
) -> esquemas.UsuarioSesion:
    try:
        usuario = usuario_de_invitacion(session, datos.token)
    except TokenInvalido as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, LINK_VENCIDO) from error
    if usuario.negocio_id is None:
        # El superadmin se crea y cambia su clave con `python -m app.cli crear-superadmin`.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, LINK_VENCIDO)
    try:
        nuevo_hash = hashear_clave(datos.clave)
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

    with sesion_de_negocio(usuario.negocio_id) as s, s.begin():
        s.execute(
            update(UsuarioModelo)
            .where(UsuarioModelo.id == usuario.id, UsuarioModelo.negocio_id == usuario.negocio_id)
            .values(password_hash=nuevo_hash)
        )
    abrir_sesion(response, usuario)
    return usuario_de_sesion(session, usuario)
