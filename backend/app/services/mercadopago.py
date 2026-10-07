"""Mercado Pago: vincular la cuenta de cada complejo (OAuth), mantener sus tokens y cobrar.

Cada complejo cobra en su propia cuenta. El dueño autoriza a la app de HayCanchas desde
el panel y Mercado Pago nos da un access token (dura 180 días) y un refresh token para
renovarlo. Los dos se guardan encriptados y nunca salen del backend.

Flujo de autorización con PKCE (code_challenge S256) y `state`:
https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation
Renovación: https://www.mercadopago.com.ar/developers/es/docs/security/oauth/renewal

Cobro (Checkout Pro): una preferencia por reserva, un webhook por pago y la API de
reembolsos. Todo con el access token del complejo. Se usa la API REST con httpx (el SDK
oficial solo arma estos mismos pedidos).
"""

import base64
import hashlib
import hmac
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Negocio, Reserva
from app.services.cifrado import ClaveFaltante, cifrar, descifrar
from app.services.cobros import MONEDA, ErrorDePago, PagoInformado, link_de_la_reserva
from app.services.disponibilidad import ahora

logger = logging.getLogger(__name__)

URL_AUTORIZACION = "https://auth.mercadopago.com/authorization"
URL_API = "https://api.mercadopago.com"
URL_TOKEN = f"{URL_API}/oauth/token"

# Se renueva con este margen antes de que venza (el token dura 180 días).
RENOVAR_ANTES = timedelta(days=30)


class ErrorMercadoPago(ErrorDePago):
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
                from app.services import email

                email.enviar(
                    email.mercadopago_desvinculado(
                        negocio, email.emails_de_duenos(session, negocio.id)
                    )
                )
            else:
                logger.warning("No se pudo renovar el token de %s: %s", negocio.slug, error)
                resultado.fallidos += 1
        except ClaveFaltante as error:
            logger.error("Token de %s ilegible: %s", negocio.slug, error)
            resultado.fallidos += 1
    return resultado


# --- Cobro de la seña (Checkout Pro) ---

# Pagos en efectivo (Rapipago, Pago Fácil…): tardan en acreditarse y el turno no puede
# quedar trabado tanto tiempo.
TIPOS_EXCLUIDOS = ("ticket", "atm")

# Lo que se guarda de la respuesta de un pago (sin datos personales del que pagó).
CAMPOS_DEL_PAGO = (
    "id",
    "status",
    "status_detail",
    "transaction_amount",
    "currency_id",
    "payment_type_id",
    "payment_method_id",
    "date_approved",
    "external_reference",
    "collector_id",
    "live_mode",
)


def _llamar(negocio: Negocio, metodo: str, ruta: str, **opciones) -> dict:
    """Llama a la API de Mercado Pago con el access token del complejo."""
    try:
        token = access_token_de(negocio)
    except ClaveFaltante as error:
        raise ErrorMercadoPago(str(error)) from error
    headers = {"Authorization": f"Bearer {token}", **opciones.pop("headers", {})}
    try:
        with _http() as http:
            respuesta = http.request(metodo, f"{URL_API}{ruta}", headers=headers, **opciones)
    except httpx.HTTPError as error:
        raise ErrorMercadoPago(f"Mercado Pago no respondió: {error}") from error
    if respuesta.status_code >= 400:
        raise ErrorMercadoPago(
            f"Mercado Pago respondió {respuesta.status_code} a {metodo} {ruta}",
            permanente=respuesta.status_code in (401, 403),
        )
    return respuesta.json() if respuesta.content else {}


def _fecha(momento: datetime) -> str:
    """Formato que pide Mercado Pago: 2026-10-01T21:00:00.000-03:00."""
    return momento.isoformat(timespec="milliseconds")


