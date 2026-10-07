"""Emails con Resend: avisos al dueño e invitaciones. Al jugador no se le manda email.

- Sin EMAIL_API_KEY (desarrollo), el email no se manda: se muestra en el log.
- Se mandan en segundo plano y un error de Resend nunca traba una reserva ni un pago:
  se registra en el log y listo.

API: https://resend.com/docs/api-reference/emails/send-email
"""

import html
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Negocio, Usuario
from app.services.disponibilidad import zona_del_negocio

logger = logging.getLogger(__name__)

URL_RESEND = "https://api.resend.com/emails"
REMITENTE_DE_PRUEBA = "HayCanchas <onboarding@resend.dev>"
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]  # fmt: skip


@dataclass(frozen=True)
class Email:
    para: list[str]
    asunto: str
    html: str
    texto: str


def _http() -> httpx.Client:
    """Cliente HTTP para Resend (los tests lo reemplazan)."""
    return httpx.Client(timeout=10)


def enviar(email: Email) -> bool:
    """Manda el email. Nunca lanza: devuelve False si no se pudo."""
    if not email.para:
        return False
    settings = get_settings()
    if not settings.email_api_key:
        logger.info("Email (sin EMAIL_API_KEY, no se manda) a %s: %s\n%s",
                    ", ".join(email.para), email.asunto, email.texto)  # fmt: skip
        return False
    try:
        with _http() as http:
            respuesta = http.post(
                URL_RESEND,
                headers={"Authorization": f"Bearer {settings.email_api_key}"},
                json={
                    "from": settings.email_from or REMITENTE_DE_PRUEBA,
                    "to": email.para,
                    "subject": email.asunto,
                    "html": email.html,
                    "text": email.texto,
                },
            )
    except httpx.HTTPError as error:
        logger.warning("No se pudo mandar el email «%s»: %s", email.asunto, error)
        return False
    if respuesta.status_code >= 400:
        logger.warning(
            "Resend rechazó el email «%s» (%s): %s",
            email.asunto,
            respuesta.status_code,
            respuesta.text[:300],
        )
        return False
    return True


def emails_de_duenos(session: Session, negocio_id: uuid.UUID) -> list[str]:
    """Los emails de los dueños activos del complejo (con una sesión que lo pueda ver)."""
    return list(
        session.scalars(
            select(Usuario.email).where(
                Usuario.negocio_id == negocio_id,
                Usuario.rol == "dueno",
                Usuario.activo,
            )
        )
    )


# --- Plantillas ---


def _fecha(negocio: Negocio, momento: datetime) -> str:
    local = momento.astimezone(zona_del_negocio(negocio))
    return f"{DIAS[local.weekday()]} {local.day} de {MESES[local.month - 1]} a las {local:%H:%M}"


def _plata(monto) -> str:
    return "$ " + f"{int(round(monto)):,}".replace(",", ".")


def _armar(negocio: Negocio, para: list[str], asunto: str, parrafos: list[str],
           boton: tuple[str, str] | None = None) -> Email:  # fmt: skip
    """Email simple con la marca de HayCanchas y el color del complejo como acento."""
    color = negocio.color_primario or "#1E7A3E"
    cuerpo = "".join(f'<p style="margin:0 0 12px;line-height:1.5">{p}</p>' for p in parrafos)
    if boton:
        cuerpo += (
            f'<p style="margin:20px 0"><a href="{html.escape(boton[1])}" '
            f'style="background:{color};color:#fff;padding:12px 18px;border-radius:10px;'
            f'text-decoration:none;font-weight:700">{html.escape(boton[0])}</a></p>'
        )
    contenido = (
        '<div style="background:#F1E9D8;padding:24px;font-family:Arial,sans-serif;color:#14231A">'
        '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;'
        f'padding:24px;border-top:6px solid {color}">'
        f'<p style="margin:0 0 4px;font-size:13px;color:#5d6660">{html.escape(negocio.nombre)}</p>'
        f'<h1 style="margin:0 0 16px;font-size:20px">{html.escape(asunto)}</h1>{cuerpo}</div>'
        '<p style="text-align:center;font-size:12px;color:#5d6660;margin-top:16px">'
        "<b>HAY</b>CANCHA · haycanchas.com.ar</p></div>"
    )
    texto = "\n\n".join([asunto, *[_sin_html(p) for p in parrafos]])
    if boton:
        texto += f"\n\n{boton[0]}: {boton[1]}"
    return Email(para=para, asunto=asunto, html=contenido, texto=texto)


