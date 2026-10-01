"""Asistente de la página principal: busca turnos libres en todos los complejos.

El jugador escribe como en un chat ("fútbol 5 hoy a las 19 en La Plata, techada") y el
modelo usa la herramienta `buscar_turnos`, que filtra con la misma disponibilidad que la
página de cada complejo. El modelo no inventa turnos: solo cuenta lo que devolvió la
búsqueda, y las tarjetas que ve el jugador salen de esos resultados.
"""

import unicodedata
from dataclasses import asdict, dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import select
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
                if deporte and codigo != deporte:
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


def _herramientas(deportes: list[tuple[str, str]]) -> list[dict[str, Any]]:
    return [
        ia.herramienta(
            "buscar_turnos",
            "Busca turnos libres en los complejos de HayCancha. Usala siempre antes de decir "
            "si hay o no hay cancha. Todos los filtros son opcionales salvo la fecha.",
            {
                "type": "object",
                "properties": {
                    "fecha": {"type": "string", "description": "Día, en formato AAAA-MM-DD."},
                    "deporte": {
                        "type": "string",
                        "enum": [codigo for codigo, _ in deportes],
                        "description": "Código del deporte: "
                        + ", ".join(f"{c} ({n})" for c, n in deportes),
                    },
                    "hora_desde": {"type": "string", "description": "Hora mínima, HH:MM."},
                    "hora_hasta": {"type": "string", "description": "Hora máxima, HH:MM."},
                    "zona": {
                        "type": "string",
                        "description": "Ciudad o barrio, por ejemplo 'La Plata'.",
                    },
                    "caracteristicas": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Palabras que tiene que tener la cancha: techada, "
                        "sintético, blindex, parquet, cemento…",
                    },
                },
                "required": ["fecha"],
            },
        )
    ]


def _sistema(hoy: date, deportes: list[tuple[str, str]], zonas: list[str]) -> str:
    manana = hoy + timedelta(days=1)
    return (
        "Sos el buscador de HayCancha, una web para reservar canchas en Argentina. Hablás en "
        "español rioplatense, con voseo, cálido y breve.\n"
        f"Hoy es {DIAS[hoy.weekday()]} {hoy.isoformat()} (mañana es {manana.isoformat()}). "
        f"Se puede buscar hasta {DIAS_RESERVABLES} días para adelante.\n"
        "Deportes: " + ", ".join(f"{n} ({c})" for c, n in deportes) + ".\n"
        "Zonas con complejos: " + (", ".join(zonas) or "ninguna todavía") + ".\n\n"
        "Cómo trabajás:\n"
        "- Para saber si hay cancha, usá SIEMPRE la herramienta buscar_turnos. Nunca inventes "
        "turnos, precios ni complejos.\n"
        "- Si no dicen el día, es hoy. Si dicen una hora ('a las 19'), buscá con hora_desde y "
        "hora_hasta iguales. 'A la tarde' es de 14 a 19 y 'a la noche', de 19 a 23.\n"
        "- Si una búsqueda da 0 resultados, ANTES de responder volvé a buscar ampliando: "
        "primero 2 horas antes y después; si sigue sin haber, sin el filtro de zona o de "
        "características; si sigue sin haber, el día siguiente. Ofrecé lo que encuentres "
        "aclarando qué cambiaste.\n"
        "- Si piden algo de la cancha (techada, sintético), pasalo en caracteristicas.\n"
        "- Los resultados se le muestran al jugador como tarjetas: vos respondé en 1 o 2 "
        "oraciones de texto plano, sin repetir la lista, sin precios y SIN formato: nada de "
        "asteriscos, negritas, listas, emojis ni links.\n"
        "- No podés reservar ni confirmar nada. Para reservar, el jugador toca la tarjeta: "
        "decí 'tocá la tarjeta para reservar', nunca 'confirmar'.\n"
        "- Si te preguntan algo que no es buscar cancha, contestá corto y volvé a la búsqueda."
    )


def conversar(session: Session, historial: list[dict[str, str]]) -> tuple[str, list[Resultado]]:
    """Responde el último mensaje del jugador. `historial` son mensajes {rol, texto}."""
    from app.routers.publico import negocios_visibles

    deportes = [tuple(fila) for fila in session.execute(
        select(Deporte.codigo, Deporte.nombre).order_by(Deporte.nombre)
    ).all()]  # fmt: skip
    zonas = sorted({n.barrio for n in session.scalars(negocios_visibles()) if n.barrio})
    from zoneinfo import ZoneInfo

    hoy = datetime.now(ZoneInfo(ZONA_POR_DEFECTO)).date()
    mensajes: list[dict[str, Any]] = [{"role": "system", "content": _sistema(hoy, deportes, zonas)}]
    for m in historial:
        mensajes.append({"role": "user" if m["rol"] == "usuario" else "assistant",
                         "content": m["texto"]})  # fmt: skip

    herramientas = _herramientas(deportes)
    ultimos: list[Resultado] = []
    for vuelta in range(MAX_VUELTAS):
        # En la última vuelta, sin herramientas: tiene que contestar con lo que ya encontró.
        ultima = vuelta == MAX_VUELTAS - 1
        respuesta = ia.responder(mensajes, [] if ultima else herramientas)
        if not respuesta.llamadas:
            return respuesta.texto or "No te entendí bien, ¿me lo decís de otra forma?", ultimos
        mensajes.append(respuesta.mensaje)
        for llamada in respuesta.llamadas:
            if llamada.nombre != "buscar_turnos":
                mensajes.append(ia.resultado_de_herramienta(llamada, {"error": "No existe"}))
                continue
            ultimos = _ejecutar_busqueda(session, hoy, llamada.argumentos)
            mensajes.append(
                ia.resultado_de_herramienta(
                    llamada,
                    {"cantidad": len(ultimos), "turnos": [_para_el_modelo(r) for r in ultimos]},
                )
            )
    return "Te dejo lo que encontré.", ultimos


def _ejecutar_busqueda(session: Session, hoy: date, argumentos: dict[str, Any]) -> list[Resultado]:
    try:
        fecha = date.fromisoformat(str(argumentos.get("fecha", hoy.isoformat()))[:10])
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


def _para_el_modelo(r: Resultado) -> dict[str, Any]:
    datos = asdict(r)
    datos.pop("slug")
    datos.pop("deporte_codigo")
    return datos
