"""Asistente de cada complejo (fase 3): responde con lo que cargó el dueño, muestra turnos
libres y deja reservas pendientes de pago.

Herramientas: ver_turnos, reservar (crea la reserva pendiente por el mismo camino que la
página, con origen "bot") y registrar_consulta (lo que no sabe, para el dueño). No tiene
ninguna herramienta para confirmar reservas ni pagos: solo Mercado Pago confirma.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.models import ConsultaSinRespuesta, Negocio
from app.services import ia
from app.services.buscador import DIAS, Resultado, _hora, buscar_turnos

MAX_VUELTAS = 5
DIAS_RESERVABLES = 30
MAX_CONOCIMIENTO = 6000  # caracteres: alcanza para un complejo y cuida el cupo


@dataclass
class Reservado:
    link: str
    url_pago: str | None


def _herramientas() -> list[dict[str, Any]]:
    return [
        ia.herramienta(
            "ver_turnos",
            "Turnos libres de este complejo.",
            {"type": "object", "properties": {
                "fecha": {"type": "string", "description": "AAAA-MM-DD (por defecto hoy)"},
                "deporte": {"type": "string", "description": "futbol5, padel…"},
                "hora_desde": {"type": "string", "description": "HH:MM"},
                "hora_hasta": {"type": "string", "description": "HH:MM"},
                "caracteristicas": {"type": "array", "items": {"type": "string"}},
            }},
        ),
        ia.herramienta(
            "reservar",
            "Deja el turno reservado esperando el pago de la seña. Solo con nombre y teléfono "
            "que dio el jugador y un horario que viste libre con ver_turnos.",
            {"type": "object", "properties": {
                "fecha": {"type": "string", "description": "AAAA-MM-DD"},
                "hora": {"type": "string", "description": "HH:MM"},
                "deporte": {"type": "string", "description": "código del deporte, ej. futbol5"},
                "nombre": {"type": "string"},
                "telefono": {"type": "string"},
            }, "required": ["fecha", "hora", "deporte", "nombre", "telefono"]},
        ),
        ia.herramienta(
            "registrar_consulta",
            "Anota una pregunta que no sabés contestar, para que el complejo la complete.",
            {"type": "object", "properties": {"pregunta": {"type": "string"}},
             "required": ["pregunta"]},
        ),
    ]  # fmt: skip


def _sistema(negocio: Negocio, hoy: date, deportes: str) -> str:
    nombre = negocio.asistente_nombre or "el asistente"
    sabe = (negocio.asistente_conocimiento or "").strip()[:MAX_CONOCIMIENTO]
    sena = (
        f"{int(negocio.sena_valor)}% del turno"
        if negocio.sena_tipo == "porcentaje"
        else f"${int(negocio.sena_valor)}"
    )
    return (
        f"Sos {nombre}, el asistente de {negocio.nombre} en HayCanchas. Español rioplatense, "
        f"con voseo, cálido y breve (1 a 3 oraciones, texto plano, sin asteriscos ni listas "
        f"largas). Hoy es {DIAS[hoy.weekday()]} {hoy.isoformat()}.\n"
        f"Datos del complejo: {negocio.direccion or 'dirección a confirmar'}"
        f"{', ' + negocio.barrio if negocio.barrio else ''}"
        f"{'. Referencia: ' + negocio.referencia if negocio.referencia else ''}. "
        f"Deportes: {deportes}. Servicios: {', '.join(negocio.servicios) or 'no informados'}. "
        f"Seña para reservar: {sena}, se paga online con Mercado Pago. Se puede cancelar y "
        f"recuperar la seña hasta {negocio.horas_cancelacion} horas antes.\n"
        f"Lo que te contó el complejo:\n{sabe or '(nada todavía)'}\n"
        "Reglas:\n"
        "- Solo hablás de este complejo. Si no sabés algo, no inventes: usá "
        "registrar_consulta y decí que el complejo lo va a responder.\n"
        "- Para horarios usá ver_turnos. Si falta el día, es hoy.\n"
        "- Para reservar necesitás el horario, el nombre y el teléfono del jugador; pedí lo "
        "que falte. Con reservar el turno queda guardado unos minutos esperando el pago: "
        "decile que pague la seña con el botón que le aparece. Nunca digas que está "
        "confirmado: se confirma solo cuando se acredita el pago."
    )


def conversar(
    session: Session,
    negocio: Negocio,
    historial: list[dict[str, str]],
    reservar: Callable[[dict[str, Any]], Reservado],
) -> tuple[str, list[Resultado], Reservado | None]:
    """Responde el último mensaje. `reservar` crea la reserva pendiente (la pasa el router,
    que sabe la conexión del jugador para los topes)."""
    hoy = datetime.now(ZoneInfo(negocio.zona_horaria)).date()
    deportes = _deportes(negocio)
    mensajes: list[dict[str, Any]] = [
        {"role": "system", "content": _sistema(negocio, hoy, deportes)}
    ]
    for m in historial:
        mensajes.append({"role": "user" if m["rol"] == "usuario" else "assistant",
                         "content": m["texto"]})  # fmt: skip

    herramientas = _herramientas()
    turnos: list[Resultado] = []
    reserva: Reservado | None = None
    for vuelta in range(MAX_VUELTAS):
        ultima = vuelta == MAX_VUELTAS - 1
        respuesta = ia.responder(mensajes, [] if ultima else herramientas)
        if not respuesta.llamadas and not respuesta.texto:
            respuesta = ia.responder(mensajes, [] if ultima else herramientas)
        if not respuesta.llamadas:
            return respuesta.texto or "¿En qué te ayudo?", turnos, reserva
        mensajes.append(respuesta.mensaje)
        for llamada in respuesta.llamadas:
            a = llamada.argumentos
            if llamada.nombre == "ver_turnos":
                encontrados = _ver_turnos(session, negocio, hoy, a)
                if encontrados:
                    turnos = encontrados
                resultado: Any = _resumen(encontrados)
            elif llamada.nombre == "reservar":
                try:
                    reserva = reservar(a)
                    resultado = (
                        "Listo: reserva pendiente de pago. El jugador ve el botón para pagar."
                    )
                except HTTPException as error:
                    resultado = f"No se pudo reservar: {error.detail}"
                except (ValueError, TypeError) as error:
                    resultado = f"No se pudo reservar: datos incompletos ({error})"
            elif llamada.nombre == "registrar_consulta":
                _registrar(negocio, str(a.get("pregunta") or "")[:500])
                resultado = "Anotada. El complejo la va a responder."
            else:
                resultado = "No existe esa herramienta."
            mensajes.append(ia.resultado_de_herramienta(llamada, resultado))
    return "¿Te ayudo con algo más?", turnos, reserva


def _deportes(negocio: Negocio) -> str:
    from app.routers.publico import deportes_del_negocio

    with sesion_de_negocio(negocio.id) as s:
        lista = deportes_del_negocio(s, negocio.id)
    return ", ".join(f"{d.nombre} ({d.codigo})" for d in lista) or "a confirmar"


def _ver_turnos(
    session: Session, negocio: Negocio, hoy: date, a: dict[str, Any]
) -> list[Resultado]:
    try:
        fecha = date.fromisoformat(str(a.get("fecha") or hoy.isoformat())[:10])
    except ValueError:
        fecha = hoy
    if not hoy <= fecha < hoy + timedelta(days=DIAS_RESERVABLES):
        return []
    caracteristicas = a.get("caracteristicas")
    return buscar_turnos(
        session,
        fecha=fecha,
        deporte=a.get("deporte") or None,
        hora_desde=_hora(a["hora_desde"]) if a.get("hora_desde") else None,
        hora_hasta=_hora(a["hora_hasta"]) if a.get("hora_hasta") else None,
        caracteristicas=caracteristicas if isinstance(caracteristicas, list) else None,
        negocio_id=negocio.id,
    )


def _resumen(turnos: list[Resultado]) -> str:
    if not turnos:
        return "0 turnos libres."
    return f"{len(turnos)} turnos libres:\n" + "\n".join(
        f"{t.deporte} ({t.deporte_codigo}) · {t.cancha} · {t.fecha} {t.hora} · "
        f"${int(float(t.precio))}"
        for t in turnos[:10]
    )


def _registrar(negocio: Negocio, pregunta: str) -> None:
    if not pregunta.strip():
        return
    with sesion_de_negocio(negocio.id) as s:
        s.add(ConsultaSinRespuesta(negocio_id=negocio.id, pregunta=pregunta.strip()))
        s.commit()


def inicio_del_turno(negocio: Negocio, fecha: str, hora: str) -> datetime:
    """La fecha y hora que dijo el modelo, en la zona del complejo."""
    dia = date.fromisoformat(str(fecha)[:10])
    momento: time | None = _hora(hora)
    if momento is None:
        raise ValueError("hora inválida")
    return datetime.combine(dia, momento, tzinfo=ZoneInfo(negocio.zona_horaria))
