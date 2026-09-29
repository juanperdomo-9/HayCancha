from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.ejemplo import cargar_ejemplo
from app.models import Deporte, Horario, Recurso


def test_deportes_iniciales(admin: Session) -> None:
    codigos = set(admin.scalars(select(Deporte.codigo)))
    assert codigos == {"futbol5", "futbol7", "futbol11", "padel", "tenis", "basquet", "voley"}


def test_el_potrero_tiene_sus_canchas_y_horarios(admin: Session) -> None:
    negocio = cargar_ejemplo(admin, reemplazar=True)
    admin.commit()

    with sesion_de_negocio(negocio.id) as s:
        por_deporte = Counter(
            s.scalars(select(Deporte.codigo).join(Recurso, Recurso.deporte_id == Deporte.id))
        )
        franjas = s.scalars(select(Horario)).all()

    assert por_deporte == {"futbol7": 4, "futbol5": 1, "padel": 1}
    # 6 canchas x 7 días x 2 franjas
    assert len(franjas) == 84
    assert {f.duracion_turno_min for f in franjas} == {60, 90}


def test_cargar_el_ejemplo_dos_veces_no_lo_duplica(admin: Session) -> None:
    primero = cargar_ejemplo(admin)
    admin.commit()
    segundo = cargar_ejemplo(admin)
    assert primero.id == segundo.id
