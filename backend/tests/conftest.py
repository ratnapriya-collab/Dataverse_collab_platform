"""Pytest fixtures — isolated SQLite per test, dependency-overridden client."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator

# Configure the app to use SQLite + a known JWT secret BEFORE any app import.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret")
os.environ.setdefault("FRONTEND_ORIGINS", "http://localhost:3000")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import StaticPool  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402

from app import models  # noqa: F401, E402 — registers tables
from app.database import get_session  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(name="engine")
def fixture_engine() -> Iterator[Engine]:
    """Fresh in-memory SQLite engine per test — no state leaks."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    try:
        yield engine
    finally:
        SQLModel.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture(name="session")
def fixture_session(engine: Engine) -> Iterator[Session]:
    with Session(engine) as session:
        yield session


@pytest_asyncio.fixture(name="client")
async def fixture_client(engine: Engine) -> AsyncIterator[AsyncClient]:
    """HTTP client whose DB session uses the per-test engine."""
    app = create_app()

    def _override_session() -> Iterator[Session]:
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _override_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
