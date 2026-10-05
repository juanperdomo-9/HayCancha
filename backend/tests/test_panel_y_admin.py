"""Login, permisos por rol, invitaciones, configuración del complejo y alta de complejos."""

import uuid
from collections.abc import Callable
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.models import Negocio, Usuario
from app.services.auth import hashear_clave

CLAVE = "clave-de-prueba-1"


@pytest.fixture
def crear_usuario(admin: Session) -> Callable[..., str]:
    def crear(rol: str, negocio_id: uuid.UUID | None = None, clave: str | None = CLAVE) -> str:
        email = f"{rol}-{uuid.uuid4().hex[:8]}@prueba.example"
        admin.add(
            Usuario(
                email=email,
                rol=rol,
                negocio_id=negocio_id,
                password_hash=hashear_clave(clave) if clave else None,
            )
        )
        admin.commit()
        return email

    return crear


@pytest.fixture
def escenario(crear_negocio, crear_recurso, crear_usuario, admin: Session) -> dict:
    a, b = crear_negocio(), crear_negocio()
    return {
        "a": admin.get(Negocio, a).slug,
        "b": admin.get(Negocio, b).slug,
        "recurso_a": crear_recurso(a, "futbol7", "Cancha 1"),
        "dueno_a": crear_usuario("dueno", a),
        "empleado_a": crear_usuario("empleado", a),
        "dueno_b": crear_usuario("dueno", b),
        "superadmin": crear_usuario("superadmin"),
    }


def entrar(email: str, clave: str = CLAVE) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post("/auth/ingresar", json={"email": email, "clave": clave})
    assert respuesta.status_code == 200, respuesta.text
    return cliente


# --- Sesión ---


def test_ingresar_y_saber_quien_soy(escenario) -> None:
    cliente = entrar(escenario["dueno_a"].upper())  # el email no distingue mayúsculas
    cookie = cliente.cookies.get("hc_sesion")
    assert cookie
    yo = cliente.get("/auth/yo").json()
    assert (yo["rol"], yo["negocio"]["slug"]) == ("dueno", escenario["a"])


def test_un_superadmin_puede_entrar_con_nombre_de_usuario(admin: Session) -> None:
    usuario = f"equipo-{uuid.uuid4().hex[:6]}"
    admin.add(Usuario(email=usuario, rol="superadmin", password_hash=hashear_clave(CLAVE)))
    admin.commit()
    assert entrar(usuario.upper()).get("/auth/yo").json()["rol"] == "superadmin"


def test_la_cookie_es_httponly(escenario) -> None:
    respuesta = TestClient(app).post(
        "/auth/ingresar", json={"email": escenario["dueno_a"], "clave": CLAVE}
    )
    assert "httponly" in respuesta.headers["set-cookie"].lower()


@pytest.mark.parametrize(
    ("email", "clave"), [("dueno_a", "otra-clave"), ("no-existe@prueba.example", CLAVE)]
)
def test_datos_incorrectos(escenario, email: str, clave: str) -> None:
    respuesta = TestClient(app).post(
        "/auth/ingresar", json={"email": escenario.get(email, email), "clave": clave}
    )
    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == "El email o la contraseña no coinciden."


def test_un_usuario_desactivado_no_entra(escenario, admin: Session) -> None:
    usuario = admin.scalar(select(Usuario).where(Usuario.email == escenario["empleado_a"]))
    usuario.activo = False
    admin.commit()
    respuesta = TestClient(app).post(
        "/auth/ingresar", json={"email": escenario["empleado_a"], "clave": CLAVE}
    )
    assert respuesta.status_code == 401


def test_sin_sesion_no_hay_panel(escenario) -> None:
    assert TestClient(app).get(f"/panel/{escenario['a']}").status_code == 401


def test_salir_borra_la_sesion(escenario) -> None:
    cliente = entrar(escenario["dueno_a"])
    cliente.post("/auth/salir")
    assert cliente.get("/auth/yo").status_code == 401


# --- Permisos ---


