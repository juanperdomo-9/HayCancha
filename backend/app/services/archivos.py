"""Logos y portadas. Por ahora en una carpeta del backend; en la puesta en línea se
cambia por un almacenamiento de archivos sin tocar el resto (solo esta función)."""

import uuid

from app.config import get_settings

TAMANIO_MAXIMO = 5 * 1024 * 1024

# Solo imágenes rasterizadas: un SVG puede traer scripts.
FIRMAS = {
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpg",
}


class ArchivoInvalido(Exception):
    pass


def tipo_de_imagen(contenido: bytes) -> str:
    for firma, extension in FIRMAS.items():
        if contenido.startswith(firma):
            return extension
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "webp"
    raise ArchivoInvalido("Subí una imagen PNG, JPG o WEBP.")


def guardar_imagen(negocio_id: uuid.UUID, nombre: str, contenido: bytes) -> str:
    """Guarda la imagen y devuelve su URL pública."""
    if len(contenido) > TAMANIO_MAXIMO:
        raise ArchivoInvalido("La imagen pesa más de 5 MB. Probá con una más liviana.")
    extension = tipo_de_imagen(contenido)
    settings = get_settings()
    carpeta = settings.carpeta_archivos / str(negocio_id)
    carpeta.mkdir(parents=True, exist_ok=True)
    archivo = f"{nombre}-{uuid.uuid4().hex[:10]}.{extension}"
    (carpeta / archivo).write_bytes(contenido)
    return f"{settings.app_base_url}/archivos/{negocio_id}/{archivo}"
