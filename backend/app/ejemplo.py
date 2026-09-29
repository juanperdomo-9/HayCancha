"""Complejo de ejemplo para desarrollo: El Potrero, con 4 canchas de fútbol 7, 1 de
fútbol 5 y 1 de pádel, y algunas reservas para la próxima semana. Todo es de ejemplo."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Cliente, Deporte, Horario, Negocio, Recurso, Reserva
from app.services.disponibilidad import ahora, hoy_en_el_negocio, zona_del_negocio
from app.services.sena import calcular_sena

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
        for tabla in (Reserva, Cliente, Horario, Recurso):
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
    cargar_reservas_de_ejemplo(session, negocio)
    return negocio


JUGADORES = [
    ("Martín Gómez", "1155501001"),
    ("Sofía Ruiz", "1155501002"),
    ("Lucas Pereyra", "1155501003"),
    ("Juli Martínez", "1155501004"),
    ("Tomás Acosta", "1155501005"),
    ("Nico Benítez", "1155501006"),
    ("Agus López", "1155501007"),
    ("Fede Sosa", "1155501008"),
]

# (deporte, hora, minutos, cuántas canchas ocupar en los días pares e impares)
OCUPACION = [
    ("futbol7", time(19), 60, (2, 1)),
    ("futbol7", time(20), 60, (3, 2)),
    ("futbol7", time(21), 60, (4, 3)),
    ("futbol7", time(22), 60, (3, 2)),
    ("futbol5", time(20), 60, (1, 0)),
    ("futbol5", time(21), 60, (1, 1)),
    ("padel", time(20), 90, (1, 1)),
    ("padel", time(18, 30), 90, (0, 1)),
]


def _precio(codigo: str, hora: time) -> Decimal:
    for franja in CANCHAS[codigo][2]:
        if franja.desde <= hora and (hora < franja.hasta or franja.hasta <= franja.desde):
            return franja.precio
    raise ValueError(f"{hora} no está en los horarios de {codigo}")


def cargar_reservas_de_ejemplo(session: Session, negocio: Negocio, dias: int = 7) -> None:
    """Reservas confirmadas y un bloqueo en los próximos días, para ver la página con
    turnos a medio llenar. Se calculan desde hoy: para renovarlas, --reemplazar."""
    zona = zona_del_negocio(negocio)
    hoy = hoy_en_el_negocio(negocio)
    canchas: dict[str, list[Recurso]] = {}
    for recurso, codigo in session.execute(
        select(Recurso, Deporte.codigo)
        .join(Deporte, Deporte.id == Recurso.deporte_id)
        .where(Recurso.negocio_id == negocio.id)
        .order_by(Recurso.orden)
    ):
        canchas.setdefault(codigo, []).append(recurso)

    clientes = []
    for nombre, telefono in JUGADORES:
        cliente = Cliente(negocio_id=negocio.id, nombre=nombre, telefono=telefono)
        session.add(cliente)
        clientes.append(cliente)
    session.flush()

    def momento(fecha: date, hora: time) -> datetime:
        return datetime.combine(fecha, hora, tzinfo=zona)

    manana = hoy + timedelta(days=1)
    bloqueada = (canchas["futbol7"][3].id, momento(manana, time(22)))
    session.add(
        Reserva(
            negocio_id=negocio.id,
            recurso_id=bloqueada[0],
            inicio=bloqueada[1],
            fin=bloqueada[1] + timedelta(hours=1),
            estado="bloqueada",
            motivo_bloqueo="Mantenimiento",
            origen="panel",
        )
    )

    n = 0
    for i in range(dias):
        fecha = hoy + timedelta(days=i)
        for codigo, hora, minutos, (pares, impares) in OCUPACION:
            inicio = momento(fecha, hora)
            if inicio <= ahora():
                continue
            lista = canchas[codigo]
            for k in range(pares if i % 2 == 0 else impares):
                recurso = lista[(k + i) % len(lista)]
                if (recurso.id, inicio) == bloqueada:
                    continue
                precio = _precio(codigo, hora)
                session.add(
                    Reserva(
                        negocio_id=negocio.id,
                        recurso_id=recurso.id,
                        cliente_id=clientes[n % len(clientes)].id,
                        inicio=inicio,
                        fin=inicio + timedelta(minutes=minutos),
                        estado="confirmada",
                        precio=precio,
                        sena=calcular_sena(negocio, precio),
                        origen="web" if n % 3 else "panel",
                    )
                )
                n += 1
    session.flush()
