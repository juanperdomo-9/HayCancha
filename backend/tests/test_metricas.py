"""Resultados del mes (Plan Pro): qué cuenta, qué no y quién los ve."""

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.models import Negocio, Pago, Reserva
from app.services.reservas import DatosCliente, reservar
from tests.test_agenda import complejo, entrar  # noqa: F401


def test_resultados_del_mes(complejo, admin: Session) -> None:  # noqa: F811
    negocio: Negocio = complejo["negocio"]
    ruta = f"/panel/{complejo['slug']}/resultados"
    mes = complejo["fecha"].strftime("%Y-%m")
    dueno = entrar(complejo["dueno"])
    # Sin el Plan Pro no se ven.
    assert dueno.get(ruta, params={"mes": mes}).status_code == 403
    admin.get(Negocio, negocio.id).plan = "pro"
    admin.commit()

    with sesion_de_negocio(negocio.id) as s:
        web = reservar(s, negocio, deporte_codigo="futbol7", inicio=complejo["a_las"](21),
                       cliente=DatosCliente("Ana", "1155550001", None), origen="web")  # fmt: skip
        web.llegada, web.asistencia = "haycancha", "no_vino"
        reservar(s, negocio, deporte_codigo="futbol7", inicio=complejo["a_las"](22),
                 cliente=DatosCliente("Beto", "1155550002", None), origen="panel")  # fmt: skip
        # No cuentan: una pendiente de pago y un bloqueo.
        reservar(s, negocio, deporte_codigo="futbol7", inicio=complejo["a_las"](19),
                 cliente=DatosCliente("Caro", "1155550003", None), origen="web",
                 estado="pendiente_pago")  # fmt: skip
        s.add(Reserva(negocio_id=negocio.id, recurso_id=complejo["canchas"][1], estado="bloqueada",
                      inicio=complejo["a_las"](20), fin=complejo["a_las"](21), origen="panel",
                      motivo_bloqueo="Lluvia"))  # fmt: skip
        s.flush()
        s.add(Pago(negocio_id=negocio.id, reserva_id=web.id, mp_payment_id=uuid.uuid4().hex,
                   monto=Decimal("16000"), estado="approved"))  # fmt: skip
        s.commit()

    r = dueno.get(ruta, params={"mes": mes})
    assert r.status_code == 200, r.text
    n = r.json()["actual"]
    assert (n["reservas"], n["sin_intervencion"], n["a_mano"], n["de_haycancha"], n["faltas"]) == (
        2, 1, 1, 1, 1,
    )  # fmt: skip
    assert Decimal(n["facturacion"]) == Decimal("160000")
    assert Decimal(n["facturacion_haycancha"]) == Decimal("80000")
    assert Decimal(n["senas_online"]) == Decimal("16000")
    assert n["ocupacion"] >= 1
    assert r.json()["ocupacion_por_dia"][complejo["fecha"].weekday()] > 0
    assert {h["hora"] for h in r.json()["horarios_top"]} == {"21:00", "22:00"}
    # El empleado no ve plata.
    assert entrar(complejo["empleado"]).get(ruta).status_code == 403
    assert dueno.get(ruta, params={"mes": "2026-13"}).status_code == 422
