"""Parts route tests.

Tests use the same isolated in-memory SQLite + ASGI client as the auth tests.
File uploads write to a temp directory provided by pytest's `tmp_path` so we
don't pollute the repo's ./uploads folder.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlmodel import Session, select

from app.models.event import Event, EventType
from app.utils import storage


# A minimal byte sequence with the GLB magic header — enough to pass our
# validation; the bytes after the magic are irrelevant for upload tests.
GLB_MAGIC = b"glTF\x02\x00\x00\x00" + b"\x00" * 16

# Minimal STEP header — the parser inside the (stubbed) viewer never runs in
# tests; the route only checks the magic bytes.
STEP_HEADER = b"ISO-10303-21;\nHEADER;\nEND-ISO-10303-21;\n"


@pytest.fixture(autouse=True)
def _isolated_upload_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Redirect storage writes to a per-test temp dir."""
    monkeypatch.setattr(storage, "UPLOAD_ROOT", tmp_path)


@pytest_asyncio.fixture(name="auth_token")
async def fixture_auth_token(client: AsyncClient) -> str:
    await client.post(
        "/api/auth/register",
        json={"email": "ria@example.com", "password": "correct-horse", "name": "Ria"},
    )
    login = await client.post(
        "/api/auth/login",
        json={"email": "ria@example.com", "password": "correct-horse"},
    )
    return login.json()["access_token"]


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ── Upload ────────────────────────────────────────────────────────────────────