def test_el_dueno_entra_a_su_panel_y_no_al_de_otro(escenario) -> None:
    cliente = entrar(escenario["dueno_a"])
    assert cliente.get(f"/panel/{escenario['a']}/configuracion").status_code == 200
    assert cliente.get(f"/panel/{escenario['b']}").status_code == 403
    assert cliente.get(f"/panel/{escenario['b']}/configuracion").status_code == 403


def test_el_empleado_ve_el_panel_pero_no_la_configuracion(escenario) -> None:
    cliente = entrar(escenario["empleado_a"])
    assert cliente.get(f"/panel/{escenario['a']}").json()["rol"] == "empleado"
    for ruta in ("configuracion", "canchas", "equipo"):
        assert cliente.get(f"/panel/{escenario['a']}/{ruta}").status_code == 403


def test_el_superadmin_entra_a_cualquier_complejo(escenario) -> None:
    cliente = entrar(escenario["superadmin"])
    assert cliente.get(f"/panel/{escenario['a']}/configuracion").status_code == 200
    assert cliente.get(f"/panel/{escenario['b']}/configuracion").status_code == 200


def test_solo_el_superadmin_entra_a_admin(escenario) -> None:
    assert entrar(escenario["dueno_a"]).get("/admin/complejos").status_code == 403
    assert entrar(escenario["superadmin"]).get("/admin/complejos").status_code == 200


# --- Configuración ---


def test_cambiar_colores_y_sena(escenario) -> None:
    cliente = entrar(escenario["dueno_a"])
    respuesta = cliente.patch(
        f"/panel/{escenario['a']}/configuracion",
        json={"color_primario": "#2447D8", "sena_tipo": "fija", "sena_valor": "15000"},
    )
    assert respuesta.status_code == 200
    assert (respuesta.json()["color_primario"], respuesta.json()["sena_valor"]) == (
        "#2447D8",
        "15000.00",
    )


def test_la_referencia_se_ve_en_la_pagina(escenario) -> None:
    entrar(escenario["dueno_a"]).patch(
        f"/panel/{escenario['a']}/configuracion",
        json={
            "direccion": "Calle 32 entre 7 y 8",
            "barrio": "La Plata",
            "referencia": "Al lado de la YPF",
        },
    )
    publico = TestClient(app).get(f"/publico/complejos/{escenario['a']}").json()
    assert (publico["direccion"], publico["referencia"]) == (
        "Calle 32 entre 7 y 8",
        "Al lado de la YPF",
    )


@pytest.mark.parametrize(
    "cambios",
    [
        {"color_primario": "verde"},
        {"sena_tipo": "porcentaje", "sena_valor": "150"},
        {"horas_cancelacion": -1},
    ],
)
def test_configuracion_invalida(escenario, cambios: dict) -> None:
    respuesta = entrar(escenario["dueno_a"]).patch(
        f"/panel/{escenario['a']}/configuracion", json=cambios
    )
    assert respuesta.status_code == 422


def test_crear_y_renombrar_canchas(escenario) -> None:
    cliente = entrar(escenario["dueno_a"])
    base = f"/panel/{escenario['a']}/canchas"
    nueva = cliente.post(base, json={"nombre": "Pádel 1", "deporte": "padel"})
    assert nueva.status_code == 201
    assert nueva.json()["deporte_nombre"] == "Pádel"
    repetida = cliente.post(base, json={"nombre": "Pádel 1", "deporte": "padel"})
    assert repetida.status_code == 409
    cambio = cliente.patch(f"{base}/{nueva.json()['id']}", json={"caracteristicas": "Blindex"})
    assert cambio.json()["caracteristicas"] == "Blindex"


def test_horarios_para_varias_canchas_y_se_ven_en_la_pagina(escenario, crear_recurso) -> None:
    cliente = entrar(escenario["dueno_a"])
    franjas = [
        {"dias": [0, 1, 2, 3, 4, 5, 6], "desde": "18:00", "hasta": "00:00",
         "duracion_turno_min": 60, "precio": "85000"},
    ]  # fmt: skip
    respuesta = cliente.put(
        f"/panel/{escenario['a']}/horarios",
        json={"canchas": [str(escenario["recurso_a"])], "franjas": franjas},
    )
    assert respuesta.status_code == 200
    guardadas = cliente.get(f"/panel/{escenario['a']}/canchas/{escenario['recurso_a']}/horarios")
    assert guardadas.json()[0]["dias"] == [0, 1, 2, 3, 4, 5, 6]

    publico = TestClient(app).get(f"/publico/complejos/{escenario['a']}").json()
    assert publico["deportes"][0]["precio_desde"] == "85000.00"


