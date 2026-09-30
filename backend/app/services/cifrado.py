"""Encriptación de los tokens de Mercado Pago (Fernet, con TOKEN_ENCRYPTION_KEY).

En la base solo queda el texto encriptado: aunque alguien lea la tabla `negocios`,
sin la clave no puede cobrar ni devolver plata en nombre de un complejo.
"""

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class ClaveFaltante(RuntimeError):
    pass


def _fernet() -> Fernet:
    clave = get_settings().token_encryption_key
    if not clave:
        raise ClaveFaltante("Falta TOKEN_ENCRYPTION_KEY (python -m app.cli generar-clave).")
    return Fernet(clave)


def nueva_clave() -> str:
    return Fernet.generate_key().decode()


def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode()).decode()


def descifrar(cifrado: str) -> str:
    try:
        return _fernet().decrypt(cifrado.encode()).decode()
    except InvalidToken as error:
        raise ClaveFaltante("No se pudo desencriptar: ¿cambió TOKEN_ENCRYPTION_KEY?") from error
