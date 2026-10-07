"""Panel de cada complejo: /panel/{slug}/... Todo corre con la sesión del negocio (RLS)
y filtra por negocio_id. La configuración es solo para el dueño (y el superadmin)."""

import uuid
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from app.db import sesion_de_negocio
from app.dependencias import PanelActual, PanelDeConfiguracion
from app.models import Deporte, Foto, Horario, Negocio, Recurso, Usuario
from app.schemas import panel as esquemas
from app.services import email
from app.services.archivos import ArchivoInvalido, borrar_imagen, guardar_imagen
from app.services.auth import Usuario as UsuarioAuth
from app.services.auth import link_de_invitacion
from app.services.disponibilidad import hoy_en_el_negocio
from app.services.horarios import FranjaNueva, HorariosInvalidos, validar_franjas
from app.services.metricas import metricas_del_mes

router = APIRouter(prefix="/panel/{slug}", tags=["panel"])


def _no_encontrado(que: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"No encontramos {que}.")


def _configuracion(negocio: Negocio) -> esquemas.Configuracion:
    return esquemas.Configuracion.model_validate(negocio, from_attributes=True)


@router.get("")
def ver_panel(panel: PanelActual) -> esquemas.PanelResumen:
    n = panel.negocio
    return esquemas.PanelResumen(
        slug=n.slug,
        nombre=n.nombre,
        color_primario=n.color_primario,
        color_secundario=n.color_secundario,
        logo_url=n.logo_url,
        rol=panel.usuario.rol,
        plan_pro=n.plan == PLAN_PRO,
    )


# --- Resultados del mes (Plan Pro) ---

PLAN_PRO = "pro"


@router.get("/resultados")
def ver_resultados(panel: PanelDeConfiguracion, mes: str | None = None) -> esquemas.Resultados:
    """Métricas de un mes ("2026-10"; sin mes, el actual). Solo con el Plan Pro."""
    negocio = panel.negocio
    if negocio.plan != PLAN_PRO:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Los resultados son parte del Plan Pro. Pedíselo a HayCanchas.",
        )
    hoy = hoy_en_el_negocio(negocio)
    try:
        anio, numero = (int(x) for x in mes.split("-")) if mes else (hoy.year, hoy.month)
        if not 1 <= numero <= 12 or not 2020 <= anio <= hoy.year + 1:
            raise ValueError
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Mes inválido.") from error
    with sesion_de_negocio(panel.negocio_id) as s:
        m = metricas_del_mes(s, negocio, anio, numero)
    return esquemas.Resultados(
        mes=m.mes,
        actual=esquemas.NumerosDelMes(**vars(m.actual)),
        anterior=esquemas.NumerosDelMes(**vars(m.anterior)),
        ocupacion_por_dia=m.ocupacion_por_dia,
        horarios_top=[esquemas.HorarioPedido(hora=h, reservas=n) for h, n in m.horarios_top],
    )


# --- Configuración del complejo ---


@router.get("/configuracion")
def ver_configuracion(panel: PanelDeConfiguracion) -> esquemas.Configuracion:
    return _configuracion(panel.negocio)


@router.patch("/configuracion")
def cambiar_configuracion(
    cambios: esquemas.CambiosDeConfiguracion, panel: PanelDeConfiguracion
) -> esquemas.Configuracion:
    valores = cambios.model_dump(exclude_unset=True)
    if valores.get("whatsapp") == "":
        valores["whatsapp"] = None  # vacío: sin botón de WhatsApp
    sena_tipo = valores.get("sena_tipo", panel.negocio.sena_tipo)
    sena_valor = valores.get("sena_valor", panel.negocio.sena_valor)
    if sena_tipo == "porcentaje" and sena_valor > 100:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "La seña no puede ser más del 100% del turno."
        )
    with sesion_de_negocio(panel.negocio_id) as s:
        negocio = s.get(Negocio, panel.negocio_id)
        for campo, valor in valores.items():
            setattr(negocio, campo, valor)
        s.commit()
        s.refresh(negocio)  # lo que quedó guardado (por ejemplo, 15000 -> 15000.00)
        return _configuracion(negocio)