def franja(dia: int, desde: str, hasta: str) -> dict:
    return {"dias": [dia], "desde": desde, "hasta": hasta, "duracion_turno_min": 60, "precio": "1"}


@pytest.mark.parametrize(
    ("franjas", "mensaje"),
    [
        # El mismo sábado: 18 a 00 y 22 a 02.
        ([franja(5, "18:00", "00:00"), franja(5, "22:00", "02:00")], "se pisan"),
        # El viernes termina a las 2 y el sábado arranca a la 1.
        ([franja(4, "20:00", "02:00"), franja(5, "01:00", "04:00")], "se pisan"),
        ([franja(1, "18:00", "18:30")], "no entra un turno"),
    ],
)
def test_horarios_que_no_valen(escenario, franjas: list, mensaje: str) -> None:
    respuesta = entrar(escenario["dueno_a"]).put(
        f"/panel/{escenario['a']}/horarios",
        json={"canchas": [str(escenario["recurso_a"])], "franjas": franjas},
    )
    assert respuesta.status_code == 422
    assert mensaje in respuesta.json()["detail"]


def test_no_puede_cargar_horarios_en_canchas_de_otro(escenario, crear_recurso, admin) -> None:
    otro = admin.scalar(select(Negocio.id).where(Negocio.slug == escenario["b"]))
    ajena = crear_recurso(otro)
    respuesta = entrar(escenario["dueno_a"]).put(
        f"/panel/{escenario['a']}/horarios", json={"canchas": [str(ajena)], "franjas": []}
    )
    assert respuesta.status_code == 404


def test_subir_logo(escenario) -> None:
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    cliente = entrar(escenario["dueno_a"])
    ok = cliente.post(
        f"/panel/{escenario['a']}/marca/logo", files={"archivo": ("logo.png", png, "image/png")}
    )
    assert ok.status_code == 200
    assert ok.json()["logo_url"].endswith(".png")
    svg = cliente.post(
        f"/panel/{escenario['a']}/marca/logo",
        files={"archivo": ("logo.svg", b"<svg onload=alert(1)>", "image/svg+xml")},
    )
    assert svg.status_code == 422


# --- Equipo e invitaciones ---


def token_de(link: str) -> str:
    return parse_qs(urlparse(link).query)["token"][0]


def test_invitar_un_empleado_que_elige_su_clave(escenario) -> None:
    dueno = entrar(escenario["dueno_a"])
    email = f"nuevo-{uuid.uuid4().hex[:6]}@prueba.example"
    invitado = dueno.post(f"/panel/{escenario['a']}/equipo", json={"email": email})
    assert invitado.status_code == 201
    token = token_de(invitado.json()["link"])

    nuevo = TestClient(app)
    assert nuevo.get("/auth/invitacion", params={"token": token}).json()["email"] == email
    elegida = nuevo.post("/auth/definir-clave", json={"token": token, "clave": "mi-clave-nueva"})
    assert elegida.status_code == 200
    assert nuevo.get("/auth/yo").json()["rol"] == "empleado"

    # El link sirve una sola vez.
    otra_vez = TestClient(app).post(
        "/auth/definir-clave", json={"token": token, "clave": "otra-clave-nueva"}
    )
    assert otra_vez.status_code == 400
    entrar(email, "mi-clave-nueva")


def test_un_link_adulterado_no_sirve(escenario) -> None:
    dueno = entrar(escenario["dueno_a"])
    link = dueno.post(
        f"/panel/{escenario['a']}/equipo",
        json={"email": f"x-{uuid.uuid4().hex[:6]}@prueba.example"},
    ).json()["link"]
    token = token_de(link)
    adulterado = token[:-3] + ("aaa" if not token.endswith("aaa") else "bbb")
    assert TestClient(app).get("/auth/invitacion", params={"token": adulterado}).status_code == 400


