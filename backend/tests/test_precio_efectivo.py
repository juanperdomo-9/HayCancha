"""Precio en efectivo: la seña sale siempre del precio normal; cambia lo que falta pagar."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.db import sesion_de_negocio
from app.models import Negocio
from app.services.reservas import DatosCliente, reservar
from tests.test_agenda import complejo, entrar  # noqa: F401


def franja(**cambios) -> dict:
    return {"dias": list(range(7)), "desde": "18:00", "hasta": "00:00",
            "duracion_turno_min": 60, "precio": "80000", **cambios}  # fmt: skip


def test_precio_en_efectivo(complejo, admin: Session) -> None:  # noqa: F811
    slug, canchas = complejo["slug"], [str(c) for c in complejo["canchas"]]
    dueno = entrar(complejo["dueno"])
    horarios = {"canchas": canchas, "franjas": [franja(precio_efectivo="70000")]}
    assert dueno.put(f"/panel/{slug}/horarios", json=horarios).status_code == 200
    guardada = dueno.get(f"/panel/{slug}/canchas/{canchas[0]}/horarios").json()[0]
    assert Decimal(guardada["precio_efectivo"]) == Decimal("70000")
    # Más caro que el normal: no.
    caro = {"canchas": canchas, "franjas": [franja(precio_efectivo="90000")]}
    assert dueno.put(f"/panel/{slug}/horarios", json=caro).status_code == 422

    disponible = dueno.get(
        f"/publico/complejos/{slug}/disponibilidad",
        params={"deporte": "futbol7", "fecha": complejo["fecha"].isoformat()},
    ).json()
    libre = disponible["turnos"][0]["libres"][0]
    assert Decimal(libre["precio_efectivo"]) == Decimal("70000")
    assert Decimal(libre["sena"]) == Decimal("16000")  # 20% de 80.000, no de 70.000

    negocio: Negocio = complejo["negocio"]
    with sesion_de_negocio(negocio.id) as s:
        ana = DatosCliente("Ana", "1155550009", None)
        reserva = reservar(
            s,
            negocio,
            deporte_codigo="futbol7",
            inicio=complejo["a_las"](21),
            cliente=ana,
            origen="web",
        )
        s.commit()
        reserva_id = reserva.id
    ruta = f"/panel/{slug}/reservas/{reserva_id}"
    detalle = dueno.get(ruta).json()
    assert (Decimal(detalle["saldo"]), Decimal(detalle["saldo_efectivo"])) == (
        Decimal("64000"), Decimal("54000"),
    )  # fmt: skip
    cobrada = dueno.patch(ruta, json={"saldo_cobrado": True, "saldo_en_efectivo": True}).json()
    assert cobrada["saldo_en_efectivo"] is True

    admin.get(Negocio, negocio.id).plan = "pro"
    admin.commit()
    mes = complejo["fecha"].strftime("%Y-%m")
    numeros = dueno.get(f"/panel/{slug}/resultados", params={"mes": mes}).json()["actual"]
    assert Decimal(numeros["facturacion"]) == Decimal("70000")
