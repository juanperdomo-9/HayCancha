"""Comandos de mantenimiento. Uso: uv run python -m app.cli <comando>

preparar-base   Habilita el login de app_user con la contraseña de DATABASE_URL.
                Correrlo después de las migraciones, en cada base nueva.
cargar-ejemplo  Carga el complejo de ejemplo (El Potrero) y sus usuarios de prueba.
                --reemplazar lo borra y lo vuelve a crear. Solo para desarrollo.
crear-superadmin --usuario ...
                Crea (o cambia la contraseña de) un superadmin de HayCanchas. El usuario
                puede ser un email o un nombre (por ejemplo, haycancha). Pide la
                contraseña sin mostrarla.
"""

import argparse
import getpass
import sys

from psycopg import sql
from sqlalchemy import select
from sqlalchemy.engine import make_url

from app.config import get_settings
from app.db import get_engine_admin, sesion_admin
from app.ejemplo import cargar_ejemplo
from app.models import Usuario
from app.services.auth import hashear_clave


def rol_de_la_app() -> tuple[str, str]:
    """Rol y contraseña de DATABASE_URL. En el pooler de Supabase el usuario viene como
    `app_user.<ref-del-proyecto>`: el rol es lo que está antes del punto."""
    url = make_url(get_settings().database_url)
    if not url.username or not url.password:
        raise SystemExit("DATABASE_URL tiene que incluir usuario y contraseña.")
    return url.username.split(".", 1)[0], url.password


def preparar_base() -> None:
    rol, clave = rol_de_la_app()
    if rol != "app_user":
        raise SystemExit(f"DATABASE_URL usa el rol {rol!r}; la app tiene que usar app_user.")
    with get_engine_admin().connect() as conexion:
        crudo = conexion.connection.driver_connection
        crudo.execute(
            sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {}").format(
                sql.Identifier(rol), sql.Literal(clave)
            )
        )
        crudo.commit()
    print("app_user listo para conectarse.")


def crear_superadmin(usuario: str) -> None:
    email = usuario.strip().lower()
    clave = getpass.getpass("Contraseña (mínimo 8 caracteres): ")
    if getpass.getpass("Repetila: ") != clave:
        raise SystemExit("Las contraseñas no coinciden.")
    try:
        hash_ = hashear_clave(clave)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    with sesion_admin() as session, session.begin():
        usuario = session.scalar(select(Usuario).where(Usuario.email == email))
        if usuario is None:
            session.add(Usuario(email=email, rol="superadmin", password_hash=hash_))
        elif usuario.rol != "superadmin":
            raise SystemExit("Ese usuario ya es de un dueño o empleado de un complejo.")
        else:
            usuario.password_hash = hash_
            usuario.activo = True
    print(f"Superadmin listo: {email}. Entrá en {get_settings().frontend_url}/ingresar")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    comandos = parser.add_subparsers(dest="comando", required=True)
    comandos.add_parser("preparar-base", help="habilita el login de app_user")
    ejemplo = comandos.add_parser("cargar-ejemplo", help="carga El Potrero")
    ejemplo.add_argument("--reemplazar", action="store_true")
    superadmin = comandos.add_parser("crear-superadmin", help="crea un superadmin")
    superadmin.add_argument("--usuario", "--email", dest="usuario", required=True)
    comandos.add_parser("generar-clave", help="clave nueva para TOKEN_ENCRYPTION_KEY")
    args = parser.parse_args(argv)

    if args.comando == "preparar-base":
        preparar_base()
    elif args.comando == "cargar-ejemplo":
        with sesion_admin() as session, session.begin():
            negocio = cargar_ejemplo(session, reemplazar=args.reemplazar)
        print(f"Complejo de ejemplo: {negocio.nombre} ({negocio.slug}).")
        print("Usuarios de prueba: ver USUARIOS_DE_EJEMPLO en app/ejemplo.py.")
    elif args.comando == "crear-superadmin":
        crear_superadmin(args.usuario)
    elif args.comando == "generar-clave":
        from app.services.cifrado import nueva_clave

        # Una sola vez por entorno: si cambia, hay que volver a vincular Mercado Pago.
        print(nueva_clave())


if __name__ == "__main__":
    main(sys.argv[1:])
