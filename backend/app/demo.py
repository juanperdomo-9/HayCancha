"""Complejos ficticios para grabar los videos y las piezas de HayCanchas.

Todo es inventado: nombres, direcciones, jugadores y usuarios. Sin fotos: la página
muestra el dibujo de la cancha con el color del complejo. Solo para la base local."""

from datetime import time
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.ejemplo import (
    Franja,
    borrar_negocio,
    cargar_canchas,
    cargar_reservas_de_ejemplo,
)
from app.models import Adicional, Negocio, Usuario
from app.services.auth import hashear_clave

# Usuario de prueba del complejo principal, SOLO para la base local.
DUENO_DEMO = ("dueno@losceibos.example", "ceibos-local-2026")

JUGADORES = [
    ("Martín Gómez", "1155502001"),
    ("Sofía Ruiz", "1155502002"),
    ("Lucas Pereyra", "1155502003"),
    ("Julieta Martínez", "1155502004"),
    ("Tomás Acosta", "1155502005"),
    ("Nicolás Benítez", "1155502006"),
    ("Agustín López", "1155502007"),
    ("Federico Sosa", "1155502008"),
    ("Camila Fernández", "1155502009"),
    ("Joaquín Romero", "1155502010"),
]

COMPLEJOS = [
    {
        "slug": "los-ceibos",
        "nombre": "Los Ceibos Fútbol",
        "color_primario": "#0F5FA8",
        "color_secundario": "#F28C28",
        "direccion": "Calle 528 N° 1150",
        "barrio": "Tolosa, La Plata",
        "referencia": "A tres cuadras de la estación de Tolosa",
        "latitud": -34.8995,
        "longitud": -57.9690,
        "servicios": ["Vestuarios con duchas", "Estacionamiento", "Buffet", "Parrilla", "Wi-Fi"],
        "reglas": [
            "Prohibido jugar con botines de fútbol 11 (tapones) en el sintético",
            "No se permiten bebidas alcohólicas",
            "El saldo se paga en la cancha",
        ],
        "adicionales": [("Parrilla", Decimal("10000")), ("Pelota", Decimal("3000"))],
        "canchas": {
            "futbol7": (
                [
                    ("Cancha 1", "Césped sintético"),
                    ("Cancha 2", "Césped sintético"),
                    ("Cancha 3", "Césped sintético, techada"),
                ],
                60,
                [
                    Franja(time(9), time(18), Decimal("85000")),
                    Franja(time(18), time(1), Decimal("105000")),
                ],
            ),
            "futbol5": (
                [("Cancha 4", "Césped sintético"), ("Cancha 5", "Césped sintético, techada")],
                60,
                [
                    Franja(time(9), time(18), Decimal("60000")),
                    Franja(time(18), time(1), Decimal("75000")),
                ],
            ),
            "padel": (
                [("Pádel 1", "Blindex, techada")],
                90,
                [
                    Franja(time(8), time(18), Decimal("36000")),
                    Franja(time(18), time(0), Decimal("45000")),
                ],
            ),
        },
        "ocupacion": [
            ("futbol7", time(19), 60, (2, 1)),
            ("futbol7", time(20), 60, (2, 2)),
            ("futbol7", time(22), 60, (3, 2)),
            ("futbol5", time(20), 60, (1, 1)),
            ("futbol5", time(21), 60, (1, 0)),
            ("padel", time(19, 30), 90, (1, 0)),
        ],
    },
    {
        "slug": "punto-padel-city-bell",
        "nombre": "Punto Pádel City Bell",
        "color_primario": "#7A3BC2",
        "color_secundario": None,
        "direccion": "Cantilo N° 1450",
        "barrio": "City Bell, La Plata",
        "referencia": None,
        "latitud": -34.8687,
        "longitud": -58.0469,
        "servicios": ["Vestuarios", "Alquiler de paletas", "Bar", "Estacionamiento"],
        "canchas": {
            "padel": (
                [
                    ("Pádel 1", "Blindex, techada"),
                    ("Pádel 2", "Blindex, techada"),
                    ("Pádel 3", "Blindex, descubierta"),
                ],
                90,
                [
                    Franja(time(8), time(18), Decimal("38000")),
                    Franja(time(18), time(0), Decimal("48000")),
                ],
            ),
        },
        "ocupacion": [("padel", time(18, 30), 90, (2, 1)), ("padel", time(20), 90, (3, 2))],
    },
    {
        "slug": "la-redonda-f5",
        "nombre": "La Redonda F5",
        "color_primario": "#C62828",
        "color_secundario": None,
        "direccion": "Calle 66 N° 2340",
        "barrio": "Los Hornos, La Plata",
        "referencia": None,
        "latitud": -34.9580,
        "longitud": -57.9760,
        "servicios": ["Vestuarios", "Buffet", "Pantalla para partidos"],
        "canchas": {
            "futbol5": (
                [("Cancha 1", "Césped sintético"), ("Cancha 2", "Césped sintético")],
                60,
                [
                    Franja(time(10), time(18), Decimal("55000")),
                    Franja(time(18), time(1), Decimal("70000")),
                ],
            ),
        },
        "ocupacion": [("futbol5", time(20), 60, (2, 1)), ("futbol5", time(21), 60, (1, 2))],
    },
]


def cargar_demo(session: Session) -> list[Negocio]:
    """Crea (o rehace) los complejos ficticios y deja inactivos los demás."""
    if not get_settings().app_base_url.startswith("http://localhost"):
        raise SystemExit("Los complejos de la demo son solo para la base local.")
    slugs = [c["slug"] for c in COMPLEJOS]
    for slug in slugs:
        existente = session.scalar(select(Negocio).where(Negocio.slug == slug))
        if existente is not None:
            borrar_negocio(session, existente)
    session.execute(update(Negocio).where(Negocio.slug.not_in(slugs)).values(activo=False))

    creados = []
    for datos in COMPLEJOS:
        negocio = Negocio(
            slug=datos["slug"],
            nombre=datos["nombre"],
            color_primario=datos["color_primario"],
            color_secundario=datos["color_secundario"],
            direccion=datos["direccion"],
            barrio=datos["barrio"],
            referencia=datos["referencia"],
            latitud=datos["latitud"],
            longitud=datos["longitud"],
            servicios=datos["servicios"],
            reglas=datos.get("reglas", []),
            sena_tipo="porcentaje",
            sena_valor=Decimal("20"),
            horas_cancelacion=24,
        )
        session.add(negocio)
        session.flush()
        cargar_canchas(session, negocio, datos["canchas"])
        for orden, (nombre, precio) in enumerate(datos.get("adicionales", [])):
            session.add(Adicional(negocio_id=negocio.id, nombre=nombre, precio=precio, orden=orden))
        cargar_reservas_de_ejemplo(
            session,
            negocio,
            canchas_datos=datos["canchas"],
            jugadores=JUGADORES,
            ocupacion=datos["ocupacion"],
        )
        creados.append(negocio)

    email, clave = DUENO_DEMO
    usuario = session.scalar(select(Usuario).where(Usuario.email == email))
    if usuario is not None:
        session.delete(usuario)
        session.flush()
    session.add(
        Usuario(
            email=email, rol="dueno", negocio_id=creados[0].id, password_hash=hashear_clave(clave)
        )
    )
    session.flush()
    return creados
