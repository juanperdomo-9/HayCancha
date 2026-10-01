"""El modelo de lenguaje de los asistentes, detrás de una interfaz propia.

Hoy se usa Groq (plan gratis, modelo abierto) por su API compatible con OpenAI
(`/chat/completions`), que también ofrecen otros proveedores. Para cambiar de proveedor o
de modelo alcanza con las variables LLM_BASE_URL, LLM_MODELO y LLM_API_KEY. Se usa httpx,
sin SDK (decisión de Juan).

Los asistentes nunca confirman reservas ni pagos: el modelo solo puede usar las
herramientas que le pasa cada asistente, y ninguna confirma nada.
"""

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class ErrorDeIA(Exception):
    """El proveedor no respondió bien (caído, clave inválida, respuesta rara)."""


class CupoAgotado(ErrorDeIA):
    """Se alcanzó el límite del plan (por minuto o por día)."""


@dataclass(frozen=True)
class LlamadaAHerramienta:
    id: str
    nombre: str
    argumentos: dict[str, Any]


@dataclass
class Respuesta:
    texto: str
    llamadas: list[LlamadaAHerramienta] = field(default_factory=list)
    # El mensaje tal cual lo devolvió el proveedor, para volver a mandarlo en el historial.
    mensaje: dict[str, Any] = field(default_factory=dict)


def herramienta(nombre: str, descripcion: str, parametros: dict[str, Any]) -> dict[str, Any]:
    """Definición de una herramienta en el formato compatible con OpenAI."""
    return {
        "type": "function",
        "function": {"name": nombre, "description": descripcion, "parameters": parametros},
    }


def resultado_de_herramienta(llamada: LlamadaAHerramienta, contenido: Any) -> dict[str, Any]:
    return {
        "role": "tool",
        "tool_call_id": llamada.id,
        "content": json.dumps(contenido, ensure_ascii=False, default=str),
    }


def disponible() -> bool:
    return bool(get_settings().llm_api_key)


def _http() -> httpx.Client:
    """Cliente HTTP para el proveedor (los tests lo reemplazan)."""
    return httpx.Client(timeout=45)


# Segundos que vale la pena esperar si el proveedor pide reintentar (el jugador espera).
ESPERA_MAXIMA = 12


def _segundos(valor: str | None) -> float | None:
    try:
        return float(valor) if valor is not None else None
    except ValueError:
        return None


def _pedir(settings, cuerpo: dict[str, Any]) -> httpx.Response:
    try:
        with _http() as http:
            return http.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"},
                json=cuerpo,
            )
    except httpx.HTTPError as error:
        raise ErrorDeIA(f"El proveedor no respondió: {error}") from error


def responder(mensajes: list[dict[str, Any]], herramientas: list[dict[str, Any]]) -> Respuesta:
    """Un turno del modelo: devuelve texto y/o pedidos de herramientas."""
    settings = get_settings()
    if not settings.llm_api_key:
        raise ErrorDeIA("Falta LLM_API_KEY")
    cuerpo: dict[str, Any] = {
        "model": settings.llm_modelo,
        "messages": mensajes,
        "temperature": 0.2,
        "max_tokens": 500,
    }
    if herramientas:
        cuerpo["tools"] = herramientas
        cuerpo["tool_choice"] = "auto"
    r = _pedir(settings, cuerpo)
    if r.status_code == 429:
        # Límite por minuto del plan: si pide esperar poco, se espera y se reintenta una vez.
        espera = _segundos(r.headers.get("retry-after"))
        if espera is not None and espera <= ESPERA_MAXIMA:
            time.sleep(espera + 0.5)
            r = _pedir(settings, cuerpo)
    if r.status_code == 429:
        raise CupoAgotado("Límite del plan alcanzado")
    if r.status_code >= 400:
        logger.warning("El proveedor de IA respondió %s: %s", r.status_code, r.text[:300])
        raise ErrorDeIA(f"El proveedor respondió {r.status_code}")
    try:
        mensaje = r.json()["choices"][0]["message"]
    except (ValueError, KeyError, IndexError) as error:
        raise ErrorDeIA("Respuesta del proveedor incompleta") from error

    llamadas = []
    for llamada in mensaje.get("tool_calls") or []:
        try:
            argumentos = json.loads(llamada["function"].get("arguments") or "{}")
        except (ValueError, KeyError, TypeError):
            argumentos = {}
        llamadas.append(
            LlamadaAHerramienta(
                id=llamada.get("id", ""),
                nombre=llamada.get("function", {}).get("name", ""),
                argumentos=argumentos if isinstance(argumentos, dict) else {},
            )
        )
    # Se guarda solo lo que el proveedor necesita ver de vuelta en el historial.
    limpio: dict[str, Any] = {"role": "assistant", "content": mensaje.get("content") or ""}
    if mensaje.get("tool_calls"):
        limpio["tool_calls"] = mensaje["tool_calls"]
    return Respuesta(
        texto=(mensaje.get("content") or "").strip(), llamadas=llamadas, mensaje=limpio
    )
