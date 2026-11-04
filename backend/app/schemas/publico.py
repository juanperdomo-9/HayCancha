"""Lo que devuelven las rutas públicas. Solo campos públicos: nunca tokens, datos de
cobro ni datos de otros jugadores."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class Deporte(BaseModel):
    codigo: str
    nombre: str


class ProximoTurno(BaseModel):
    fecha: date
    hora: str


class ComplejoResumen(BaseModel):
    slug: str
    nombre: str
    barrio: str | None
    logo_url: str | None
    portada_url: str | None
    color_primario: str
    color_secundario: str | None
    deportes: list[Deporte]
    hoy: date
    proximo_turno: ProximoTurno | None
    latitud: float | None
    longitud: float | None
    # Lo que tienen sus canchas ("Techada", "Sintético"), para filtrar en el mapa.
    caracteristicas: list[str] = []


class ComplejoConLugar(BaseModel):
    """Un complejo con canchas libres en el día y la hora que se buscó (mapa general)."""

    slug: str
    fecha: date
    deporte_codigo: str
    hora: str
    canchas: int
    horas: list[str]
    precio_desde: Decimal


class Cancha(BaseModel):
    id: uuid.UUID
    nombre: str
    caracteristicas: str | None


class DeporteDelComplejo(Deporte):
    duraciones_min: list[int]
    precio_desde: Decimal | None
    canchas: list[Cancha]


class AdicionalPublico(BaseModel):
    id: uuid.UUID
    nombre: str
    precio: Decimal
    # Si es de un solo deporte (las paletas, del pádel). None: para todos.
    deporte: str | None = None


class CumpleanosPublico(BaseModel):
    id: uuid.UUID
    nombre: str
    deporte: str  # código: con él se buscan las canchas
    duracion_min: int
    precio: Decimal
    incluye: str | None = None
    condiciones: str | None = None
    # Días y horarios en que se festeja: {dia_semana, desde, hasta}. Vacía: siempre.
    franjas: list[dict] = []


class FotoPublica(BaseModel):
    url: str
    texto: str | None = None


class ComplejoDetalle(BaseModel):
    slug: str
    nombre: str
    barrio: str | None
    direccion: str | None
    referencia: str | None
    whatsapp: str | None
    # Ubicación exacta para el mapa de la página (la dirección escrita a veces se ubica mal).
    latitud: float | None = None
    longitud: float | None = None
    # Asistente de IA del complejo: None si está apagado o no hay proveedor configurado.
    asistente: dict[str, str] | None = None
    servicios: list[str]
    reglas: list[str] = []
    logo_url: str | None
    portada_url: str | None
    color_primario: str
    color_secundario: str | None
    hoy: date
    dias_reservables: int
    sena_tipo: str
    sena_valor: Decimal
    horas_cancelacion: int
    minutos_para_pagar: int
    # Si ya puede cobrar la seña online (Mercado Pago vinculado).
    reservas_online: bool
    # No cobra seña: el turno queda reservado al instante.
    sin_sena: bool = False
    deportes: list[DeporteDelComplejo]
    fotos: list[FotoPublica] = []
    adicionales: list[AdicionalPublico] = []
    # Cumpleaños que ofrece el complejo (sin seña: se reservan aunque no tenga
    # Mercado Pago vinculado).
    cumpleanos: list[CumpleanosPublico] = []


class CanchaLibre(Cancha):
    precio: Decimal
    sena: Decimal
    # Lo que se paga encima de la seña online (la comisión de Mercado Pago).
    cargo_servicio: Decimal = Decimal("0.00")
    # Si el jugador ve una sola seña (seña + cargo) en vez de los dos por separado.
    cargo_en_sena: bool = False
    precio_efectivo: Decimal | None = None


class Turno(BaseModel):
    inicio: datetime
    fin: datetime
    hora: str
    hora_fin: str
    duracion_min: int
    precio: Decimal | None
    canchas_total: int
    libres: list[CanchaLibre]


class Disponibilidad(BaseModel):
    fecha: date
    deporte: str
    turnos: list[Turno]
