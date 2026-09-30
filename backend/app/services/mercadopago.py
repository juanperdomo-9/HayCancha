"""Mercado Pago: vincular la cuenta de cada complejo (OAuth) y mantener sus tokens.

Cada complejo cobra en su propia cuenta. El dueño autoriza a la app de HayCancha desde
el panel y Mercado Pago nos da un access token (dura 180 días) y un refresh token para
renovarlo. Los dos se guardan encriptados y nunca salen del backend.

Flujo de autorización con PKCE (code_challenge S256) y `state`:
https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation
Renovación: https://www.mercadopago.com.ar/developers/es/docs/security/oauth/renewal
"""

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Negocio
from app.services.cifrado import ClaveFaltante, cifrar, descifrar
from app.services.disponibilidad import ahora

logger = logging.getLogger(__name__)

URL_AUTORIZACION = "https://auth.mercadopago.com/authorization"
URL_TOKEN = "https://api.mercadopago.com/oauth/token"

# Se renueva con este margen antes de que venza (el token dura 180 días).
RENOVAR_ANTES = timedelta(days=30)


class ErrorMercadoPago(Exception):
    def __init__(self, mensaje: str, *, permanente: bool = False) -> None:
        super().__init__(mensaje)
        # El refresh token ya no sirve (el dueño revocó el permiso): hay que volver a vincular.
        self.permanente = permanente


@dataclass(frozen=True)
class Credenciales:
    access_token: str
    refresh_token: str
    user_id: str
    vence_a: datetime


def _http() -> httpx.Client:
    """Cliente HTTP para la API de Mercado Pago (los tests lo reemplazan)."""
    return httpx.Client(timeout=15)


# --- Autorización (PKCE) ---


def nuevo_pkce() -> tuple[str, str]:
    """(code_verifier, code_challenge S256), como pide RFC 7636."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def url_de_autorizacion(state: str, code_challenge: str) -> str:
    settings = get_settings()
    parametros = {
        "client_id": settings.mp_client_id,
        "response_type": "code",
        "platform_id": "mp",
        "state": state,
        "redirect_uri": settings.mp_callback,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{URL_AUTORIZACION}?{urlencode(parametros)}"


def _pedir_token(datos: dict[str, str]) -> Credenciales:
    settings = get_settings()
    cuerpo = {
        "client_id": settings.mp_client_id,
        "client_secret": settings.mp_client_secret,
        **datos,
    }
    if settings.mp_tokens_de_prueba:
        cuerpo["test_token"] = "true"
    try:
        with _http() as http:
            respuesta = http.post(URL_TOKEN, json=cuerpo)
    except httpx.HTTPError as error:
        raise ErrorMercadoPago(f"Mercado Pago no respondió: {error}") from error

    if respuesta.status_code != 200:
        # 400 invalid_grant: el código o el refresh token ya no sirven.
        permanente = respuesta.status_code in (400, 401)
        raise ErrorMercadoPago(
            f"Mercado Pago rechazó el pedido de token ({respuesta.status_code})",
            permanente=permanente,
        )
    token = respuesta.json()
    try:
        return Credenciales(
            access_token=token["access_token"],
            refresh_token=token["refresh_token"],
            user_id=str(token["user_id"]),
            vence_a=ahora() + timedelta(seconds=int(token["expires_in"])),
        )
    except (KeyError, TypeError, ValueError) as error:
        raise ErrorMercadoPago("Respuesta de token incompleta") from error


def cambiar_codigo(code: str, code_verifier: str) -> Credenciales:
    """El `code` que vuelve en el callback, por el par de tokens del complejo."""
    return _pedir_token(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": get_settings().mp_callback,
            "code_verifier": code_verifier,
        }
    )


def renovar(refresh_token: str) -> Credenciales:
    return _pedir_token({"grant_type": "refresh_token", "refresh_token": refresh_token})


# --- Tokens guardados en el negocio ---


def guardar_credenciales(negocio: Negocio, credenciales: Credenciales) -> None:
    negocio.mp_user_id = credenciales.user_id
    negocio.mp_access_token_enc = cifrar(credenciales.access_token)
    negocio.mp_refresh_token_enc = cifrar(credenciales.refresh_token)
    negocio.mp_token_vence_a = credenciales.vence_a


def desvincular(negocio: Negocio) -> None:
    negocio.mp_user_id = None
    negocio.mp_access_token_enc = None
    negocio.mp_refresh_token_enc = None
    negocio.mp_token_vence_a = None


def access_token_de(negocio: Negocio) -> str:
    """El token para cobrar en nombre de este complejo. Solo para llamar a Mercado Pago."""
    if not negocio.mp_access_token_enc:
        raise ErrorMercadoPago("El complejo no tiene Mercado Pago vinculado")
    return descifrar(negocio.mp_access_token_enc)


@dataclass
class ResultadoRenovacion:
    renovados: int = 0
    desvinculados: int = 0
    fallidos: int = 0


def renovar_tokens_por_vencer(session: Session) -> ResultadoRenovacion:
    """Renueva los tokens que vencen en menos de RENOVAR_ANTES, de todos los complejos.

    Corre con la sesión de administrador (tarea periódica). Si Mercado Pago dice que el
    refresh token ya no sirve, se desvincula: el dueño lo ve en el panel y vuelve a vincular.
    Un error pasajero se reintenta en la próxima corrida.
    """
    resultado = ResultadoRenovacion()
    if not get_settings().mercadopago_configurado:
        return resultado
    negocios = session.scalars(
        select(Negocio).where(
            Negocio.mp_refresh_token_enc.is_not(None),
            Negocio.mp_token_vence_a < ahora() + RENOVAR_ANTES,
        )
    ).all()
    for negocio in negocios:
        try:
            guardar_credenciales(negocio, renovar(descifrar(negocio.mp_refresh_token_enc)))
            resultado.renovados += 1
        except ErrorMercadoPago as error:
            if error.permanente:
                logger.warning("Mercado Pago de %s ya no autoriza: se desvincula", negocio.slug)
                desvincular(negocio)
                resultado.desvinculados += 1
            else:
                logger.warning("No se pudo renovar el token de %s: %s", negocio.slug, error)
                resultado.fallidos += 1
        except ClaveFaltante as error:
            logger.error("Token de %s ilegible: %s", negocio.slug, error)
            resultado.fallidos += 1
    return resultado
