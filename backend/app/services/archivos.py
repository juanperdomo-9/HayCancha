"""Logos y portadas.

- Con SUPABASE_URL y SUPABASE_SECRET_KEY (producción): en Supabase Storage, en un bucket
  público. El disco de Render se borra en cada deploy, así que ahí no pueden quedar.
- Sin eso (desarrollo): en una carpeta del backend (CARPETA_ARCHIVOS).

Storage se usa por su API REST con httpx, sin sumar librerías:
https://supabase.com/docs/reference/api/storage
"""

import uuid

import httpx

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
    archivo = f"{nombre}-{uuid.uuid4().hex[:10]}.{extension}"
    if settings.supabase_url and settings.supabase_secret_key:
        return _subir_a_supabase(f"{negocio_id}/{archivo}", contenido, extension)
    carpeta = settings.carpeta_archivos / str(negocio_id)
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / archivo).write_bytes(contenido)
    return f"{settings.app_base_url}/archivos/{negocio_id}/{archivo}"


TIPOS = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}


def _http() -> httpx.Client:
    """Cliente HTTP para Supabase Storage (los tests lo reemplazan)."""
    return httpx.Client(timeout=30)


def _subir_a_supabase(ruta: str, contenido: bytes, extension: str) -> str:
    settings = get_settings()
    base = settings.supabase_url.rstrip("/")
    clave = settings.supabase_secret_key
    # Las claves nuevas (sb_secret_...) van en el header apikey; las viejas (service_role,
    # un JWT) además en Authorization.
    headers = {"apikey": clave, "Content-Type": TIPOS[extension], "x-upsert": "true"}
    if clave.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {clave}"
    try:
        with _http() as http:
            respuesta = http.post(
                f"{base}/storage/v1/object/{settings.supabase_bucket}/{ruta}",
                headers=headers,
                content=contenido,
            )
    except httpx.HTTPError as error:
        raise ArchivoInvalido("No pudimos guardar la imagen. Probá de nuevo en un rato.") from error
    if respuesta.status_code >= 400:
        raise ArchivoInvalido("No pudimos guardar la imagen. Probá de nuevo en un rato.")
    return f"{base}/storage/v1/object/public/{settings.supabase_bucket}/{ruta}"