class ProveedorMercadoPago:
    simulado = False

    def crear_cobro(self, negocio: Negocio, reserva: Reserva, descripcion: str) -> str | None:
        settings = get_settings()
        vuelta = f"{settings.frontend_url}{link_de_la_reserva(negocio, reserva)}"
        preferencia = {
            "items": [
                {
                    "id": str(reserva.id),
                    "title": descripcion,
                    "quantity": 1,
                    # Mercado Pago recibe un número JSON; la seña ya viene redondeada a centavos.
                    "unit_price": float(reserva.sena),
                    "currency_id": MONEDA,
                }
            ],
            "external_reference": str(reserva.id),
            "notification_url": f"{settings.app_base_url}/webhooks/mercadopago/{negocio.id}",
            "back_urls": {"success": vuelta, "failure": vuelta, "pending": vuelta},
            "auto_return": "approved",
            "expires": True,
            "expiration_date_from": _fecha(ahora()),
            "expiration_date_to": _fecha(reserva.vence_a or ahora()),
            "binary_mode": True,
            "payment_methods": {"excluded_payment_types": [{"id": t} for t in TIPOS_EXCLUIDOS]},
            # Sin marketplace_fee: la comisión de HayCanchas es 0, y con el campo Mercado Pago suma
            # a la cuenta dueña de la app como parte del pago (con cuentas de prueba, falla).
        }
        creada = _llamar(
            negocio,
            "POST",
            "/checkout/preferences",
            json=preferencia,
            headers={"X-Idempotency-Key": f"preferencia-{reserva.id}"},
        )
        reserva.mp_preference_id = creada.get("id")
        url = creada.get("init_point") or creada.get("sandbox_init_point")
        if not url:
            raise ErrorMercadoPago("Mercado Pago no devolvió el link de pago")
        return url

    def reembolsar(self, negocio: Negocio, pago_id: str) -> None:
        """Devolución total. La clave de idempotencia es fija por pago: si se reintenta,
        Mercado Pago no devuelve dos veces."""
        _llamar(
            negocio,
            "POST",
            f"/v1/payments/{pago_id}/refunds",
            json={},
            headers={"X-Idempotency-Key": f"devolucion-{pago_id}"},
        )


def consultar_pago(negocio: Negocio, pago_id: str) -> PagoInformado:
    """El pago tal como lo informa Mercado Pago, consultado con el token del complejo."""
    pago = _llamar(negocio, "GET", f"/v1/payments/{pago_id}")
    try:
        reserva_id = uuid.UUID(str(pago.get("external_reference") or ""))
    except ValueError:
        reserva_id = None
    # Un pago cobrado en otra cuenta no es de este complejo, aunque diga su reserva.
    cobrador = pago.get("collector_id")
    if cobrador is not None and negocio.mp_user_id and str(cobrador) != negocio.mp_user_id:
        reserva_id = None
    try:
        monto = Decimal(str(pago.get("transaction_amount"))).quantize(Decimal("0.01"))
    except InvalidOperation:
        monto = Decimal("0.00")
    return PagoInformado(
        id=str(pago.get("id", pago_id)),
        estado=str(pago.get("status", "")),
        monto=monto,
        moneda=str(pago.get("currency_id", "")),
        reserva_id=reserva_id,
        detalle={campo: pago.get(campo) for campo in CAMPOS_DEL_PAGO if campo in pago},
    )


# --- Firma de los webhooks ---


def firma_valida(
    x_signature: str | None, x_request_id: str | None, data_id: str | None, secreto: str
) -> bool:
    """Valida el header x-signature ("ts=...,v1=...") de un aviso de Mercado Pago.

    Se firma "id:{data.id};request-id:{x-request-id};ts:{ts};" con HMAC-SHA256 y la clave
    secreta de webhooks. data.id va en minúsculas. Si falta alguno de esos valores, esa
    parte se saca del texto que se firma, como indica la documentación.
    """
    if not x_signature or not secreto:
        return False
    partes = dict(parte.strip().split("=", 1) for parte in x_signature.split(",") if "=" in parte)
    ts, v1 = partes.get("ts"), partes.get("v1")
    if not ts or not v1:
        return False
    manifest = ""
    if data_id:
        manifest += f"id:{data_id.lower()};"
    if x_request_id:
        manifest += f"request-id:{x_request_id};"
    manifest += f"ts:{ts};"
    esperada = hmac.new(secreto.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, v1.strip().lower())
