"""Asistente de la página principal: busca turnos libres en todos los complejos.

El jugador escribe como en un chat ("fútbol 5 hoy a las 19 en La Plata, techada") y el
modelo usa la herramienta `buscar_turnos`, que filtra con la misma disponibilidad que la
página de cada complejo. El modelo no inventa turnos: solo cuenta lo que devolvió la
búsqueda, y las tarjetas que ve el jugador salen de esos resultados.
"""

import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.models import Deporte, Negocio, Recurso
from app.services import ia
from app.services.disponibilidad import ahora, disponibilidad, zona_del_negocio

DIAS_RESERVABLES = 30
MAX_RESULTADOS = 12
MAX_VUELTAS = 5
ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires"
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


@dataclass(frozen=True)
class Resultado:
    complejo: str
    slug: str
    barrio: str | None
    deporte: str
    deporte_codigo: str
    cancha: str
    caracteristicas: str | None
    fecha: date
    hora: str
    hora_fin: str
    precio: str
    sena: str


def _normal(texto: str | None) -> str:
    sin_tildes = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn").lower()


def _raiz(palabra: str) -> str:
    """'techada' y 'techado' tienen que coincidir: se compara sin la última letra."""
    palabra = _normal(palabra).strip()
    return palabra[:-1] if len(palabra) > 4 else palabra


def _es_deporte(pedido: str, codigo: str, nombre: str) -> bool:
    buscado = _normal(pedido).replace(" ", "")
    return buscado in _normal(codigo) or buscado in _normal(nombre).replace(" ", "")


def _hora(valor: Any) -> time | None:
    try:
        return datetime.strptime(str(valor).strip()[:5], "%H:%M").time()
    except ValueError:
        return None


def buscar_turnos(
    session: Session,
    *,
    fecha: date,
    deporte: str | None = None,
    hora_desde: time | None = None,
    hora_hasta: time | None = None,
    zona: str | None = None,
    caracteristicas: list[str] | None = None,
) -> list[Resultado]:
    """Turnos libres de los complejos visibles que cumplen todos los filtros."""
    from app.routers.publico import negocios_visibles

    requeridas = [_raiz(c) for c in caracteristicas or [] if c and c.strip()]
    zona_n = _normal(zona).strip()
    resultados: list[Resultado] = []
    for negocio in session.scalars(negocios_visibles().order_by(Negocio.nombre)):
        donde = _normal(" ".join(filter(None, [negocio.barrio, negocio.direccion, negocio.nombre])))
        if zona_n and zona_n not in donde:
            continue
        zona_horaria = zona_del_negocio(negocio)
        with sesion_de_negocio(negocio.id) as s:
            deportes = s.execute(
                select(Deporte.codigo, Deporte.nombre)
                .join(Recurso, Recurso.deporte_id == Deporte.id)
                .where(Recurso.negocio_id == negocio.id, Recurso.activo)
                .distinct()
            ).all()
            for codigo, nombre in deportes:
                if deporte and not _es_deporte(deporte, codigo, nombre):
                    continue
                for turno in disponibilidad(s, negocio, codigo, fecha):
                    if turno.inicio <= ahora():
                        continue
                    local = turno.inicio.astimezone(zona_horaria)
                    if hora_desde and local.time() < hora_desde:
                        continue
                    if hora_hasta and local.time() > hora_hasta:
                        continue
                    for libre in turno.libres:
                        texto = _normal(libre.recurso.caracteristicas)
                        if any(r not in texto for r in requeridas):
                            continue
                        resultados.append(
                            Resultado(
                                complejo=negocio.nombre,
                                slug=negocio.slug,
                                barrio=negocio.barrio,
                                deporte=nombre,
                                deporte_codigo=codigo,
                                cancha=libre.recurso.nombre,
                                caracteristicas=libre.recurso.caracteristicas,
                                fecha=fecha,
                                hora=local.strftime("%H:%M"),
                                hora_fin=turno.fin.astimezone(zona_horaria).strftime("%H:%M"),
                                precio=str(libre.precio),
                                sena=str(libre.sena),
                            )
                        )
    resultados.sort(key=lambda r: (r.hora, r.complejo, r.cancha))
    return resultados[:MAX_RESULTADOS]


def _herramientas() -> list[dict[str, Any]]:
    return [
        ia.herramienta(
            "buscar_turnos",
            "Turnos libres en los complejos. Todo es opcional.",
            {
                "type": "object",
                "properties": {
                    "fecha": {"type": "string", "description": "AAAA-MM-DD (por defecto hoy)"},
                    "deporte": {"type": "string", "description": "futbol5, futbol, padel…"},
                    "hora_desde": {"type": "string", "description": "HH:MM"},
                    "hora_hasta": {"type": "string", "description": "HH:MM"},
                    "zona": {"type": "string", "description": "ciudad o barrio"},
                    "caracteristicas": {"type": "array", "items": {"type": "string"},
                                        "description": "techada, sintético, blindex…"},
                },
            },
        )
    ]  # fmt: skip


