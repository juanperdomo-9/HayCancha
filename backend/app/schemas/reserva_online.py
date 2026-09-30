"""Reservas online del jugador. Sin cuenta: el link de la reserva (con su id) es lo que la
identifica, así que solo se devuelven datos que puede ver quien lo tiene."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, StringConstraints


class NuevaReserva(BaseModel):
    deporte: str
    inicio: datetime
    recurso_id: uuid.UUID | None = None
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    telefono: Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=40)]
    email: EmailStr | None = None


class ReservaCreada(BaseModel):
    id: uuid.UUID
    # A dónde ir a pagar (Mercado Pago). None: se paga en la página de la reserva (simulado).
    url_pago: str | None


class ReservaPublica(BaseModel):
    id: uuid.UUID
    estado: Literal["pendiente_pago", "confirmada", "vencida", "cancelada"]
    complejo: str
    slug: str
    color_primario: str
    color_secundario: str | None
    logo_url: str | None
    jugador: str  # solo el nombre de pila
    cancha: str
    deporte: str
    fecha: date
    hora: str
    hora_fin: str
    precio: Decimal
    sena: Decimal
    saldo: Decimal
    vence_a: datetime | None
    url_pago: str | None
    pago_simulado: bool
    horas_cancelacion: int
    direccion: str | None
    barrio: str | None
    referencia: str | None
