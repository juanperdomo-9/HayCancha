from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session
from app.routers import admin, agenda, auth, panel, publico, reservas_online

app = FastAPI(title="HayCancha")
app.include_router(publico.router)
app.include_router(reservas_online.router)
app.include_router(auth.router)
app.include_router(panel.router)
app.include_router(agenda.router)
app.include_router(admin.router)

# Logos y portadas subidos desde el panel.
_archivos = get_settings().carpeta_archivos
_archivos.mkdir(parents=True, exist_ok=True)
app.mount("/archivos", StaticFiles(directory=_archivos), name="archivos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cabeceras_de_seguridad(request: Request, llamar_siguiente):
    respuesta = await llamar_siguiente(request)
    # Que el navegador no "adivine" el tipo de un archivo subido.
    respuesta.headers["X-Content-Type-Options"] = "nosniff"
    return respuesta


@app.get("/health")
def health(response: Response, session: Annotated[Session, Depends(get_session)]) -> dict[str, str]:
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"api": "ok", "base": "error"}
    return {"api": "ok", "base": "ok"}
