"""La agenda del panel: la usan el dueño y los empleados."""

import uuid
from datetime import date, datetime
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
    origen: Origen
    asistencia: Literal["vino", "no_vino"] | None
    motivo_bloqueo: str | None
    minutos_para_pagar: int | None


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
    asistencia: Literal["vino", "no_vino"] | None
    origen: Origen
    motivo_bloqueo: str | None
    minutos_para_pagar: int | None
    cliente: Cliente | None
    creado_a: datetime


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
