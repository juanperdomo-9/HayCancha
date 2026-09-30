"""Cobros del complejo: vincular su cuenta de Mercado Pago (OAuth con PKCE).

1. El dueño toca "Vincular" y el backend arma el link de autorización. El `state` y el
   `code_verifier` quedan en una cookie firmada, httpOnly y de 10 minutos.
2. Mercado Pago vuelve a /mercadopago/callback con `code` y `state`. Si el `state` no es
   el de la cookie, se rechaza: así nadie puede colgar su cuenta en un complejo ajeno.
3. Se cambia el `code` por los tokens, que se guardan encriptados.

Solo el dueño y el superadmin (los empleados no ven los pagos).
"""

import logging
import secrets
import uuid
from datetime import timedelta
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.db import sesion_de_negocio
from app.dependencias import PanelDeConfiguracion
from app.models import Negocio
from app.schemas import cobros as esquemas
from app.services import mercadopago
from app.services.auth import TokenInvalido, firmar_token, leer_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["cobros"])

COOKIE_OAUTH = "hc_mp_oauth"
RUTA_CALLBACK = "/mercadopago/callback"
DURACION_OAUTH = timedelta(minutes=10)


def _estado(negocio: Negocio) -> esquemas.EstadoCobros:
    vinculado = bool(negocio.mp_access_token_enc)
    return esquemas.EstadoCobros(
        disponible=get_settings().mercadopago_configurado,
        vinculado=vinculado,
        cuenta_mp=negocio.mp_user_id if vinculado else None,
        vence_a=negocio.mp_token_vence_a if vinculado else None,
    )


@router.get("/panel/{slug}/cobros")
def ver_cobros(panel: PanelDeConfiguracion) -> esquemas.EstadoCobros:
    return _estado(panel.negocio)


@router.post("/panel/{slug}/cobros/vincular")
def vincular(panel: PanelDeConfiguracion, response: Response) -> esquemas.LinkDeVinculacion:
    settings = get_settings()
    if not settings.mercadopago_configurado:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Todavía no se puede vincular Mercado Pago: falta configurar la app de HayCancha.",
        )
    state = secrets.token_urlsafe(24)
    verifier, challenge = mercadopago.nuevo_pkce()
    datos = {
        "negocio": str(panel.negocio_id),
        "slug": panel.negocio.slug,
        "state": state,
        "verifier": verifier,
        "usuario": str(panel.usuario.id),
    }
    response.set_cookie(
        COOKIE_OAUTH,
        firmar_token("mp_oauth", datos, DURACION_OAUTH),
        max_age=int(DURACION_OAUTH.total_seconds()),
        httponly=True,
        samesite="lax",  # vuelve desde Mercado Pago con una navegación normal (GET)
        secure=settings.cookie_segura,
        path=RUTA_CALLBACK,
    )
    return esquemas.LinkDeVinculacion(url=mercadopago.url_de_autorizacion(state, challenge))


@router.post("/panel/{slug}/cobros/desvincular")
def desvincular(panel: PanelDeConfiguracion) -> esquemas.EstadoCobros:
    with sesion_de_negocio(panel.negocio_id) as s:
        negocio = s.get(Negocio, panel.negocio_id)
        mercadopago.desvincular(negocio)
        s.commit()
        return _estado(negocio)


def _volver(slug: str | None, resultado: str) -> RedirectResponse:
    base = get_settings().frontend_url
    destino = f"{base}/panel/{quote(slug)}/cobros?mp={resultado}" if slug else f"{base}/panel"
    respuesta = RedirectResponse(destino, status.HTTP_303_SEE_OTHER)
    respuesta.delete_cookie(COOKIE_OAUTH, path=RUTA_CALLBACK)
    return respuesta


@router.get(RUTA_CALLBACK)
def callback(
    request: Request,
    code: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    error: Annotated[str | None, Query()] = None,
) -> RedirectResponse:
    token = request.cookies.get(COOKIE_OAUTH)
    try:
        datos = leer_token(token or "", "mp_oauth")
    except TokenInvalido:
        # Sin la cookie (venció, u otro navegador) no sabemos de qué complejo es.
        return _volver(None, "error")
    slug = datos["slug"]
    if error:
        return _volver(slug, "cancelado")  # el dueño no autorizó
    if not code or not state or not secrets.compare_digest(state, datos["state"]):
        logger.warning("Callback de Mercado Pago con state inválido (%s)", slug)
        return _volver(slug, "error")

    try:
        credenciales = mercadopago.cambiar_codigo(code, datos["verifier"])
    except mercadopago.ErrorMercadoPago as falla:
        logger.warning("No se pudo vincular Mercado Pago de %s: %s", slug, falla)
        return _volver(slug, "error")

    negocio_id = uuid.UUID(datos["negocio"])
    with sesion_de_negocio(negocio_id) as s:
        negocio = s.get(Negocio, negocio_id)
        if negocio is None:
            return _volver(None, "error")
        mercadopago.guardar_credenciales(negocio, credenciales)
        s.commit()
    logger.info("Mercado Pago vinculado: %s (cuenta %s)", slug, credenciales.user_id)
    return _volver(slug, "vinculado")
