"""Avisos (webhooks) de Mercado Pago.

1. Se valida la firma (x-signature) con MP_WEBHOOK_SECRET. Si no coincide: 401.
2. Del aviso solo se toma el id del pago. El pago se consulta a Mercado Pago con el token
   del complejo: nunca se confía en el cuerpo del aviso.
3. `acreditar_pago` lo registra una sola vez (los avisos llegan repetidos) y confirma la
   reserva, o lo marca para devolver.
4. Si Mercado Pago no responde, se contesta 502 para que reintente (lo hace durante
   días). Todo esto tarda mucho menos que los 22 segundos que espera.

Hay dos direcciones: /webhooks/mercadopago/{negocio_id}, la que va en cada preferencia, y
/webhooks/mercadopago, la que se carga en el panel de Mercado Pago (ahí el complejo se
busca por la cuenta que cobró, `user_id`).
"""

import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session, sesion_de_negocio
from app.models import Negocio, Pago
from app.services import mercadopago
from app.services.cobros import Resultado, acreditar_pago, devolver, proveedor_para

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/mercadopago", tags=["webhooks"])

SesionPublica = Annotated[Session, Depends(get_session)]
Cuerpo = Annotated[dict[str, Any] | None, Body()]
FirmaHeader = Annotated[str | None, Header(alias="x-signature")]
RequestIdHeader = Annotated[str | None, Header(alias="x-request-id")]


def _ok() -> Response:
    return Response(status_code=status.HTTP_200_OK)


def _id_del_pago(request: Request, cuerpo: dict[str, Any]) -> str | None:
    """data.id viene como parámetro de la URL (es el que se firma); si no, del cuerpo."""
    data_id = request.query_params.get("data.id") or request.query_params.get("id")
    if not data_id and isinstance(cuerpo.get("data"), dict):
        data_id = cuerpo["data"].get("id")
    return str(data_id) if data_id else None


def _es_de_pago(request: Request, cuerpo: dict[str, Any]) -> bool:
    tipo = request.query_params.get("type") or request.query_params.get("topic")
    return (tipo or str(cuerpo.get("type") or cuerpo.get("topic") or "")) == "payment"


def _validar(request: Request, cuerpo: dict[str, Any], x_signature, x_request_id) -> str | None:
    """Valida la firma (401 si no coincide) y devuelve el id del pago, si el aviso es de
    un pago."""
    pago_id = _id_del_pago(request, cuerpo)
    if not mercadopago.firma_valida(
        x_signature, x_request_id, pago_id, get_settings().mp_webhook_secret
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Firma inválida")
    return pago_id if _es_de_pago(request, cuerpo) else None


def procesar_pago(negocio: Negocio, pago_id: str) -> Resultado:
    """Consulta el pago y lo acredita. Si hay que devolverlo, lo devuelve (o lo deja
    pendiente para que la tarea periódica lo reintente)."""
    try:
        informado = mercadopago.consultar_pago(negocio, pago_id)
    except mercadopago.ErrorMercadoPago as error:
        logger.warning("No se pudo consultar el pago %s: %s", pago_id, error)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Reintentar más tarde") from error
    with sesion_de_negocio(negocio.id) as s:
        resultado = acreditar_pago(s, negocio, informado)
        s.commit()
        if resultado in (Resultado.A_DEVOLVER, Resultado.MONTO_INVALIDO):
            pago = s.scalar(
                select(Pago).where(
                    Pago.negocio_id == negocio.id, Pago.mp_payment_id == informado.id
                )
            )
            if pago is not None:
                devolver(s, negocio, pago, proveedor_para(negocio))
    logger.info("Pago %s de %s: %s", pago_id, negocio.slug, resultado)
    # Acá se avisa al dueño por email cuando se confirma (bloque 2D).
    return resultado


@router.post("/{negocio_id}")
def aviso_del_complejo(
    negocio_id: uuid.UUID,
    request: Request,
    session: SesionPublica,
    cuerpo: Cuerpo = None,
    x_signature: FirmaHeader = None,
    x_request_id: RequestIdHeader = None,
) -> Response:
    pago_id = _validar(request, cuerpo or {}, x_signature, x_request_id)
    if pago_id is None:
        return _ok()  # otros avisos no nos interesan
    negocio = session.get(Negocio, negocio_id)
    if negocio is None or not negocio.mp_access_token_enc:
        logger.warning("Aviso del pago %s para un complejo sin Mercado Pago", pago_id)
        return _ok()
    procesar_pago(negocio, pago_id)
    return _ok()


@router.post("")
def aviso_general(
    request: Request,
    session: SesionPublica,
    cuerpo: Cuerpo = None,
    x_signature: FirmaHeader = None,
    x_request_id: RequestIdHeader = None,
) -> Response:
    cuerpo = cuerpo or {}
    pago_id = _validar(request, cuerpo, x_signature, x_request_id)
    cuenta = cuerpo.get("user_id")
    if pago_id is None or cuenta is None:
        return _ok()
    # Una misma cuenta de Mercado Pago puede cobrar para más de un complejo: el pago es
    # del que tenga la reserva.
    negocios = session.scalars(
        select(Negocio).where(
            Negocio.mp_user_id == str(cuenta), Negocio.mp_access_token_enc.is_not(None)
        )
    ).all()
    falla: HTTPException | None = None
    for negocio in negocios:
        try:
            if procesar_pago(negocio, pago_id) is not Resultado.SIN_RESERVA:
                return _ok()
        except HTTPException as error:  # ese complejo no pudo consultar: probamos el resto
            falla = error
    if falla is not None:
        raise falla  # que Mercado Pago reintente
    return _ok()
