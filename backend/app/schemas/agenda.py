"""La agenda del panel: la usan el dueño y los empleados."""

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

Origen = Literal["web", "panel", "bot"]
Estado = Literal["pendiente_pago", "confirmada", "vencida", "cancelada", "bloqueada"]


class ReservaEnAgenda(BaseModel):
    id: uuid.UUID
    estado: Estado
    cliente: str | None
    precio: Decimal | None
    sena: Decimal
    sena_en_efectivo: bool
    saldo: Decimal
    saldo_cobrado: bool
    # Si el complejo tiene precio en efectivo: lo que falta pagando así, y si se cobró así.
    saldo_efectivo: Decimal | None = None
    saldo_en_efectivo: bool = False
    origen: Origen
    asistencia: Literal["vino", "no_vino"] | None
    motivo_bloqueo: str | None
    minutos_para_pagar: int | None
    # Bloqueo fijo (todas las semanas): el id es el del bloqueo, no el de una reserva.
    fijo: bool = False


class TurnoEnAgenda(BaseModel):
    inicio: datetime
    fin: datetime
    hora: str
    hora_fin: str
    precio: Decimal
    # La seña que corresponde a este turno según la configuración del complejo.
    sena: Decimal
    pasado: bool
    reserva: ReservaEnAgenda | None


class CanchaEnAgenda(BaseModel):
    id: uuid.UUID
    nombre: str
    deporte: str
    deporte_nombre: str
    caracteristicas: str | None
    turnos: list[TurnoEnAgenda]


class Resumen(BaseModel):
    ocupados: int
    libres: int
    bloqueados: int
    senas_cobradas: Decimal
    saldo_por_cobrar: Decimal


class Agenda(BaseModel):
    fecha: date
    hoy: date
    canchas: list[CanchaEnAgenda]
    resumen: Resumen


class DiaDeLaSemana(BaseModel):
    fecha: date
    ocupados: int
    libres: int
    bloqueados: int


class Cliente(BaseModel):
    nombre: str
    telefono: str
    email: str | None


class ReservaDetalle(BaseModel):
    id: uuid.UUID
    estado: Estado
    cancha_id: uuid.UUID
    cancha: str
    deporte: str
    deporte_nombre: str
    fecha: date
    inicio: datetime
    fin: datetime
    hora: str
    hora_fin: str
    precio: Decimal | None
    sena: Decimal
    sena_en_efectivo: bool
    saldo: Decimal
    saldo_cobrado: bool
    # Si el complejo tiene precio en efectivo: lo que falta pagando así, y si se cobró así.
    saldo_efectivo: Decimal | None = None
    saldo_en_efectivo: bool = False
    asistencia: Literal["vino", "no_vino"] | None
    origen: Origen
    motivo_bloqueo: str | None
    minutos_para_pagar: int | None
    cliente: Cliente | None
    creado_a: datetime
    # La seña se pagó online (con Mercado Pago) y no se devolvió.
    sena_online: bool
    # Devolución de la seña pagada online: None, "pendiente" (en proceso) o "hecha".
    devolucion: Literal["pendiente", "hecha"] | None


class ReservaManual(BaseModel):
    """Alguien que llamó o vino en persona. Queda confirmada al instante."""

    recurso_id: uuid.UUID
    inicio: datetime
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    telefono: Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=40)]
    email: EmailStr | None = None
    sena_en_efectivo: bool = False


class CambiosDeReserva(BaseModel):
    asistencia: Literal["vino", "no_vino"] | None = None
    saldo_cobrado: bool | None = None
    saldo_en_efectivo: bool | None = None


class Cancelacion(BaseModel):
    # Solo cuenta si la seña se pagó online. Por defecto se devuelve.
    devolver_sena: bool = True


class Movimiento(BaseModel):
    recurso_id: uuid.UUID
    inicio: datetime


class TurnoABloquear(BaseModel):
    recurso_id: uuid.UUID
    inicio: datetime


class Bloqueo(BaseModel):
    turnos: Annotated[list[TurnoABloquear], Field(min_length=1, max_length=500)]
    motivo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class ResultadoDeBloqueo(BaseModel):
    bloqueados: int
    omitidos: int


class NuevoBloqueoFijo(BaseModel):
    dia_semana: Annotated[int, Field(ge=0, le=6)]
    desde: time
    hasta: time
    # None: todas las canchas.
    recurso_id: uuid.UUID | None = None
    motivo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class BloqueoFijo(BaseModel):
    id: uuid.UUID
    dia_semana: int
    desde: time
    hasta: time
    recurso_id: uuid.UUID | None
    cancha: str | None
    motivo: str


class BloqueoFijoCreado(BaseModel):
    bloqueo: BloqueoFijo
    # Reservas que ya existen en ese horario (próximas 8 semanas): el bloqueo no las cancela.
    reservas_existentes: int
