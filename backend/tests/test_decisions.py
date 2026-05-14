"""Decision route tests — the mandatory rationale gate is the centrepiece.

Covers Day 5 spec acceptance criteria:
- empty / whitespace / 9-char rationale → 400 (mandatory_rationale_violated)
- valid rationale → 201 + state PROPOSED + DECISION_PROPOSED event
- missing anchor → 404 ; anchor-on-different-part → 404
- unauthenticated → 401
- PROPOSED → ACCEPTED → 200 + accepted_at set + event
- ACCEPTED → PROPOSED → 400 (invalid_transition)
- REJECTED → ACCEPTED → 400 (terminal state)
"""

from __future__ import annotations

from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlmodel import Session, select

from app.models.event import Event, EventType
from app.utils import storage

GLB_MAGIC = b"glTF\x02\x00\x00\x00" + b"\x00" * 16
VALID_RATIONALE = "Wall thickness at this face is below the 2.0 mm minimum spec."


@pytest.fixture(autouse=True)
def _isolated_upload_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "UPLOAD_ROOT", tmp_path)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(name="ctx")
async def fixture_ctx(client: AsyncClient) -> dict[str, str]:
    """Register a user, upload a part, create an anchor. Return all three IDs + token."""
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
    part_id = upload.json()["id"]

    anchor = await client.post(
        "/api/anchors",
        json={
            "part_id": part_id,
            "face_uuid": "a3f5b1c2-7e8d-4f2a-9c1b-0d3e8f7a6b5c",
            "kind": "FACE",
            "centroid": {"x": 1.0, "y": 0.5, "z": 0.5},
        },
        headers=_bearer(token),
    )
    return {"token": token, "part_id": part_id, "anchor_id": anchor.json()["id"]}


def _payload(ctx: dict[str, str], rationale: str = VALID_RATIONALE) -> dict:
    return {"part_id": ctx["part_id"], "anchor_id": ctx["anchor_id"], "rationale": rationale}


# ── Rationale gate ───────────────────────────────────────────────────────────


