"""Anchor route tests — covers idempotency, ownership, validation, events."""

from __future__ import annotations

from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlmodel import Session, select

from app.models.anchor import Anchor
from app.models.event import Event, EventType
from app.utils import storage

GLB_MAGIC = b"glTF\x02\x00\x00\x00" + b"\x00" * 16


@pytest.fixture(autouse=True)
def _isolated_upload_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "UPLOAD_ROOT", tmp_path)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(name="user_a")
async def fixture_user_a(client: AsyncClient) -> dict[str, str]:
    """Register user A, upload a part, return both tokens + IDs."""
    await client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "password": "correct-horse", "name": "Alice"},
    )
    login = await client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "correct-horse"},
    )
    token = login.json()["access_token"]

    upload = await client.post(
        "/api/parts/upload",
        files={"file": ("widget.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(token),
    )
    return {"token": token, "part_id": upload.json()["id"]}


def _anchor_payload(part_id: str, face_uuid: str = "a3f5b1c2-7e8d-4f2a-9c1b-0d3e8f7a6b5c") -> dict:
    return {
        "part_id": part_id,
        "face_uuid": face_uuid,
        "kind": "FACE",
        "centroid": {"x": 1.0, "y": 0.5, "z": 0.5},
    }


# ── Create / upsert ──────────────────────────────────────────────────────────


async def test_create_anchor_returns_201_and_logs_event(
    client: AsyncClient, user_a: dict[str, str], session: Session
) -> None:
    response = await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"]),
        headers=_bearer(user_a["token"]),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["part_id"] == user_a["part_id"]
    assert body["face_uuid"] == "a3f5b1c2-7e8d-4f2a-9c1b-0d3e8f7a6b5c"
    assert body["kind"] == "FACE"
    assert body["centroid"] == {"x": 1.0, "y": 0.5, "z": 0.5}

    events = session.exec(select(Event).where(Event.type == EventType.ANCHOR_CREATED)).all()
    assert len(events) == 1


async def test_create_same_face_twice_is_idempotent(
    client: AsyncClient, user_a: dict[str, str], session: Session
) -> None:
    first = await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"]),
        headers=_bearer(user_a["token"]),
    )
    second = await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"]),
        headers=_bearer(user_a["token"]),
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]

    # Only one row in DB.
    rows = session.exec(select(Anchor)).all()
    assert len(rows) == 1

    # Only one ANCHOR_CREATED event.
    events = session.exec(select(Event).where(Event.type == EventType.ANCHOR_CREATED)).all()
    assert len(events) == 1


async def test_different_faces_create_distinct_anchors(
    client: AsyncClient, user_a: dict[str, str], session: Session
) -> None:
    r1 = await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"], face_uuid="aaaaaaaa-1111-2222-3333-444444444444"),
        headers=_bearer(user_a["token"]),
    )
    r2 = await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"], face_uuid="bbbbbbbb-1111-2222-3333-555555555555"),
        headers=_bearer(user_a["token"]),
    )
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]

    rows = session.exec(select(Anchor)).all()
    assert len(rows) == 2


async def test_create_requires_auth(client: AsyncClient, user_a: dict[str, str]) -> None:
    response = await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"]),
    )
    assert response.status_code == 401


async def test_create_rejects_short_face_uuid(
    client: AsyncClient, user_a: dict[str, str]
) -> None:
    payload = _anchor_payload(user_a["part_id"])
    payload["face_uuid"] = "tooshrt"  # 7 chars — below min_length=8
    response = await client.post("/api/anchors", json=payload, headers=_bearer(user_a["token"]))
    assert response.status_code == 422


async def test_create_rejects_unknown_part(
    client: AsyncClient, user_a: dict[str, str]
) -> None:
    response = await client.post(
        "/api/anchors",
        json=_anchor_payload("00000000-0000-0000-0000-000000000000"),
        headers=_bearer(user_a["token"]),
    )
    assert response.status_code == 404


async def test_create_rejects_anchor_on_someone_elses_part(
    client: AsyncClient, user_a: dict[str, str]
) -> None:
    # User B registers.
    await client.post(
        "/api/auth/register",
        json={"email": "bob@example.com", "password": "another-horse", "name": "Bob"},
    )
    login_b = await client.post(
        "/api/auth/login",
        json={"email": "bob@example.com", "password": "another-horse"},
    )
    token_b = login_b.json()["access_token"]

    # Bob tries to anchor on Alice's part.
    response = await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"]),
        headers=_bearer(token_b),
    )
    assert response.status_code == 404  # Same shape as missing-part.


# ── List ─────────────────────────────────────────────────────────────────────


async def test_list_anchors_filters_by_part(
    client: AsyncClient, user_a: dict[str, str]
) -> None:
    # Create two anchors on the part.
    await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"], face_uuid="aaaaaaaa-1111-2222-3333-444444444444"),
        headers=_bearer(user_a["token"]),
    )
    await client.post(
        "/api/anchors",
        json=_anchor_payload(user_a["part_id"], face_uuid="bbbbbbbb-1111-2222-3333-555555555555"),
        headers=_bearer(user_a["token"]),
    )

    response = await client.get(
        f"/api/anchors?part_id={user_a['part_id']}",
        headers=_bearer(user_a["token"]),
    )
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 2
    assert {r["face_uuid"] for r in rows} == {
        "aaaaaaaa-1111-2222-3333-444444444444",
        "bbbbbbbb-1111-2222-3333-555555555555",
    }


async def test_list_requires_part_id_query(
    client: AsyncClient, user_a: dict[str, str]
) -> None:
    response = await client.get("/api/anchors", headers=_bearer(user_a["token"]))
    assert response.status_code == 422


async def test_list_requires_auth(client: AsyncClient, user_a: dict[str, str]) -> None:
    response = await client.get(f"/api/anchors?part_id={user_a['part_id']}")
    assert response.status_code == 401


async def test_list_rejects_other_users_part(
    client: AsyncClient, user_a: dict[str, str]
) -> None:
    await client.post(
        "/api/auth/register",
        json={"email": "eve@example.com", "password": "shh-horse-shh", "name": "Eve"},
    )
    login_e = await client.post(
        "/api/auth/login",
        json={"email": "eve@example.com", "password": "shh-horse-shh"},
    )
    response = await client.get(
        f"/api/anchors?part_id={user_a['part_id']}",
        headers=_bearer(login_e.json()["access_token"]),
    )
    assert response.status_code == 404


async def test_list_returns_empty_for_part_with_no_anchors(
    client: AsyncClient, user_a: dict[str, str]
) -> None:
    response = await client.get(
        f"/api/anchors?part_id={user_a['part_id']}",
        headers=_bearer(user_a["token"]),
    )
    assert response.status_code == 200
    assert response.json() == []
