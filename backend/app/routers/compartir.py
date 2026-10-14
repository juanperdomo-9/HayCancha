"""Link para compartir un complejo: haycanchas.com.ar/c/{slug}.

WhatsApp, Instagram y Facebook no ejecutan la página (React): solo leen las etiquetas del
HTML. Esta ruta devuelve un HTML mínimo con la vista previa de ese complejo (nombre,
deportes y foto) y manda a las personas a la página real. La página la sirve Render, que
pasa /c/* a esta ruta (ver render.yaml)."""

from html import escape
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session, sesion_de_negocio
from app.models import Foto, Negocio
from app.routers.publico import deportes_del_negocio, negocios_visibles

router = APIRouter(tags=["compartir"])


def _imagen(s: Session, negocio: Negocio) -> str:
    """La portada; si no hay, la primera foto; si no, el logo; si no, la de HayCanchas."""
    if negocio.portada_url:
        return negocio.portada_url
    primera = s.scalar(
        select(Foto.url)
        .where(Foto.negocio_id == negocio.id)
        .order_by(Foto.orden, Foto.creado_a)
        .limit(1)
    )
    return primera or negocio.logo_url or f"{get_settings().frontend_url}/compartir.png"


@router.get("/compartir/{slug}", response_class=HTMLResponse, response_model=None)
def compartir(
    slug: str, session: Annotated[Session, Depends(get_session)]
) -> HTMLResponse | RedirectResponse:
    frontend = get_settings().frontend_url
    negocio = session.scalar(negocios_visibles().where(Negocio.slug == slug))
    if negocio is None:
        return RedirectResponse(frontend, status_code=302)
    with sesion_de_negocio(negocio.id) as s:
        deportes = [d.nombre for d in deportes_del_negocio(s, negocio.id)]
        imagen = _imagen(s, negocio)
    destino = f"{frontend}/{quote(negocio.slug)}"
    titulo = f"Reservá tu cancha en {negocio.nombre}"
    partes = [" · ".join(deportes) if deportes else None, negocio.barrio]
    descripcion = (
        " · ".join(p for p in partes if p)
        + ". Mirá los horarios libres y reservá con seña online en HayCanchas."
    ).lstrip(". ")
    e = escape
    html = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>{e(titulo)}</title>
<meta name="description" content="{e(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="HayCanchas">
<meta property="og:locale" content="es_AR">
<meta property="og:url" content="{e(destino)}">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(descripcion)}">
<meta property="og:image" content="{e(imagen)}">
<meta property="og:image:alt" content="{e(negocio.nombre)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(titulo)}">
<meta name="twitter:description" content="{e(descripcion)}">
<meta name="twitter:image" content="{e(imagen)}">
<link rel="canonical" href="{e(destino)}">
<meta http-equiv="refresh" content="0; url={e(destino)}">
</head><body>
<p><a href="{e(destino)}">Ir a {e(negocio.nombre)} en HayCanchas</a></p>
<script>location.replace({destino!r})</script>
</body></html>"""
    return HTMLResponse(html, headers={"Cache-Control": "public, max-age=300"})
