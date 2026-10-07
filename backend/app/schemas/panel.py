"""Panel del dueño, alta de complejos y sesión."""

import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

Color = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
TextoOpcional = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Rol = Literal["superadmin", "dueno", "empleado"]


# --- Sesión ---


class Ingreso(BaseModel):
    # Email (dueños y empleados) o nombre de usuario (superadmins de HayCanchas).
    email: Annotated[
        str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=254)
    ]
    clave: str


class NuevaClave(BaseModel):
    token: str
    clave: Annotated[str, Field(min_length=8, max_length=200)]


class NegocioDelUsuario(BaseModel):
    slug: str
    nombre: str
    color_primario: str
    logo_url: str | None


class UsuarioSesion(BaseModel):
    email: str
    rol: Rol
    negocio: NegocioDelUsuario | None


class Invitacion(BaseModel):
    email: str
    negocio: str | None


# --- Configuración del complejo ---


class Configuracion(BaseModel):
    slug: str
    nombre: str
    direccion: str | None
    barrio: str | None
    referencia: str | None
    whatsapp: str | None
    latitud: float | None
    longitud: float | None
    asistente_activo: bool
    asistente_nombre: str | None
    asistente_bienvenida: str | None
    asistente_conocimiento: str | None
    servicios: list[str]
    logo_url: str | None
    portada_url: str | None
    color_primario: str
    color_secundario: str | None
    sena_tipo: Literal["fija", "porcentaje"]
    sena_valor: Decimal
    horas_cancelacion: int
    minutos_para_pagar: int


class CambiosDeConfiguracion(BaseModel):
    nombre: Texto | None = None
    direccion: TextoOpcional | None = None
    barrio: TextoOpcional | None = None
    referencia: TextoOpcional | None = None
    # Con código de país y de área, solo números (5491155551234). Vacío: sin botón.
    whatsapp: Annotated[str, StringConstraints(pattern=r"^(\d{10,15})?$")] | None = None
    # El pin del mapa. Argentina está entre -56 y -21 de latitud y -74 y -53 de longitud.
    latitud: Annotated[float, Field(ge=-56, le=-21)] | None = None
    longitud: Annotated[float, Field(ge=-74, le=-53)] | None = None
    asistente_activo: bool | None = None
    asistente_nombre: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None
    ) = None
    asistente_bienvenida: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None
    ) = None
    asistente_conocimiento: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=6000)] | None
    ) = None
    servicios: list[Texto] | None = None
    color_primario: Color | None = None
    color_secundario: Color | None = None
    sena_tipo: Literal["fija", "porcentaje"] | None = None
    sena_valor: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)] | None = None
    horas_cancelacion: Annotated[int, Field(ge=0, le=24 * 30)] | None = None
    minutos_para_pagar: Annotated[int, Field(ge=1, le=120)] | None = None


class PanelResumen(BaseModel):
    slug: str
    nombre: str
    color_primario: str
    color_secundario: str | None
    logo_url: str | None
    rol: Rol
    # Si tiene el Plan Pro (métricas del mes). Lo habilita HayCanchas desde el superadmin.
    plan_pro: bool = False


# --- Canchas y horarios ---


class Cancha(BaseModel):
    id: uuid.UUID
    nombre: str
    deporte: str
    deporte_nombre: str
    caracteristicas: str | None
    activo: bool
    orden: int


class NuevaCancha(BaseModel):
    nombre: Texto
    deporte: str
    caracteristicas: TextoOpcional | None = None


class CambiosDeCancha(BaseModel):
    nombre: Texto | None = None
    caracteristicas: TextoOpcional | None = None
    activo: bool | None = None
    orden: int | None = None


class Franja(BaseModel):
    dias: Annotated[list[Annotated[int, Field(ge=0, le=6)]], Field(min_length=1)]
    desde: time
    hasta: time
    duracion_turno_min: Annotated[int, Field(gt=0, le=600)]
    precio: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
    precio_efectivo: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)] | None = None


class HorariosDeCanchas(BaseModel):
    canchas: Annotated[list[uuid.UUID], Field(min_length=1)]
    franjas: list[Franja]


class Deporte(BaseModel):
    codigo: str
    nombre: str
    duracion_sugerida_min: int


# --- Equipo ---


class Integrante(BaseModel):
    id: uuid.UUID
    email: str
    rol: Rol
    activo: bool
    clave_definida: bool


class NuevoIntegrante(BaseModel):
    email: EmailStr


class IntegranteConLink(BaseModel):
    integrante: Integrante
    link: str


class LinkDeInvitacion(BaseModel):
    link: str


class CambiosDeIntegrante(BaseModel):
    activo: bool


# --- Superadmin ---


class ComplejoAdmin(BaseModel):
    id: uuid.UUID
    slug: str
    nombre: str
    barrio: str | None
    estado_cuenta: Literal["al_dia", "atrasado", "suspendido"]
    activo: bool
    plan: str | None
    canchas: int
    dueno_email: str | None
    dueno_clave_definida: bool
    creado_a: datetime


class AltaDeComplejo(BaseModel):
    """En el mismo orden que el formulario de alta (docs/formulario-alta.md)."""

    nombre: Texto
    slug: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=60)]
    direccion: TextoOpcional | None = None
    barrio: TextoOpcional | None = None
    referencia: TextoOpcional | None = None
    latitud: Annotated[float, Field(ge=-56, le=-21)] | None = None
    longitud: Annotated[float, Field(ge=-74, le=-53)] | None = None
    servicios: list[Texto] = []
    dueno_email: EmailStr
    sena_tipo: Literal["fija", "porcentaje"] = "porcentaje"
    sena_valor: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)] = Decimal("20")
    # Obligatorio: se acuerda con cada complejo.
    horas_cancelacion: Annotated[int, Field(ge=0, le=24 * 30)]
    minutos_para_pagar: Annotated[int, Field(ge=1, le=120)] = 10
    color_primario: Color = "#1E7A3E"
    color_secundario: Color | None = None
    plan: TextoOpcional | None = None


class ComplejoCreado(BaseModel):
    complejo: ComplejoAdmin
    link_dueno: str


class CambiosDeComplejo(BaseModel):
    estado_cuenta: Literal["al_dia", "atrasado", "suspendido"] | None = None
    activo: bool | None = None
    plan: TextoOpcional | None = None


class FotoDelPanel(BaseModel):
    id: uuid.UUID
    url: str


class NumerosDelMes(BaseModel):
    reservas: int
    facturacion: Decimal
    senas_online: Decimal
    ocupacion: int
    sin_intervencion: int
    a_mano: int
    de_haycancha: int
    facturacion_haycancha: Decimal
    faltas: int


class HorarioPedido(BaseModel):
    hora: str
    reservas: int


class Resultados(BaseModel):
    mes: str
    actual: NumerosDelMes
    anterior: NumerosDelMes
    ocupacion_por_dia: list[int]
    horarios_top: list[HorarioPedido]