async def test_upload_glb_succeeds(
    client: AsyncClient, auth_token: str, session: Session
) -> None:
    response = await client.post(
        "/api/parts/upload",
        files={"file": ("bracket.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["file_name"] == "bracket.glb"
    assert body["name"] == "bracket"
    assert len(body["content_hash"]) == 64

    events = session.exec(select(Event).where(Event.type == EventType.PART_UPLOADED)).all()
    assert len(events) == 1
    assert events[0].subject_id == body["id"]


async def test_upload_rejects_missing_extension(
    client: AsyncClient, auth_token: str
) -> None:
    response = await client.post(
        "/api/parts/upload",
        files={"file": ("brokenname", GLB_MAGIC, "application/octet-stream")},
        headers=_bearer(auth_token),
    )
    assert response.status_code == 400


async def test_upload_rejects_unsupported_extension(
    client: AsyncClient, auth_token: str
) -> None:
    response = await client.post(
        "/api/parts/upload",
        files={"file": ("bad.exe", b"MZ\x00" * 10, "application/octet-stream")},
        headers=_bearer(auth_token),
    )
    assert response.status_code == 400


async def test_upload_rejects_renamed_garbage(
    client: AsyncClient, auth_token: str
) -> None:
    # Claims to be a GLB but doesn't start with 'glTF' magic.
    response = await client.post(
        "/api/parts/upload",
        files={"file": ("fake.glb", b"NOT_GLTF" * 4, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    assert response.status_code == 400


async def test_upload_rejects_empty_file(client: AsyncClient, auth_token: str) -> None:
    response = await client.post(
        "/api/parts/upload",
        files={"file": ("empty.glb", b"", "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    assert response.status_code == 400


async def test_upload_requires_auth(client: AsyncClient) -> None:
    response = await client.post(
        "/api/parts/upload",
        files={"file": ("bracket.glb", GLB_MAGIC, "model/gltf-binary")},
    )
    assert response.status_code == 401


async def test_upload_step_with_valid_header_succeeds(
    client: AsyncClient, auth_token: str
) -> None:
    response = await client.post(
        "/api/parts/upload",
        files={"file": ("widget.step", STEP_HEADER, "model/step")},
        headers=_bearer(auth_token),
    )
    assert response.status_code == 201


# ── List ──────────────────────────────────────────────────────────────────────


async def test_list_returns_only_own_parts(
    client: AsyncClient, auth_token: str
) -> None:
    # User A uploads
    await client.post(
        "/api/parts/upload",
        files={"file": ("a.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )

    # User B uploads
    await client.post(
        "/api/auth/register",
        json={"email": "bob@example.com", "password": "another-horse", "name": "Bob"},
    )
    login_b = await client.post(
        "/api/auth/login",
        json={"email": "bob@example.com", "password": "another-horse"},
    )
    token_b = login_b.json()["access_token"]
    await client.post(
        "/api/parts/upload",
        files={"file": ("b.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(token_b),
    )

    list_a = await client.get("/api/parts", headers=_bearer(auth_token))
    list_b = await client.get("/api/parts", headers=_bearer(token_b))
    assert len(list_a.json()) == 1
    assert list_a.json()[0]["file_name"] == "a.glb"
    assert len(list_b.json()) == 1
    assert list_b.json()[0]["file_name"] == "b.glb"


async def test_list_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/parts")
    assert response.status_code == 401


# ── Get + signed URL ─────────────────────────────────────────────────────────


async def test_get_returns_signed_url(client: AsyncClient, auth_token: str) -> None:
    upload = await client.post(
        "/api/parts/upload",
        files={"file": ("bracket.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    part_id = upload.json()["id"]
    response = await client.get(f"/api/parts/{part_id}", headers=_bearer(auth_token))
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == part_id
    assert body["file_url"].startswith(f"/api/parts/{part_id}/file?token=")
    assert body["file_url_expires_in"] == 600


async def test_get_other_users_part_returns_404(
    client: AsyncClient, auth_token: str
) -> None:
    # Upload as user A
    upload = await client.post(
        "/api/parts/upload",
        files={"file": ("secret.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    part_id = upload.json()["id"]

    # Try to fetch as user B
    await client.post(
        "/api/auth/register",
        json={"email": "eve@example.com", "password": "nope-horse-please", "name": "Eve"},
    )
    login_b = await client.post(
        "/api/auth/login",
        json={"email": "eve@example.com", "password": "nope-horse-please"},
    )
    response = await client.get(
        f"/api/parts/{part_id}",
        headers=_bearer(login_b.json()["access_token"]),
    )
    assert response.status_code == 404


async def test_get_nonexistent_part_returns_404(
    client: AsyncClient, auth_token: str
) -> None:
    response = await client.get(
        "/api/parts/00000000-0000-0000-0000-000000000000",
        headers=_bearer(auth_token),
    )
    assert response.status_code == 404


# ── File download ─────────────────────────────────────────────────────────────


async def test_file_download_streams_bytes(
    client: AsyncClient, auth_token: str
) -> None:
    upload = await client.post(
        "/api/parts/upload",
        files={"file": ("bracket.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    detail = await client.get(f"/api/parts/{upload.json()['id']}", headers=_bearer(auth_token))
    file_url = detail.json()["file_url"]
    response = await client.get(file_url)
    assert response.status_code == 200
    assert response.content == GLB_MAGIC
    assert response.headers["content-type"] == "model/gltf-binary"


async def test_file_download_rejects_missing_token(
    client: AsyncClient, auth_token: str
) -> None:
    upload = await client.post(
        "/api/parts/upload",
        files={"file": ("bracket.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    part_id = upload.json()["id"]
    response = await client.get(f"/api/parts/{part_id}/file")
    assert response.status_code == 422  # missing required query param


async def test_file_download_rejects_bogus_token(
    client: AsyncClient, auth_token: str
) -> None:
    upload = await client.post(
        "/api/parts/upload",
        files={"file": ("bracket.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    part_id = upload.json()["id"]
    response = await client.get(f"/api/parts/{part_id}/file?token=not-a-real-jwt")
    assert response.status_code == 401


async def test_file_download_rejects_token_for_different_part(
    client: AsyncClient, auth_token: str
) -> None:
    # Upload two parts.
    a = await client.post(
        "/api/parts/upload",
        files={"file": ("a.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    b = await client.post(
        "/api/parts/upload",
        files={"file": ("b.glb", GLB_MAGIC + b"\x01", "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    # Get a signed URL for A, then try to use it on B's file route.
    detail_a = await client.get(f"/api/parts/{a.json()['id']}", headers=_bearer(auth_token))
    token = detail_a.json()["file_url"].split("token=", 1)[1]
    response = await client.get(f"/api/parts/{b.json()['id']}/file?token={token}")
    assert response.status_code == 401


async def test_upload_dedups_same_content_per_owner(
    client: AsyncClient, auth_token: str, tmp_path: Path
) -> None:
    # Two uploads with the same bytes → one file on disk, two DB rows.
    await client.post(
        "/api/parts/upload",
        files={"file": ("first.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    await client.post(
        "/api/parts/upload",
        files={"file": ("second.glb", GLB_MAGIC, "model/gltf-binary")},
        headers=_bearer(auth_token),
    )
    # Exactly one file in the per-owner dir.
    owner_dirs = [p for p in tmp_path.iterdir() if p.is_dir()]
    assert len(owner_dirs) == 1
    files = list(owner_dirs[0].iterdir())
    assert len(files) == 1