@router.post("/marca/{tipo}")
async def subir_imagen(
    tipo: Literal["logo", "portada"], archivo: UploadFile, panel: PanelDeConfiguracion
) -> esquemas.Configuracion:
    try:
        url = await run_in_threadpool(guardar_imagen, panel.negocio_id, tipo, await archivo.read())
    except ArchivoInvalido as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
    with sesion_de_negocio(panel.negocio_id) as s:
        negocio = s.get(Negocio, panel.negocio_id)
        setattr(negocio, f"{tipo}_url", url)
        s.commit()
        s.refresh(negocio)
        return _configuracion(negocio)


@router.delete("/marca/{tipo}")
def quitar_imagen(
    tipo: Literal["logo", "portada"], panel: PanelDeConfiguracion
) -> esquemas.Configuracion:
    """Saca el logo o la portada: la página vuelve a las iniciales o al dibujo de la cancha."""
    with sesion_de_negocio(panel.negocio_id) as s:
        negocio = s.get(Negocio, panel.negocio_id)
        anterior = getattr(negocio, f"{tipo}_url")
        setattr(negocio, f"{tipo}_url", None)
        s.commit()
        s.refresh(negocio)
        borrar_imagen(anterior)
        return _configuracion(negocio)


# --- Galería de fotos ---

MAX_FOTOS = 12


def _fotos(s, negocio_id: uuid.UUID) -> list[esquemas.FotoDelPanel]:
    filas = s.scalars(
        select(Foto).where(Foto.negocio_id == negocio_id).order_by(Foto.orden, Foto.creado_a)
    )
    return [esquemas.FotoDelPanel(id=f.id, url=f.url) for f in filas]


@router.get("/fotos")
def ver_fotos(panel: PanelDeConfiguracion) -> list[esquemas.FotoDelPanel]:
    with sesion_de_negocio(panel.negocio_id) as s:
        return _fotos(s, panel.negocio_id)


@router.post("/fotos")
async def subir_foto(
    archivo: UploadFile, panel: PanelDeConfiguracion
) -> list[esquemas.FotoDelPanel]:
    with sesion_de_negocio(panel.negocio_id) as s:
        cantidad = s.scalar(select(func.count()).where(Foto.negocio_id == panel.negocio_id))
    if cantidad >= MAX_FOTOS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Ya tenés {MAX_FOTOS} fotos. Sacá alguna para subir otra.",
        )
    try:
        url = await run_in_threadpool(
            guardar_imagen, panel.negocio_id, "foto", await archivo.read()
        )
    except ArchivoInvalido as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
    with sesion_de_negocio(panel.negocio_id) as s:
        ultimo = s.scalar(select(func.max(Foto.orden)).where(Foto.negocio_id == panel.negocio_id))
        s.add(Foto(negocio_id=panel.negocio_id, url=url, orden=(ultimo or 0) + 1))
        s.commit()
        return _fotos(s, panel.negocio_id)


@router.delete("/fotos/{foto_id}")
def quitar_foto(foto_id: uuid.UUID, panel: PanelDeConfiguracion) -> list[esquemas.FotoDelPanel]:
    with sesion_de_negocio(panel.negocio_id) as s:
        foto = s.scalar(select(Foto).where(Foto.id == foto_id, Foto.negocio_id == panel.negocio_id))
        if foto is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa foto.")
        url = foto.url
        s.delete(foto)
        s.commit()
        borrar_imagen(url)
        return _fotos(s, panel.negocio_id)


@router.put("/fotos/orden")
def ordenar_fotos(ids: list[uuid.UUID], panel: PanelDeConfiguracion) -> list[esquemas.FotoDelPanel]:
    """Recibe los ids en el orden nuevo (los que no vengan quedan al final)."""
    posicion = {foto_id: i for i, foto_id in enumerate(ids)}
    with sesion_de_negocio(panel.negocio_id) as s:
        for foto in s.scalars(select(Foto).where(Foto.negocio_id == panel.negocio_id)):
            foto.orden = posicion.get(foto.id, len(ids) + foto.orden)
        s.commit()
        return _fotos(s, panel.negocio_id)


# --- Canchas ---


def _canchas(session, negocio_id: uuid.UUID) -> list[esquemas.Cancha]:
    filas = session.execute(
        select(Recurso, Deporte)
        .join(Deporte, Deporte.id == Recurso.deporte_id)
        .where(Recurso.negocio_id == negocio_id)
        .order_by(Recurso.orden, Recurso.nombre)
    ).all()
    return [
        esquemas.Cancha(
            id=r.id,
            nombre=r.nombre,
            deporte=d.codigo,
            deporte_nombre=d.nombre,
            caracteristicas=r.caracteristicas,
            activo=r.activo,
            orden=r.orden,
        )
        for r, d in filas
    ]


