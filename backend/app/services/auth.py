"""Contraseñas, sesiones y links de invitación.

- Contraseñas con argon2.
- Sesión: JWT firmado en una cookie httpOnly (el JavaScript de la página no la puede leer).
- Invitación: JWT firmado que sirve una sola vez. Lleva una "huella" de la contraseña
  actual: cuando el usuario elige una, la huella cambia y el link deja de valer.
"""

import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings

COOKIE_SESION = "hc_sesion"
DURACION_SESION = timedelta(days=14)
DURACION_INVITACION = timedelta(days=7)
LARGO_MINIMO_CLAVE = 8

_hasher = PasswordHasher()
# Para que "no existe ese email" tarde lo mismo que "contraseña incorrecta".
_HASH_DE_RELLENO = _hasher.hash("relleno-para-igualar-tiempos")


class TokenInvalido(Exception):
    pass


@dataclass(frozen=True)
class Usuario:
    id: uuid.UUID
    negocio_id: uuid.UUID | None
    email: str
    password_hash: str | None
    rol: str
    activo: bool

    @property
    def es_superadmin(self) -> bool:
        return self.rol == "superadmin"


def hashear_clave(clave: str) -> str:
    if len(clave) < LARGO_MINIMO_CLAVE:
        raise ValueError(f"La contraseña tiene que tener al menos {LARGO_MINIMO_CLAVE} caracteres.")
    return _hasher.hash(clave)


def clave_correcta(hash_guardado: str | None, clave: str) -> bool:
    try:
        return (
            _hasher.verify(hash_guardado or _HASH_DE_RELLENO, clave) and hash_guardado is not None
        )
    except (VerificationError, InvalidHashError):
        return False


def _usuario(session: Session, funcion: str, valor: object) -> Usuario | None:
    fila = session.execute(text(f"SELECT * FROM {funcion}(:v)"), {"v": valor}).mappings().first()
    return Usuario(**fila) if fila else None


def usuario_por_email(session: Session, email: str) -> Usuario | None:
    return _usuario(session, "auth_usuario_por_email", email.strip().lower())


def usuario_por_id(session: Session, usuario_id: uuid.UUID) -> Usuario | None:
    return _usuario(session, "auth_usuario_por_id", usuario_id)


def autenticar(session: Session, email: str, clave: str) -> Usuario | None:
    usuario = usuario_por_email(session, email)
    if not clave_correcta(usuario.password_hash if usuario else None, clave):
        return None
    if usuario is None or not usuario.activo:
        return None
    return usuario


def _firmar(datos: dict, duracion: timedelta) -> str:
    ahora = datetime.now(UTC)
    return jwt.encode(
        {**datos, "iat": ahora, "exp": ahora + duracion}, get_settings().jwt_secret, "HS256"
    )


def _leer(token: str, tipo: str) -> dict:
    try:
        datos = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise TokenInvalido from error
    if datos.get("tipo") != tipo:
        raise TokenInvalido
    return datos


def token_de_sesion(usuario: Usuario) -> str:
    return _firmar({"tipo": "sesion", "sub": str(usuario.id)}, DURACION_SESION)


def leer_token_de_sesion(token: str) -> uuid.UUID:
    return uuid.UUID(_leer(token, "sesion")["sub"])


def _huella(password_hash: str | None) -> str:
    return hashlib.sha256((password_hash or "sin-clave").encode()).hexdigest()[:16]


def token_de_invitacion(usuario: Usuario) -> str:
    return _firmar(
        {"tipo": "invitacion", "sub": str(usuario.id), "huella": _huella(usuario.password_hash)},
        DURACION_INVITACION,
    )


def link_de_invitacion(usuario: Usuario) -> str:
    return (
        f"{get_settings().frontend_url}/ingresar/definir-clave?token={token_de_invitacion(usuario)}"
    )


def usuario_de_invitacion(session: Session, token: str) -> Usuario:
    """El usuario al que corresponde el link, si el link sigue valiendo."""
    datos = _leer(token, "invitacion")
    usuario = usuario_por_id(session, uuid.UUID(datos["sub"]))
    if (
        usuario is None
        or not usuario.activo
        or datos.get("huella") != _huella(usuario.password_hash)
    ):
        raise TokenInvalido
    return usuario


def firmar_token(tipo: str, datos: dict, duracion: timedelta) -> str:
    """Token firmado de corta duración para un flujo puntual (por ejemplo, OAuth)."""
    return _firmar({**datos, "tipo": tipo}, duracion)


def leer_token(token: str, tipo: str) -> dict:
    return _leer(token, tipo)