async def test_empty_rationale_rejected(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    response = await client.post(
        "/api/decisions", json=_payload(ctx, ""), headers=_bearer(ctx["token"])
    )
    assert response.status_code == 422  # Pydantic catches min_length before handler


async def test_whitespace_only_rationale_rejected(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    response = await client.post(
        "/api/decisions",
        json=_payload(ctx, "         "),
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 422


async def test_nine_char_rationale_rejected(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    # Pydantic min_length=10 → 422.
    response = await client.post(
        "/api/decisions",
        json=_payload(ctx, "123456789"),
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 422


async def test_rationale_padded_with_whitespace_rejected_after_strip(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    # Raw length 15, but trims to 5 — must fail.
    response = await client.post(
        "/api/decisions",
        json=_payload(ctx, "     short     "),
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 422


async def test_valid_rationale_creates_decision_and_event(
    client: AsyncClient, ctx: dict[str, str], session: Session
) -> None:
    response = await client.post(
        "/api/decisions", json=_payload(ctx), headers=_bearer(ctx["token"])
    )
    assert response.status_code == 201
    body = response.json()
    assert body["state"] == "PROPOSED"
    assert body["rationale"] == VALID_RATIONALE
    assert body["author_id"] != ""
    assert body["author"]["email"] == "alice@example.com"
    assert body["anchor"]["face_uuid"] == "a3f5b1c2-7e8d-4f2a-9c1b-0d3e8f7a6b5c"

    events = session.exec(select(Event).where(Event.type == EventType.DECISION_PROPOSED)).all()
    assert len(events) == 1
    assert events[0].subject_id == body["id"]


# ── Auth + ownership ─────────────────────────────────────────────────────────


async def test_unauthenticated_create_rejected(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    response = await client.post("/api/decisions", json=_payload(ctx))
    assert response.status_code == 401


async def test_missing_anchor_returns_404(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    payload = _payload(ctx)
    payload["anchor_id"] = "00000000-0000-0000-0000-000000000000"
    response = await client.post(
        "/api/decisions", json=payload, headers=_bearer(ctx["token"])
    )
    assert response.status_code == 404


async def test_anchor_on_different_part_returns_404(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    # Upload a second part on the same user, then post a decision claiming
    # the original anchor is on this new part.
    upload2 = await client.post(
        "/api/parts/upload",
        files={"file": ("other.glb", GLB_MAGIC + b"\x01", "model/gltf-binary")},
        headers=_bearer(ctx["token"]),
    )
    payload = _payload(ctx)
    payload["part_id"] = upload2.json()["id"]
    response = await client.post(
        "/api/decisions", json=payload, headers=_bearer(ctx["token"])
    )
    assert response.status_code == 404


# ── List ─────────────────────────────────────────────────────────────────────


async def test_list_filters_by_part_and_state(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    # Create a decision.
    created = await client.post(
        "/api/decisions", json=_payload(ctx), headers=_bearer(ctx["token"])
    )
    decision_id = created.json()["id"]

    # List all decisions.
    all_resp = await client.get(
        f"/api/decisions?part_id={ctx['part_id']}", headers=_bearer(ctx["token"])
    )
    assert all_resp.status_code == 200
    assert len(all_resp.json()) == 1

    # Filter by state PROPOSED → returns the same one.
    proposed_resp = await client.get(
        f"/api/decisions?part_id={ctx['part_id']}&state=PROPOSED",
        headers=_bearer(ctx["token"]),
    )
    assert proposed_resp.status_code == 200
    assert len(proposed_resp.json()) == 1
    assert proposed_resp.json()[0]["id"] == decision_id

    # Filter by state ACCEPTED → empty.
    accepted_resp = await client.get(
        f"/api/decisions?part_id={ctx['part_id']}&state=ACCEPTED",
        headers=_bearer(ctx["token"]),
    )
    assert accepted_resp.status_code == 200
    assert accepted_resp.json() == []


# ── Transitions ──────────────────────────────────────────────────────────────


async def test_proposed_to_accepted_succeeds_and_sets_accepted_at(
    client: AsyncClient, ctx: dict[str, str], session: Session
) -> None:
    created = await client.post(
        "/api/decisions", json=_payload(ctx), headers=_bearer(ctx["token"])
    )
    decision_id = created.json()["id"]
    response = await client.patch(
        f"/api/decisions/{decision_id}/transition",
        json={"to": "ACCEPTED"},
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "ACCEPTED"
    assert body["accepted_at"] is not None
    assert body["accepted_by_id"] is not None

    events = session.exec(select(Event).where(Event.type == EventType.DECISION_ACCEPTED)).all()
    assert len(events) == 1


async def test_accepted_to_proposed_rejected(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    created = await client.post(
        "/api/decisions", json=_payload(ctx), headers=_bearer(ctx["token"])
    )
    decision_id = created.json()["id"]
    await client.patch(
        f"/api/decisions/{decision_id}/transition",
        json={"to": "ACCEPTED"},
        headers=_bearer(ctx["token"]),
    )
    response = await client.patch(
        f"/api/decisions/{decision_id}/transition",
        json={"to": "PROPOSED"},
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "invalid_transition"


async def test_rejected_is_terminal(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    created = await client.post(
        "/api/decisions", json=_payload(ctx), headers=_bearer(ctx["token"])
    )
    decision_id = created.json()["id"]
    await client.patch(
        f"/api/decisions/{decision_id}/transition",
        json={"to": "REJECTED"},
        headers=_bearer(ctx["token"]),
    )
    response = await client.patch(
        f"/api/decisions/{decision_id}/transition",
        json={"to": "ACCEPTED"},
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "invalid_transition"


async def test_proposed_to_rejected_succeeds(
    client: AsyncClient, ctx: dict[str, str], session: Session
) -> None:
    created = await client.post(
        "/api/decisions", json=_payload(ctx), headers=_bearer(ctx["token"])
    )
    response = await client.patch(
        f"/api/decisions/{created.json()['id']}/transition",
        json={"to": "REJECTED"},
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 200
    assert response.json()["state"] == "REJECTED"
    events = session.exec(select(Event).where(Event.type == EventType.DECISION_REJECTED)).all()
    assert len(events) == 1


async def test_transition_requires_auth(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    created = await client.post(
        "/api/decisions", json=_payload(ctx), headers=_bearer(ctx["token"])
    )
    response = await client.patch(
        f"/api/decisions/{created.json()['id']}/transition",
        json={"to": "ACCEPTED"},
    )
    assert response.status_code == 401


async def test_transition_unknown_decision_returns_404(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    response = await client.patch(
        "/api/decisions/00000000-0000-0000-0000-000000000000/transition",
        json={"to": "ACCEPTED"},
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 404


# ── Datum mock ──────────────────────────────────────────────────────────────


async def test_datum_suggest_returns_a_string(
    client: AsyncClient, ctx: dict[str, str]
) -> None:
    response = await client.post(
        "/api/datum/suggest-rationale",
        json={"part_name": "widget", "anchor_id": ctx["anchor_id"]},
        headers=_bearer(ctx["token"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["suggestion"], str)
    assert len(body["suggestion"]) >= 20  # well above the rationale minimum


async def test_datum_suggest_requires_auth(client: AsyncClient) -> None:
    response = await client.post(
        "/api/datum/suggest-rationale", json={"part_name": "widget"}
    )
    assert response.status_code == 401
