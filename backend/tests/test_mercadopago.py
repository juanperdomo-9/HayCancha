"""Vincular Mercado Pago por complejo (OAuth con PKCE), tokens encriptados y renovación."""

import base64
import hashlib
import json
import uuid
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.config import get_settings
from app.jobs.tick import main as tick
from app.models import Negocio
from app.services import mercadopago
from app.services.cifrado import cifrar, descifrar
from app.services.disponibilidad import ahora
from tests.test_panel_y_admin import crear_usuario, entrar  # noqa: F401 (fixture)


@pytest.fixture
def mp_configurado(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "mp_client_id", "123456")
    monkeypatch.setattr(settings, "mp_client_secret", "secreto-de-la-app")
    monkeypatch.setattr(settings, "token_encryption_key", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "mp_redirect_uri", "https://api.example/mercadopago/callback")


class MercadoPagoFalso:
    """Reemplaza la API de Mercado Pago: guarda los pedidos y responde lo que se le diga."""

    def __init__(self, monkeypatch) -> None:
        self.pedidos: list[dict] = []
        self.estado = 200
        self.respuesta = {
            "access_token": "APP_USR-token-nuevo",
            "refresh_token": "TG-refresh-nuevo",
            "user_id": 987654,
            "expires_in": 15552000,  # 180 días
            "token_type": "Bearer",
        }
        monkeypatch.setattr(
            mercadopago,
            "_http",
            lambda: httpx.Client(transport=httpx.MockTransport(self._responder)),
        )

    def _responder(self, pedido: httpx.Request) -> httpx.Response:
        self.pedidos.append({"url": str(pedido.url), **json.loads(pedido.content)})
        return httpx.Response(self.estado, json=self.respuesta)


@pytest.fixture
def api_mp(monkeypatch) -> MercadoPagoFalso:
    return MercadoPagoFalso(monkeypatch)


@pytest.fixture
def complejo(crear_negocio, crear_usuario, admin: Session) -> dict:  # noqa: F811
    negocio_id = crear_negocio()
    return {
        "id": negocio_id,
        "slug": admin.get(Negocio, negocio_id).slug,
        "dueno": crear_usuario("dueno", negocio_id),
        "empleado": crear_usuario("empleado", negocio_id),
    }


def negocio_actual(admin: Session, negocio_id: uuid.UUID) -> Negocio:
    admin.expire_all()
    return admin.get(Negocio, negocio_id)


def iniciar_vinculacion(complejo: dict):
    cliente = entrar(complejo["dueno"])
    respuesta = cliente.post(f"/panel/{complejo['slug']}/cobros/vincular")
    assert respuesta.status_code == 200, respuesta.text
    parametros = {k: v[0] for k, v in parse_qs(urlparse(respuesta.json()["url"]).query).items()}
    return cliente, parametros


def volver_de_mp(cliente, **query):
    respuesta = cliente.get("/mercadopago/callback", params=query, follow_redirects=False)
    assert respuesta.status_code == 303
    return respuesta.headers["location"]


# --- Cifrado ---


def test_los_tokens_se_guardan_encriptados(mp_configurado) -> None:
    cifrado = cifrar("APP_USR-secreto")
    assert "APP_USR" not in cifrado
    assert descifrar(cifrado) == "APP_USR-secreto"


# --- Vinculación ---


def test_sin_la_app_de_mercado_pago_no_se_puede_vincular(complejo) -> None:
    cliente = entrar(complejo["dueno"])
    assert cliente.get(f"/panel/{complejo['slug']}/cobros").json()["disponible"] is False
    assert cliente.post(f"/panel/{complejo['slug']}/cobros/vincular").status_code == 409


def test_el_link_de_autorizacion_usa_pkce_y_state(complejo, mp_configurado) -> None:
    cliente, parametros = iniciar_vinculacion(complejo)
    assert parametros["client_id"] == "123456"
    assert parametros["response_type"] == "code"
    assert parametros["redirect_uri"] == "https://api.example/mercadopago/callback"
    assert parametros["code_challenge_method"] == "S256"
    assert len(parametros["state"]) >= 24
    assert cliente.cookies.get("hc_mp_oauth")


def test_vincular_guarda_los_tokens_encriptados(complejo, mp_configurado, api_mp, admin) -> None:
    cliente, parametros = iniciar_vinculacion(complejo)
    destino = volver_de_mp(cliente, code="TG-codigo", state=parametros["state"])
    assert destino.endswith(f"/panel/{complejo['slug']}/cobros?mp=vinculado")

    # El code_verifier que mandamos corresponde al code_challenge del link.
    pedido = api_mp.pedidos[0]
    assert (pedido["grant_type"], pedido["code"]) == ("authorization_code", "TG-codigo")
    digest = hashlib.sha256(pedido["code_verifier"].encode()).digest()
    assert base64.urlsafe_b64encode(digest).rstrip(b"=").decode() == parametros["code_challenge"]

    negocio = negocio_actual(admin, complejo["id"])
    assert negocio.mp_user_id == "987654"
    assert "APP_USR" not in negocio.mp_access_token_enc
    assert mercadopago.access_token_de(negocio) == "APP_USR-token-nuevo"
    assert negocio.mp_token_vence_a - ahora() > timedelta(days=179)

    estado = cliente.get(f"/panel/{complejo['slug']}/cobros").json()
    assert (estado["vinculado"], estado["cuenta_mp"]) == (True, "987654")
    assert "token" not in json.dumps(estado).replace("vence_a", "")


