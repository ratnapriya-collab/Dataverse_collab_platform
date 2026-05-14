"""Database engine, session dependency, and schema bootstrap."""

from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

_settings = get_settings()

# SQLite needs check_same_thread=False; Postgres does not.
_connect_args: dict[str, object] = (
    {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    _settings.database_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)


def init_db() -> None:
    """Create tables if they do not exist. Prefer Alembic for real schema changes."""
    # Importing models registers them with SQLModel.metadata.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency that yields a DB session and closes it on request end."""
    with Session(engine) as session:
        yield session