@router.get("/deportes")
def listar_deportes(panel: PanelActual) -> list[esquemas.Deporte]:
    with sesion_de_negocio(panel.negocio_id) as s:
        return [
            esquemas.Deporte(
                codigo=d.codigo, nombre=d.nombre, duracion_sugerida_min=d.duracion_sugerida_min
            )
            for d in s.scalars(select(Deporte).order_by(Deporte.nombre))
        ]


@router.get("/canchas")
def listar_canchas(panel: PanelDeConfiguracion) -> list[esquemas.Cancha]:
    with sesion_de_negocio(panel.negocio_id) as s:
        return _canchas(s, panel.negocio_id)


@router.post("/canchas", status_code=status.HTTP_201_CREATED)
def crear_cancha(datos: esquemas.NuevaCancha, panel: PanelDeConfiguracion) -> esquemas.Cancha:
    with sesion_de_negocio(panel.negocio_id) as s:
        deporte = s.scalar(select(Deporte).where(Deporte.codigo == datos.deporte))
        if deporte is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ese deporte no existe.")
        ultimo = s.scalar(
            select(func.max(Recurso.orden)).where(Recurso.negocio_id == panel.negocio_id)
        )
        recurso = Recurso(
            negocio_id=panel.negocio_id,
            deporte_id=deporte.id,
            nombre=datos.nombre,
            caracteristicas=datos.caracteristicas or None,
            orden=(ultimo or 0) + 1,
        )
        s.add(recurso)
        try:
            s.commit()
        except IntegrityError as error:
            raise HTTPException(
                status.HTTP_409_CONFLICT, f"Ya hay una cancha que se llama «{datos.nombre}»."
            ) from error
        return next(c for c in _canchas(s, panel.negocio_id) if c.id == recurso.id)


@router.patch("/canchas/{cancha_id}")
def cambiar_cancha(
    cancha_id: uuid.UUID, cambios: esquemas.CambiosDeCancha, panel: PanelDeConfiguracion
) -> esquemas.Cancha:
    with sesion_de_negocio(panel.negocio_id) as s:
        recurso = s.scalar(
            select(Recurso).where(Recurso.id == cancha_id, Recurso.negocio_id == panel.negocio_id)
        )
        if recurso is None:
            raise _no_encontrado("esa cancha")
        for campo, valor in cambios.model_dump(exclude_unset=True).items():
            setattr(recurso, campo, valor)
        try:
            s.commit()
        except IntegrityError as error:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ya hay otra cancha con ese nombre."
            ) from error
        return next(c for c in _canchas(s, panel.negocio_id) if c.id == cancha_id)


# --- Horarios ---


@router.get("/canchas/{cancha_id}/horarios")
def ver_horarios(cancha_id: uuid.UUID, panel: PanelDeConfiguracion) -> list[esquemas.Franja]:
    """Las franjas de una cancha, agrupando los días que tienen el mismo horario y precio."""
    with sesion_de_negocio(panel.negocio_id) as s:
        filas = s.scalars(
            select(Horario)
            .where(Horario.negocio_id == panel.negocio_id, Horario.recurso_id == cancha_id)
            .order_by(Horario.desde, Horario.dia_semana)
        ).all()
    agrupadas: dict[tuple, list[int]] = {}
    for h in filas:
        clave = (h.desde, h.hasta, h.duracion_turno_min, h.precio, h.precio_efectivo)
        agrupadas.setdefault(clave, []).append(h.dia_semana)
    return [
        esquemas.Franja(
            dias=sorted(dias),
            desde=desde,
            hasta=hasta,
            duracion_turno_min=duracion,
            precio=precio,
            precio_efectivo=efectivo,
        )
        for (desde, hasta, duracion, precio, efectivo), dias in agrupadas.items()
    ]


