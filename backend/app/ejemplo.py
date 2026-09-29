"""Complejo de ejemplo para desarrollo: El Potrero, con 4 canchas de fútbol 7, 1 de
fútbol 5 y 1 de pádel. Los precios son de ejemplo."""

from dataclasses import dataclass
from datetime import time
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Deporte, Horario, Negocio, Recurso

SLUG_EJEMPLO = "el-potrero"


@dataclass(frozen=True)
class Franja:
    desde: time
    hasta: time
    precio: Decimal


# deporte -> (canchas [(nombre, características)], duración, franjas de todos los días)
CANCHAS: dict[str, tuple[list[tuple[str, str]], int, list[Franja]]] = {
    "futbol7": (
        [
            ("Cancha 1", "Sintético"),
            ("Cancha 2", "Sintético"),
            ("Cancha 3", "Sintético, techada"),
            ("Cancha 4", "Sintético, techada"),
        ],
        60,
        [
            Franja(time(9), time(18), Decimal("70000")),
            Franja(time(18), time(0), Decimal("85000")),  # hasta medianoche
        ],
    ),
    "futbol5": (
        [("Cancha 5", "Sintético")],
        60,
        [
            Franja(time(9), time(18), Decimal("50000")),
            Franja(time(18), time(0), Decimal("60000")),
        ],
    ),
    "padel": (
        [("Pádel 1", "Blindex, techada")],
        90,
        [
            Franja(time(8), time(17), Decimal("32000")),
            Franja(time(17), time(23), Decimal("36000")),
        ],
    ),
}


def cargar_ejemplo(session: Session, *, reemplazar: bool = False) -> Negocio:
    """Crea El Potrero con sus canchas y horarios. Usa la sesión de administrador."""
    existente = session.scalar(select(Negocio).where(Negocio.slug == SLUG_EJEMPLO))
    if existente is not None:
        if not reemplazar:
            return existente
        for tabla in (Horario, Recurso):
            session.execute(delete(tabla).where(tabla.negocio_id == existente.id))
        session.delete(existente)
        session.flush()

    negocio = Negocio(
        slug=SLUG_EJEMPLO,
        nombre="El Potrero",
        color_primario="#1F8A4C",
        direccion="Av. Triunvirato 4820",
        barrio="Villa Urquiza",
        servicios=["Vestuarios con duchas", "Estacionamiento", "Bufé", "Parrilla"],
        sena_tipo="porcentaje",
        sena_valor=Decimal("20"),
        horas_cancelacion=24,
    )
    session.add(negocio)
    session.flush()

    deportes = {d.codigo: d for d in session.scalars(select(Deporte))}
    orden = 0
    for codigo, (canchas, duracion, franjas) in CANCHAS.items():
        for nombre, caracteristicas in canchas:
            recurso = Recurso(
                negocio_id=negocio.id,
                deporte_id=deportes[codigo].id,
                nombre=nombre,
                caracteristicas=caracteristicas,
                orden=orden,
            )
            orden += 1
            session.add(recurso)
            session.flush()
            for dia in range(7):
                for franja in franjas:
                    session.add(
                        Horario(
                            negocio_id=negocio.id,
                            recurso_id=recurso.id,
                            dia_semana=dia,
                            desde=franja.desde,
                            hasta=franja.hasta,
                            duracion_turno_min=duracion,
                            precio=franja.precio,
                        )
                    )
    session.flush()
    return negocio