def test_un_state_distinto_no_vincula(complejo, mp_configurado, api_mp, admin) -> None:
    cliente, _ = iniciar_vinculacion(complejo)
    destino = volver_de_mp(cliente, code="TG-codigo", state="state-de-otro")
    assert destino.endswith("?mp=error")
    assert api_mp.pedidos == []
    assert negocio_actual(admin, complejo["id"]).mp_access_token_enc is None


def test_sin_la_cookie_no_vincula(complejo, mp_configurado, api_mp, admin) -> None:
    _, parametros = iniciar_vinculacion(complejo)
    otro_navegador = entrar(complejo["dueno"])
    destino = volver_de_mp(otro_navegador, code="TG-codigo", state=parametros["state"])
    assert destino.endswith("/panel")
    assert negocio_actual(admin, complejo["id"]).mp_access_token_enc is None


def test_si_el_dueno_no_autoriza(complejo, mp_configurado, api_mp) -> None:
    cliente, parametros = iniciar_vinculacion(complejo)
    destino = volver_de_mp(cliente, error="access_denied", state=parametros["state"])
    assert destino.endswith("?mp=cancelado")
    assert api_mp.pedidos == []


def test_si_mercado_pago_rechaza_el_codigo(complejo, mp_configurado, api_mp, admin) -> None:
    api_mp.estado, api_mp.respuesta = 400, {"error": "invalid_grant"}
    cliente, parametros = iniciar_vinculacion(complejo)
    assert volver_de_mp(cliente, code="TG-viejo", state=parametros["state"]).endswith("?mp=error")
    assert negocio_actual(admin, complejo["id"]).mp_access_token_enc is None


def test_un_empleado_no_ve_ni_vincula_los_cobros(complejo, mp_configurado) -> None:
    cliente = entrar(complejo["empleado"])
    assert cliente.get(f"/panel/{complejo['slug']}/cobros").status_code == 403
    assert cliente.post(f"/panel/{complejo['slug']}/cobros/vincular").status_code == 403


def test_otro_dueno_no_vincula_este_complejo(
    complejo,
    mp_configurado,
    crear_negocio,
    crear_usuario,  # noqa: F811
) -> None:
    ajeno = entrar(crear_usuario("dueno", crear_negocio()))
    assert ajeno.post(f"/panel/{complejo['slug']}/cobros/vincular").status_code == 403


def test_desvincular(complejo, mp_configurado, api_mp, admin) -> None:
    cliente, parametros = iniciar_vinculacion(complejo)
    volver_de_mp(cliente, code="TG-codigo", state=parametros["state"])
    estado = cliente.post(f"/panel/{complejo['slug']}/cobros/desvincular").json()
    assert estado["vinculado"] is False
    negocio = negocio_actual(admin, complejo["id"])
    assert (negocio.mp_access_token_enc, negocio.mp_refresh_token_enc) == (None, None)


# --- Renovación ---


def vincular_con_vencimiento(admin: Session, negocio_id: uuid.UUID, dias: int) -> None:
    negocio = admin.get(Negocio, negocio_id)
    mercadopago.guardar_credenciales(
        negocio,
        mercadopago.Credenciales("APP_USR-viejo", "TG-refresh-viejo", "987654",
                                 ahora() + timedelta(days=dias)),
    )  # fmt: skip
    admin.commit()


def test_renueva_los_tokens_que_estan_por_vencer(complejo, mp_configurado, api_mp, admin) -> None:
    vincular_con_vencimiento(admin, complejo["id"], dias=10)
    tick(renovar_tokens=True)
    pedido = next(p for p in api_mp.pedidos if p.get("refresh_token") == "TG-refresh-viejo")
    assert pedido["grant_type"] == "refresh_token"
    negocio = negocio_actual(admin, complejo["id"])
    assert mercadopago.access_token_de(negocio) == "APP_USR-token-nuevo"
    assert descifrar(negocio.mp_refresh_token_enc) == "TG-refresh-nuevo"


def test_no_renueva_los_que_tienen_tiempo(complejo, mp_configurado, api_mp, admin) -> None:
    vincular_con_vencimiento(admin, complejo["id"], dias=120)
    tick(renovar_tokens=True)
    assert not any(p.get("refresh_token") == "TG-refresh-viejo" for p in api_mp.pedidos)


def test_si_el_permiso_fue_revocado_se_desvincula(complejo, mp_configurado, api_mp, admin) -> None:
    vincular_con_vencimiento(admin, complejo["id"], dias=5)
    api_mp.estado, api_mp.respuesta = 400, {"error": "invalid_grant"}
    tick(renovar_tokens=True)
    assert negocio_actual(admin, complejo["id"]).mp_access_token_enc is None


def test_un_error_pasajero_no_desvincula(complejo, mp_configurado, api_mp, admin) -> None:
    vincular_con_vencimiento(admin, complejo["id"], dias=5)
    api_mp.estado, api_mp.respuesta = 503, {"error": "unavailable"}
    tick(renovar_tokens=True)
    negocio = negocio_actual(admin, complejo["id"])
    assert mercadopago.access_token_de(negocio) == "APP_USR-viejo"


def test_sin_dominio_la_cookie_va_a_la_ruta_de_la_pagina(monkeypatch) -> None:
    """Etapa 1: Mercado Pago vuelve por la página (/api/...); la cookie tiene que ir ahí."""
    from app.routers import cobros

    settings = get_settings()
    monkeypatch.setattr(settings, "mp_redirect_uri", "https://web.example/api/mercadopago/callback")
    assert cobros._ruta_de_la_cookie() == "/api/mercadopago/callback"
    monkeypatch.setattr(settings, "mp_redirect_uri", "")
    assert cobros._ruta_de_la_cookie() == "/mercadopago/callback"
