"""Panel de HayCancha (/admin): alta de complejos, suspensiones y cobros. Solo superadmin.
Usa la conexión de administrador porque trabaja sobre todos los negocios; la
configuración de un complejo se hace desde su propio panel (/panel/{slug})."""

import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import sesion_admin
from app.dependencias import Superadmin
from app.models import Negocio, Recurso, Usuario
from app.schemas import panel as esquemas
from app.services import email as correo
from app.services.auth import Usuario as UsuarioAuth
from app.services.auth import link_de_invitacion
from app.services.slugs import validar_slug

router = APIRouter(prefix="/admin", tags=["superadmin"])


def _dueno(session: Session, negocio_id: uuid.UUID) -> Usuario | None:
    return session.scalar(
        select(Usuario)
        .where(Usuario.negocio_id == negocio_id, Usuario.rol == "dueno")
        .order_by(Usuario.creado_a)
        .limit(1)
    )


def _complejo(session: Session, negocio: Negocio) -> esquemas.ComplejoAdmin:
    dueno = _dueno(session, negocio.id)
    canchas = session.scalar(
        select(func.count()).select_from(Recurso).where(Recurso.negocio_id == negocio.id)
    )
    return esquemas.ComplejoAdmin(
        id=negocio.id,
        slug=negocio.slug,
        nombre=negocio.nombre,
        barrio=negocio.barrio,
        estado_cuenta=negocio.estado_cuenta,
        activo=negocio.activo,
        plan=negocio.plan,
        canchas=canchas or 0,
        dueno_email=dueno.email if dueno else None,
        dueno_clave_definida=bool(dueno and dueno.password_hash),
        creado_a=negocio.creado_a,
    )


def _link(dueno: Usuario) -> str:
    return link_de_invitacion(
        UsuarioAuth(
            dueno.id, dueno.negocio_id, dueno.email, dueno.password_hash, dueno.rol, dueno.activo
        )
    )


@router.get("/complejos")
def listar_complejos(_: Superadmin) -> list[esquemas.ComplejoAdmin]:
    with sesion_admin() as s:
        return [_complejo(s, n) for n in s.scalars(select(Negocio).order_by(Negocio.nombre))]


@router.post("/complejos", status_code=status.HTTP_201_CREATED)
def dar_de_alta(
    datos: esquemas.AltaDeComplejo, _: Superadmin, tareas: BackgroundTasks
) -> esquemas.ComplejoCreado:
    try:
        slug = validar_slug(datos.slug)
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
    if datos.sena_tipo == "porcentaje" and datos.sena_valor > 100:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "La seña no puede ser más del 100% del turno."
        )

    with sesion_admin() as s:
        if s.scalar(select(Negocio.id).where(Negocio.slug == slug)):
            raise HTTPException(
                status.HTTP_409_CONFLICT, f"La dirección haycancha.com.ar/{slug} ya está en uso."
            )
        email = datos.dueno_email.lower()
        if s.scalar(select(Usuario.id).where(Usuario.email == email)):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ese email ya tiene una cuenta en HayCancha."
            )

        negocio = Negocio(
            **datos.model_dump(exclude={"slug", "dueno_email"}),
            slug=slug,
        )
        s.add(negocio)
        s.flush()
        dueno = Usuario(negocio_id=negocio.id, email=email, rol="dueno")
        s.add(dueno)
        try:
            s.commit()
        except IntegrityError as error:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "La dirección o el email ya están en uso."
            ) from error
        link = _link(dueno)
        tareas.add_task(
            correo.enviar, correo.invitacion(negocio, dueno.email, link=link, rol="dueno")
        )
        return esquemas.ComplejoCreado(complejo=_complejo(s, negocio), link_dueno=link)


def _buscar(session: Session, negocio_id: uuid.UUID) -> Negocio:
    negocio = session.get(Negocio, negocio_id)
    if negocio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese complejo.")
    return negocio


@router.patch("/complejos/{negocio_id}")
def cambiar_complejo(
    negocio_id: uuid.UUID, cambios: esquemas.CambiosDeComplejo, _: Superadmin
) -> esquemas.ComplejoAdmin:
    with sesion_admin() as s:
        negocio = _buscar(s, negocio_id)
        for campo, valor in cambios.model_dump(exclude_unset=True).items():
            setattr(negocio, campo, valor)
        s.commit()
        return _complejo(s, negocio)


@router.post("/complejos/{negocio_id}/invitacion")
def link_para_el_dueno(
    negocio_id: uuid.UUID, _: Superadmin, tareas: BackgroundTasks
) -> esquemas.LinkDeInvitacion:
    with sesion_admin() as s:
        negocio = _buscar(s, negocio_id)
        dueno = _dueno(s, negocio_id)
        if dueno is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese complejo no tiene dueño cargado.")
        link = _link(dueno)
        tareas.add_task(
            correo.enviar, correo.invitacion(negocio, dueno.email, link=link, rol="dueno")
        )
        return esquemas.LinkDeInvitacion(link=link)


class PruebaDeEmail(BaseModel):
    para: EmailStr


@router.post("/email-de-prueba")
def email_de_prueba(datos: PruebaDeEmail, _: Superadmin) -> dict[str, bool]:
    """Manda un email de prueba desde el servidor, para verificar la configuración de Resend.
    Hasta verificar el dominio en Resend, solo llega a la cuenta de Resend."""
    enviado = correo.enviar(
        correo.Email(
            para=[datos.para],
            asunto="Prueba de HayCancha",
            html="<p>Si leés esto, los emails de HayCancha salen bien desde el servidor.</p>",
            texto="Si leés esto, los emails de HayCancha salen bien desde el servidor.",
        )
    )
    return {"enviado": enviado}
