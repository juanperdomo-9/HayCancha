"""Logos y portadas en Supabase Storage (simulado)."""

import httpx

from app.config import get_settings
from app.services import archivos
from tests.test_cobro_mercadopago import api_mp, complejo  # noqa: F401 (fixtures)
from tests.test_panel_y_admin import crear_usuario  # noqa: F401 (fixture)

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


def test_con_supabase_sube_al_bucket(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_url", "https://ref.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_prueba")
    pedidos = []

    def api(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        return httpx.Response(200, json={"Key": "archivos/x"})

    monkeypatch.setattr(archivos, "_http", lambda: httpx.Client(transport=httpx.MockTransport(api)))
    url = archivos.guardar_imagen("11111111-1111-1111-1111-111111111111", "logo", PNG)
    assert url.startswith(
        "https://ref.supabase.co/storage/v1/object/public/archivos/11111111-1111-1111-1111-111111111111/logo-"
    )
    pedido = pedidos[0]
    assert pedido.url.path.startswith("/storage/v1/object/archivos/")
    assert pedido.headers["apikey"] == "sb_secret_prueba"
    assert "authorization" not in pedido.headers
    assert pedido.headers["content-type"] == "image/png"
    assert pedido.content == PNG


def test_si_supabase_falla_avisa(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_url", "https://ref.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_prueba")
    monkeypatch.setattr(
        archivos,
        "_http",
        lambda: httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(500))),
    )
    try:
        archivos.guardar_imagen("11111111-1111-1111-1111-111111111111", "logo", PNG)
    except archivos.ArchivoInvalido as error:
        assert "No pudimos guardar" in str(error)
    else:
        raise AssertionError("tenía que fallar")


def test_quitar_el_logo(complejo) -> None:  # noqa: F811
    from tests.test_panel_y_admin import entrar

    cliente = entrar(complejo["dueno"])
    marca = f"/panel/{complejo['slug']}/marca/logo"
    subido = cliente.post(marca, files={"archivo": ("logo.png", PNG, "image/png")})
    assert subido.status_code == 200, subido.text
    assert subido.json()["logo_url"]
    quitado = cliente.delete(marca)
    assert quitado.status_code == 200 and quitado.json()["logo_url"] is None
