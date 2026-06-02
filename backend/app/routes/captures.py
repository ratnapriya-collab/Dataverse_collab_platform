"""Capture routes — persistent gallery for "Capture View" screenshots.

Endpoints (all require Bearer auth):
  POST   /api/parts/{part_id}/captures               — upload (multipart)
  GET    /api/parts/{part_id}/captures               — list (ordered)
  POST   /api/parts/{part_id}/captures/reorder       — bulk reorder
  GET    /api/captures/{id}/image                    — stream image bytes
  PATCH  /api/captures/{id}                          — edit caption
  DELETE /api/captures/{id}                          — delete

Design notes:
  · Image bytes never travel through JSON. They go up via multipart and
    come back via a dedicated streaming endpoint with the right MIME.
  · `sort_order` is owned by the server. New captures land at the end
    (max + 1); reorder rewrites every row in one transaction.
  · The image-bytes endpoint is auth-gated, so the frontend can't drop
    it into <img src=…> directly (browsers don't send Bearer on image
    loads). The client fetches with auth and converts to a blob URL.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func
from sqlmodel import Session, select

from app.database import get_session
from app.models.capture import Capture
from app.models.user import User
from app.schemas.capture import CaptureRead, CaptureReorder, CaptureUpdate
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Hard cap on a single capture's bytes. 8 MiB leaves headroom for a 4K
# PNG at high quality while preventing accidental DoS via huge uploads.
MAX_CAPTURE_BYTES = 8 * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _not_found(what: str = "Capture") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": "not_found", "message": f"{what} not found"},
    )


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": "bad_request", "message": message},
    )


def _forbidden() -> HTTPException:
    # Mirror parts.py: hide existence by returning 404 for cross-user reads.
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": "not_found", "message": "Capture not found"},
    )


def _serialize(c: Capture) -> CaptureRead:
    return CaptureRead(
        id=c.id,
        part_id=c.part_id,
        author_id=c.author_id,
        caption=c.caption,
        width=c.width,
        height=c.height,
        image_url=f"/api/captures/{c.id}/image",
        image_mime=c.image_mime,
        image_size=c.image_size,
        camera_state=c.camera_state,
        sort_order=c.sort_order,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def _load_owned_capture(session: Session, capture_id: str, user: User) -> Capture:
    cap = session.get(Capture, capture_id)
    if cap is None:
        raise _not_found()
    # Authors can mutate their own captures. Others (incl. project members)
    # can still READ via the list/image endpoints — but only the author can
    # rename or delete. This keeps demo behavior sane without a heavier ACL.
    if cap.author_id != user.id:
        raise _forbidden()
    return cap


# ── Create ────────────────────────────────────────────────────────────────


@router.post(
    "/parts/{part_id}/captures",
    response_model=CaptureRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_capture(
    part_id: str,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    width: int = Form(default=0),
    height: int = Form(default=0),
    camera_state_json: str = Form(default=""),
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CaptureRead:
    """Upload a new capture. Multipart so we can ship the image as a file.

    `part_id` is accepted as an opaque grouping key — see model docstring.
    We don't gate on its presence in the parts table because the frontend
    may pass mock/demo IDs that never go through the real upload flow.
    """
    mime = (file.content_type or "image/jpeg").lower()
    if mime not in ALLOWED_MIME:
        raise _bad_request(f"Unsupported image type: {mime}")

    raw = await file.read()
    if len(raw) == 0:
        raise _bad_request("Empty upload")
    if len(raw) > MAX_CAPTURE_BYTES:
        raise _bad_request(
            f"Capture too large ({len(raw)} bytes). Max is {MAX_CAPTURE_BYTES}."
        )

    camera_state: dict[str, object] | None = None
    if camera_state_json != "":
        try:
            parsed = json.loads(camera_state_json)
            if isinstance(parsed, dict):
                camera_state = parsed  # type: ignore[assignment]
        except json.JSONDecodeError:
            # Bad camera state is non-fatal — drop it, log, continue.
            logger.warning(
                "create_capture.bad_camera_state",
                extra={"part_id": part_id, "user_id": current.id},
            )

    # Next sort_order = current max + 1. COALESCE handles the empty case.
    next_order_row = session.exec(
        select(func.coalesce(func.max(Capture.sort_order), -1)).where(Capture.part_id == part_id)
    ).one()
    # exec(select(scalar)).one() returns the scalar directly on SQLModel >=0.0.14;
    # be defensive in case it wraps in a tuple on some driver versions.
    next_order = (
        next_order_row[0] if isinstance(next_order_row, tuple) else next_order_row
    ) + 1

    now = _now()
    cap = Capture(
        part_id=part_id,
        author_id=current.id,
        caption=caption,
        width=width,
        height=height,
        image_bytes=raw,
        image_mime=mime,
        image_size=len(raw),
        camera_state=camera_state,
        sort_order=int(next_order),
        created_at=now,
        updated_at=now,
    )
    session.add(cap)
    session.commit()
    session.refresh(cap)
    return _serialize(cap)


# ── List ──────────────────────────────────────────────────────────────────


@router.get("/parts/{part_id}/captures", response_model=list[CaptureRead])
def list_captures(
    part_id: str,
    current: User = Depends(get_current_user),  # noqa: ARG001 — auth required, ident unused
    session: Session = Depends(get_session),
) -> list[CaptureRead]:
    """Every capture for a part, in display order (asc by sort_order, tie-break by created_at).

    Returns an empty list if the part has no captures (or doesn't exist) —
    we don't 404 on unknown part_ids so the frontend's first-load on a
    fresh part is a clean no-op rather than an error.
    """
    rows = session.exec(
        select(Capture)
        .where(Capture.part_id == part_id)
        .order_by(Capture.sort_order.asc(), Capture.created_at.asc())  # type: ignore[union-attr]
    ).all()
    return [_serialize(r) for r in rows]


# ── Image bytes ───────────────────────────────────────────────────────────


@router.get("/captures/{capture_id}/image")
def get_capture_image(
    capture_id: str,
    current: User = Depends(get_current_user),  # noqa: ARG001 — auth required
    session: Session = Depends(get_session),
) -> Response:
    """Stream the raw image bytes with the stored MIME."""
    cap = session.get(Capture, capture_id)
    if cap is None:
        raise _not_found()
    return Response(
        content=cap.image_bytes,
        media_type=cap.image_mime,
        headers={
            # Captures are immutable once uploaded (caption changes don't touch
            # bytes), so we can cache aggressively keyed by the capture id.
            "Cache-Control": "private, max-age=86400",
            "Content-Length": str(cap.image_size),
        },
    )


# ── Update caption ────────────────────────────────────────────────────────


@router.patch("/captures/{capture_id}", response_model=CaptureRead)
def update_capture(
    capture_id: str,
    body: CaptureUpdate,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CaptureRead:
    """Update mutable fields (caption today)."""
    cap = _load_owned_capture(session, capture_id, current)
    if body.caption is not None:
        cap.caption = body.caption
    cap.updated_at = _now()
    session.add(cap)
    session.commit()
    session.refresh(cap)
    return _serialize(cap)


# ── Delete ────────────────────────────────────────────────────────────────


@router.delete("/captures/{capture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_capture(
    capture_id: str,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    cap = _load_owned_capture(session, capture_id, current)
    session.delete(cap)
    session.commit()
    # 204 No Content — body must be empty.
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Reorder ───────────────────────────────────────────────────────────────


@router.post("/parts/{part_id}/captures/reorder", response_model=list[CaptureRead])
def reorder_captures(
    part_id: str,
    body: CaptureReorder,
    current: User = Depends(get_current_user),  # noqa: ARG001 — auth required
    session: Session = Depends(get_session),
) -> list[CaptureRead]:
    """Rewrite sort_order for every capture under this part.

    Validates the request's id-set matches what's persisted before writing.
    Either the whole reorder applies or nothing — single transaction.
    """
    rows = session.exec(select(Capture).where(Capture.part_id == part_id)).all()
    existing_ids = {r.id for r in rows}
    requested_ids = set(body.ordered_ids)

    if existing_ids != requested_ids:
        raise _bad_request(
            "Reorder must include every existing capture for the part, exactly once."
        )

    by_id = {r.id: r for r in rows}
    now = _now()
    for new_order, cid in enumerate(body.ordered_ids):
        row = by_id[cid]
        row.sort_order = new_order
        row.updated_at = now
        session.add(row)
    session.commit()

    # Return the new ordered list — saves the client a follow-up GET.
    refreshed = session.exec(
        select(Capture)
        .where(Capture.part_id == part_id)
        .order_by(Capture.sort_order.asc())  # type: ignore[union-attr]
    ).all()
    return [_serialize(r) for r in refreshed]