def test_no_se_repite_un_email(escenario) -> None:
    respuesta = entrar(escenario["dueno_a"]).post(
        f"/panel/{escenario['a']}/equipo", json={"email": escenario["dueno_b"]}
    )
    assert respuesta.status_code == 409


# --- Alta de complejos ---


def alta(**cambios) -> dict:
    datos = {
        "nombre": "Pádel Norte",
        "slug": f"padel-norte-{uuid.uuid4().hex[:6]}",
        "dueno_email": f"dueno-{uuid.uuid4().hex[:6]}@prueba.example",
        "horas_cancelacion": 12,
        "barrio": "Vicente López",
    }
    return datos | cambios


def test_alta_de_un_complejo_con_su_dueno(escenario) -> None:
    admin_http = entrar(escenario["superadmin"])
    respuesta = admin_http.post("/admin/complejos", json=alta())
    assert respuesta.status_code == 201
    creado = respuesta.json()
    assert creado["complejo"]["dueno_clave_definida"] is False
    assert creado["complejo"]["canchas"] == 0

    dueno = TestClient(app)
    dueno.post(
        "/auth/definir-clave",
        json={"token": token_de(creado["link_dueno"]), "clave": "clave-dueno-1"},
    )
    slug = creado["complejo"]["slug"]
    configuracion = dueno.get(f"/panel/{slug}/configuracion").json()
    assert (configuracion["sena_tipo"], configuracion["sena_valor"]) == ("porcentaje", "20.00")
    assert configuracion["horas_cancelacion"] == 12


@pytest.mark.parametrize(
    ("cambios", "codigo"),
    [
        ({"slug": "panel"}, 422),
        ({"slug": "Con Espacios"}, 422),
        ({"horas_cancelacion": None}, 422),
    ],
)
def test_alta_invalida(escenario, cambios: dict, codigo: int) -> None:
    datos = alta(**cambios)
    datos = {k: v for k, v in datos.items() if v is not None}
    respuesta = entrar(escenario["superadmin"]).post("/admin/complejos", json=datos)
    assert respuesta.status_code == codigo


def test_alta_con_slug_o_email_repetido(escenario) -> None:
    cliente = entrar(escenario["superadmin"])
    assert cliente.post("/admin/complejos", json=alta(slug=escenario["a"])).status_code == 409
    assert (
        cliente.post("/admin/complejos", json=alta(dueno_email=escenario["dueno_b"])).status_code
        == 409
    )


def test_suspender_saca_al_complejo_de_la_pagina(escenario, admin: Session) -> None:
    negocio_id = admin.scalar(select(Negocio.id).where(Negocio.slug == escenario["a"]))
    cliente = entrar(escenario["superadmin"])
    cambio = cliente.patch(f"/admin/complejos/{negocio_id}", json={"estado_cuenta": "suspendido"})
    assert cambio.json()["estado_cuenta"] == "suspendido"
    assert TestClient(app).get(f"/publico/complejos/{escenario['a']}").status_code == 404


def test_galeria_de_fotos(escenario) -> None:
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    dueno = entrar(escenario["dueno_a"])
    fotos = f"/panel/{escenario['a']}/fotos"
    for nombre in ("a.png", "b.png"):
        respuesta = dueno.post(fotos, files={"archivo": (nombre, png, "image/png")})
        assert respuesta.status_code == 200
    primera, segunda = respuesta.json()
    dadas_vuelta = dueno.put(f"{fotos}/orden", json=[segunda["id"], primera["id"]]).json()
    assert [f["id"] for f in dadas_vuelta] == [segunda["id"], primera["id"]]
    publico = dueno.get(f"/publico/complejos/{escenario['a']}").json()
    assert publico["fotos"] == [segunda["url"], primera["url"]]
    # Ni el empleado ni el dueño de otro complejo la tocan.
    assert entrar(escenario["empleado_a"]).delete(f"{fotos}/{primera['id']}").status_code == 403
    ajeno = entrar(escenario["dueno_b"]).delete(f"/panel/{escenario['b']}/fotos/{primera['id']}")
    assert ajeno.status_code == 404
    assert [f["id"] for f in dueno.delete(f"{fotos}/{primera['id']}").json()] == [segunda["id"]]
