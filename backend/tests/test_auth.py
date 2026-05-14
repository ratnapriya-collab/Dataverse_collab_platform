"""Auth route tests — register + login happy path and the documented failure modes."""

from __future__ import annotations

from httpx import AsyncClient
from sqlmodel import Session, select

from app.models.event import Event, EventType


def _payload() -> dict[str, str]:
    return {"email": "alice@example.com", "password": "correct-horse", "name": "Alice"}


async def test_register_returns_user_and_logs_event(client: AsyncClient, session: Session) -> None:
    response = await client.post("/api/auth/register", json=_payload())
    assert response.status_code == 201

    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["name"] == "Alice"
    assert "id" in body and isinstance(body["id"], str)
    assert "password_hash" not in body  # never leak the hash

    events = session.exec(select(Event).where(Event.type == EventType.USER_REGISTERED)).all()
    assert len(events) == 1


async def test_register_rejects_duplicate_email(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=_payload())
    response = await client.post("/api/auth/register", json=_payload())
    assert response.status_code == 409
    assert response.json()["detail"]["error"] == "conflict"


async def test_register_rejects_short_password(client: AsyncClient) -> None:
    bad = {"email": "bob@example.com", "password": "short", "name": "Bob"}
    response = await client.post("/api/auth/register", json=bad)
    assert response.status_code == 422


async def test_register_rejects_invalid_email(client: AsyncClient) -> None:
    bad = {"email": "not-an-email", "password": "correct-horse", "name": "Bob"}
    response = await client.post("/api/auth/register", json=bad)
    assert response.status_code == 422


async def test_login_returns_token_and_logs_event(client: AsyncClient, session: Session) -> None:
    await client.post("/api/auth/register", json=_payload())
    response = await client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "correct-horse"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]
    assert body["user"]["email"] == "alice@example.com"

    events = session.exec(select(Event).where(Event.type == EventType.USER_LOGGED_IN)).all()
    assert len(events) == 1


async def test_login_rejects_wrong_password(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=_payload())
    response = await client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"]["error"] == "invalid_credentials"


async def test_login_rejects_unknown_user(client: AsyncClient) -> None:
    response = await client.post(
        "/api/auth/login",
        json={"email": "ghost@example.com", "password": "irrelevant"},
    )
    assert response.status_code == 401


async def test_me_requires_token(client: AsyncClient) -> None:
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


async def test_me_returns_current_user(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=_payload())
    login = await client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "correct-horse"},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "alice@example.com"


async def test_me_rejects_bad_token(client: AsyncClient) -> None:
    response = await client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"}
    )
    assert response.status_code == 401