@router.put("/horarios")
def guardar_horarios(
    datos: esquemas.HorariosDeCanchas, panel: PanelDeConfiguracion
) -> dict[str, int]:
    """Reemplaza todas las franjas de las canchas elegidas (por ejemplo, "las 4 de fútbol 7")."""
    franjas = [FranjaNueva(**f.model_dump()) for f in datos.franjas]
    try:
        validar_franjas(franjas)
    except HorariosInvalidos as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

    canchas = set(datos.canchas)
    with sesion_de_negocio(panel.negocio_id) as s, s.begin():
        propias = set(
            s.scalars(
                select(Recurso.id).where(
                    Recurso.negocio_id == panel.negocio_id, Recurso.id.in_(canchas)
                )
            )
        )
        if propias != canchas:
            raise _no_encontrado("alguna de esas canchas")
        s.execute(
            delete(Horario).where(
                Horario.negocio_id == panel.negocio_id, Horario.recurso_id.in_(canchas)
            )
        )
        for cancha_id in canchas:
            for franja in franjas:
                for dia in sorted(set(franja.dias)):
                    s.add(
                        Horario(
                            negocio_id=panel.negocio_id,
                            recurso_id=cancha_id,
                            dia_semana=dia,
                            desde=franja.desde,
                            hasta=franja.hasta,
                            duracion_turno_min=franja.duracion_turno_min,
                            precio=franja.precio,
                            precio_efectivo=franja.precio_efectivo,
                        )
                    )
    return {"canchas": len(canchas), "franjas": len(franjas)}


# --- Equipo ---


def _integrante(u: Usuario) -> esquemas.Integrante:
    return esquemas.Integrante(
        id=u.id,
        email=u.email,
        rol=u.rol,
        activo=u.activo,
        clave_definida=u.password_hash is not None,
    )


def _usuario_auth(u: Usuario) -> UsuarioAuth:
    return UsuarioAuth(u.id, u.negocio_id, u.email, u.password_hash, u.rol, u.activo)


@router.get("/equipo")
def listar_equipo(panel: PanelDeConfiguracion) -> list[esquemas.Integrante]:
    with sesion_de_negocio(panel.negocio_id) as s:
        usuarios = s.scalars(
            select(Usuario)
            .where(Usuario.negocio_id == panel.negocio_id)
            .order_by(Usuario.rol, Usuario.email)
        )
        return [_integrante(u) for u in usuarios]


@router.post("/equipo", status_code=status.HTTP_201_CREATED)
def invitar_empleado(
    datos: esquemas.NuevoIntegrante, panel: PanelDeConfiguracion, tareas: BackgroundTasks
) -> esquemas.IntegranteConLink:
    with sesion_de_negocio(panel.negocio_id) as s:
        usuario = Usuario(negocio_id=panel.negocio_id, email=datos.email.lower(), rol="empleado")
        s.add(usuario)
        try:
            s.commit()
        except IntegrityError as error:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ese email ya tiene una cuenta en HayCanchas."
            ) from error
        link = link_de_invitacion(_usuario_auth(usuario))
        tareas.add_task(
            email.enviar, email.invitacion(panel.negocio, usuario.email, link=link, rol="empleado")
        )
        return esquemas.IntegranteConLink(integrante=_integrante(usuario), link=link)


def _buscar_integrante(s, panel, usuario_id: uuid.UUID) -> Usuario:
    usuario = s.scalar(
        select(Usuario).where(Usuario.id == usuario_id, Usuario.negocio_id == panel.negocio_id)
    )
    if usuario is None:
        raise _no_encontrado("a esa persona en el equipo")
    return usuario


@router.post("/equipo/{usuario_id}/invitacion")
def nuevo_link(
    usuario_id: uuid.UUID, panel: PanelDeConfiguracion, tareas: BackgroundTasks
) -> esquemas.LinkDeInvitacion:
    with sesion_de_negocio(panel.negocio_id) as s:
        usuario = _buscar_integrante(s, panel, usuario_id)
        link = link_de_invitacion(_usuario_auth(usuario))
        tareas.add_task(
            email.enviar, email.invitacion(panel.negocio, usuario.email, link=link, rol=usuario.rol)
        )
        return esquemas.LinkDeInvitacion(link=link)


@router.patch("/equipo/{usuario_id}")
def cambiar_integrante(
    usuario_id: uuid.UUID, cambios: esquemas.CambiosDeIntegrante, panel: PanelDeConfiguracion
) -> esquemas.Integrante:
    with sesion_de_negocio(panel.negocio_id) as s, s.begin():
        usuario = _buscar_integrante(s, panel, usuario_id)
        if usuario.rol == "dueno":
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Al dueño no se lo puede desactivar desde el panel. Escribinos a HayCanchas.",
            )
        usuario.activo = cambios.activo
    return _integrante(usuario)
