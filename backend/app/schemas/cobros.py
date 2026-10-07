"""La pestaña Cobros del panel. Nunca incluye tokens de Mercado Pago."""

from datetime import datetime

from pydantic import BaseModel


class EstadoCobros(BaseModel):
    # HayCanchas tiene cargada su app de Mercado Pago (si no, no se puede vincular todavía).
    disponible: bool
    vinculado: bool
    cuenta_mp: str | None
    vence_a: datetime | None


class LinkDeVinculacion(BaseModel):
    url: str
