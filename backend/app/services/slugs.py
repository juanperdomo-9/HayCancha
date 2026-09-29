"""La dirección de cada complejo: haycancha.com.ar/<slug>."""

import re
import unicodedata

# Rutas del sistema: ningún complejo puede usarlas (ver CLAUDE.md, "Rutas y slugs reservados").
RESERVADOS = frozenset(
    {
        "panel",
        "admin",
        "ingresar",
        "api",
        "precios",
        "ayuda",
        "terminos",
        "privacidad",
        "complejos",
        "duenos",
        "diseno",
        "publico",
        "auth",
        "archivos",
        "health",
    }
)
FORMATO = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
LARGO_MAXIMO = 60


def validar_slug(slug: str) -> str:
    if not FORMATO.fullmatch(slug) or len(slug) > LARGO_MAXIMO:
        raise ValueError(
            "Usá solo minúsculas, números y guiones (por ejemplo, el-potrero), sin espacios."
        )
    if slug in RESERVADOS:
        raise ValueError(f"«{slug}» lo usa el sistema. Elegí otra dirección.")
    return slug


def sugerir_slug(nombre: str) -> str:
    """'Pádel Norte & Co.' -> 'padel-norte-co'."""
    sin_tildes = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")[:LARGO_MAXIMO].strip("-")
