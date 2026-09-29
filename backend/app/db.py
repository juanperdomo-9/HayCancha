"""Conexiones a la base.

- `sesion_de_negocio(id)`: la que usa casi toda la app. Conecta como app_user y fija
  app.negocio_id al empezar cada transacción, así RLS solo deja ver ese negocio.
- `get_session()`: sin negocio, para lo público que no es de un negocio en particular
  (buscar un negocio por slug, listar deportes).
- `sesion_admin()`: rol dueño de las tablas, se saltea RLS. Solo para el superadmin
  (alta, suspensión, cobros) y los comandos de `app.cli`. Nunca en rutas públicas ni
  del panel de dueños.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Connection, Engine, create_engine, event, text
from sqlalchemy.orm import Session, SessionTransaction, sessionmaker

from app.config import get_settings


def _crear_engine(url: str) -> Engine:
    return create_engine(
        url,
        # El pooler de Supabase en modo transacción no admite prepared statements.
        # Sin timeout, una base caída cuelga /health y el cron job indefinidamente.
        connect_args={"prepare_threshold": None, "connect_timeout": 10},
        pool_pre_ping=True,
    )


@lru_cache
def get_engine() -> Engine:
    return _crear_engine(get_settings().database_url)


@lru_cache
def get_engine_admin() -> Engine:
    return _crear_engine(get_settings().database_url_admin)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


@lru_cache
def get_sessionmaker_admin() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine_admin(), expire_on_commit=False)


@event.listens_for(Session, "after_begin")
def _fijar_negocio(
    session: Session, _transaccion: SessionTransaction, conexion: Connection
) -> None:
    # Se repite en cada transacción: un commit() en el medio no deja la sesión sin negocio.
    negocio_id = session.info.get("negocio_id")
    if negocio_id is not None:
        conexion.execute(
            text("SELECT set_config('app.negocio_id', :id, true)"), {"id": str(negocio_id)}
        )


@contextmanager
def sesion_de_negocio(negocio_id: uuid.UUID) -> Iterator[Session]:
    with get_sessionmaker()(info={"negocio_id": negocio_id}) as session:
        yield session


def get_session() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session


@contextmanager
def sesion_admin() -> Iterator[Session]:
    with get_sessionmaker_admin()() as session:
        yield session