def _sin_html(texto: str) -> str:
    return html.unescape(texto.replace("<b>", "").replace("</b>", ""))


def _e(texto: str | None) -> str:
    return html.escape(texto or "")


def _agenda(negocio: Negocio) -> str:
    return f"{get_settings().frontend_url}/panel/{negocio.slug}"


def reserva_nueva(negocio: Negocio, para: list[str], *, jugador: str, telefono: str,
                  cancha: str, inicio: datetime, sena, saldo) -> Email:  # fmt: skip
    return _armar(
        negocio,
        para,
        f"Reserva nueva: {cancha}, {_fecha(negocio, inicio)}",
        [
            f"<b>{_e(jugador)}</b> ({_e(telefono)}) reservó <b>{_e(cancha)}</b> para el "
            f"<b>{_fecha(negocio, inicio)}</b> desde tu página.",
            f"Pagó la seña de <b>{_plata(sena)}</b> con Mercado Pago. "
            f"En la cancha falta cobrar <b>{_plata(saldo)}</b>.",
        ],
        ("Ver la agenda", _agenda(negocio)),
    )


def cancelacion(negocio: Negocio, para: list[str], *, jugador: str, cancha: str,
                inicio: datetime, sena, devuelta: bool | None) -> Email:  # fmt: skip
    if devuelta is None:
        detalle = "No había seña pagada online."
    elif devuelta:
        detalle = f"Canceló a tiempo: se le devuelve la seña de <b>{_plata(sena)}</b>."
    else:
        detalle = (
            f"Canceló fuera del plazo de tu política: la seña de <b>{_plata(sena)}</b> "
            "queda para el complejo."
        )
    return _armar(
        negocio,
        para,
        f"Cancelación: {cancha}, {_fecha(negocio, inicio)}",
        [
            f"<b>{_e(jugador)}</b> canceló su reserva de <b>{_e(cancha)}</b> del "
            f"<b>{_fecha(negocio, inicio)}</b>. El turno quedó libre en tu página.",
            detalle,
        ],
        ("Ver la agenda", _agenda(negocio)),
    )


def cambio_de_horario(negocio: Negocio, para: list[str], *, jugador: str, antes: datetime,
                      cancha: str, ahora: datetime, saldo) -> Email:  # fmt: skip
    return _armar(
        negocio,
        para,
        f"Cambio de horario: {jugador}",
        [
            f"<b>{_e(jugador)}</b> cambió su reserva del <b>{_fecha(negocio, antes)}</b> al "
            f"<b>{_fecha(negocio, ahora)}</b> en <b>{_e(cancha)}</b>.",
            f"La seña ya estaba pagada. En la cancha falta cobrar <b>{_plata(saldo)}</b>.",
        ],
        ("Ver la agenda", _agenda(negocio)),
    )


def devolucion_pendiente(negocio: Negocio, para: list[str], *, jugador: str, monto) -> Email:
    return _armar(
        negocio,
        para,
        "Una devolución de seña quedó pendiente",
        [
            f"Mercado Pago no pudo devolverle a <b>{_e(jugador)}</b> la seña de "
            f"<b>{_plata(monto)}</b>. Lo más común es que la cuenta de Mercado Pago del "
            "complejo no tenga saldo suficiente.",
            "Lo reintentamos solos cada 10 minutos: apenas haya saldo, sale. "
            "No tenés que hacer nada más.",
        ],
    )


def mercadopago_desvinculado(negocio: Negocio, para: list[str]) -> Email:
    return _armar(
        negocio,
        para,
        "Tu Mercado Pago se desvinculó",
        [
            "Mercado Pago nos avisó que HayCanchas ya no tiene permiso para cobrar en tu "
            "cuenta (por ejemplo, porque se quitó desde Mercado Pago).",
            "<b>Mientras tanto, tu página no toma reservas online.</b> Volvé a vincularlo "
            "desde la pestaña Cobros del panel: tarda un minuto.",
        ],
        ("Vincular Mercado Pago", f"{_agenda(negocio)}/cobros"),
    )


def invitacion(negocio: Negocio, para: str, *, link: str, rol: str) -> Email:
    que = "manejar la agenda de" if rol == "empleado" else "manejar el panel de"
    return _armar(
        negocio,
        [para],
        f"Tu acceso a {negocio.nombre} en HayCanchas",
        [
            f"Te sumaron para {que} <b>{_e(negocio.nombre)}</b> en HayCanchas.",
            "Para entrar, elegí tu contraseña con este link. Sirve una sola vez y vence en 7 días.",
        ],
        ("Elegir mi contraseña", link),
    )