def _catalogo(session: Session) -> str:
    """Los complejos visibles con sus deportes y el precio más bajo: así el asistente
    contesta '¿qué complejos hay?' o '¿cuánto sale?' sin buscar."""
    from app.models import Horario
    from app.routers.publico import negocios_visibles

    lineas = []
    for negocio in session.scalars(negocios_visibles().order_by(Negocio.nombre).limit(30)):
        with sesion_de_negocio(negocio.id) as s:
            filas = s.execute(
                select(Deporte.nombre, func.min(Horario.precio))
                .join(Recurso, Recurso.deporte_id == Deporte.id)
                .join(Horario, Horario.recurso_id == Recurso.id)
                .where(Recurso.negocio_id == negocio.id, Recurso.activo)
                .group_by(Deporte.nombre)
            ).all()
        if filas:
            deportes = ", ".join(f"{n} desde ${int(p)}" for n, p in filas)
            lineas.append(f"- {negocio.nombre} ({negocio.barrio or 'sin barrio'}): {deportes}")
    return "\n".join(lineas) or "- Todavía no hay complejos."


def _sistema(hoy: date, catalogo: str) -> str:
    return (
        "Sos el buscador de HayCancha (reservas de canchas en Argentina). Español rioplatense, "
        f"con voseo, cálido y breve. Hoy es {DIAS[hoy.weekday()]} {hoy.isoformat()}.\n"
        f"Complejos:\n{catalogo}\n"
        "Reglas:\n"
        "- Sé flexible: no pidas datos. Si falta el día, es hoy; si falta la hora, cualquier "
        "hora; si falta la zona, todas. 'Fútbol' sin número es cualquier fútbol. 'A la tarde' "
        "es 14 a 19 y 'a la noche', 19 a 23.\n"
        "- Para decir si hay cancha, usá buscar_turnos. No inventes turnos.\n"
        "- Si da 0, buscá de nuevo más amplio (otras horas, sin zona o características, o el "
        "día siguiente) y decí qué cambiaste.\n"
        "- Las preguntas generales (qué complejos hay, precios) contestalas con la lista.\n"
        "- Los turnos se muestran como tarjetas: respondé en 1 o 2 oraciones de texto plano, "
        "sin asteriscos, listas ni emojis. Para reservar: 'tocá la tarjeta'. Nunca digas "
        "'confirmar'."
    )


def conversar(session: Session, historial: list[dict[str, str]]) -> tuple[str, list[Resultado]]:
    """Responde el último mensaje del jugador. `historial` son mensajes {rol, texto}."""
    from zoneinfo import ZoneInfo

    hoy = datetime.now(ZoneInfo(ZONA_POR_DEFECTO)).date()
    mensajes: list[dict[str, Any]] = [
        {"role": "system", "content": _sistema(hoy, _catalogo(session))}
    ]
    for m in historial:
        mensajes.append({"role": "user" if m["rol"] == "usuario" else "assistant",
                         "content": m["texto"]})  # fmt: skip

    herramientas = _herramientas()
    ultimos: list[Resultado] = []
    for vuelta in range(MAX_VUELTAS):
        # En la última vuelta, sin herramientas: tiene que contestar con lo que ya encontró.
        ultima = vuelta == MAX_VUELTAS - 1
        respuesta = ia.responder(mensajes, [] if ultima else herramientas)
        if not respuesta.llamadas:
            return respuesta.texto or "Contame qué deporte y cuándo querés jugar.", ultimos
        mensajes.append(respuesta.mensaje)
        for llamada in respuesta.llamadas:
            if llamada.nombre != "buscar_turnos":
                mensajes.append(ia.resultado_de_herramienta(llamada, "No existe esa herramienta"))
                continue
            encontrados = _ejecutar_busqueda(session, hoy, llamada.argumentos)
            if encontrados:
                ultimos = encontrados
            mensajes.append(ia.resultado_de_herramienta(llamada, _resumen(encontrados)))
    return "Te dejo lo que encontré.", ultimos


def _ejecutar_busqueda(session: Session, hoy: date, argumentos: dict[str, Any]) -> list[Resultado]:
    try:
        fecha = date.fromisoformat(str(argumentos.get("fecha") or hoy.isoformat())[:10])
    except ValueError:
        fecha = hoy
    if not hoy <= fecha < hoy + timedelta(days=DIAS_RESERVABLES):
        return []
    caracteristicas = argumentos.get("caracteristicas")
    return buscar_turnos(
        session,
        fecha=fecha,
        deporte=argumentos.get("deporte") or None,
        hora_desde=_hora(argumentos.get("hora_desde")) if argumentos.get("hora_desde") else None,
        hora_hasta=_hora(argumentos.get("hora_hasta")) if argumentos.get("hora_hasta") else None,
        zona=argumentos.get("zona") or None,
        caracteristicas=caracteristicas if isinstance(caracteristicas, list) else None,
    )


def _resumen(resultados: list[Resultado]) -> str:
    """Lo que ve el modelo de una búsqueda: corto, para gastar pocos tokens."""
    if not resultados:
        return "0 turnos libres."
    lineas = [
        f"{r.complejo} ({r.barrio or ''}) · {r.deporte} · {r.cancha}"
        f"{f' ({r.caracteristicas})' if r.caracteristicas else ''} · {r.fecha} {r.hora} · "
        f"${int(float(r.precio))}"
        for r in resultados[:8]
    ]
    return f"{len(resultados)} turnos libres:\n" + "\n".join(lineas)
