"""Anchor routes — idempotent upsert + list.

ARCHITECTURAL NON-NEGOTIABLE #3: every state change writes an event. The
ANCHOR_CREATED event is emitted only on first insert, not on idempotent
re-picks (otherwise repeated clicks would spam the audit log).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import get_session
from app.models.anchor import Anchor
from app.models.event import EventType
from app.models.part import Part
from app.models.user import User
from app.schemas.anchor import AnchorCreate, AnchorRead
from app.utils.auth import get_current_user
from app.utils.events import log_event

logger = logging.getLogger(__name__)
router = APIRouter()


def _not_found(message: str = "Part not found") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": "not_found", "message": message},
    )


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": "bad_request", "message": message},
    )


def _assert_part_belongs_to(user: User, part_id: str, session: Session) -> Part:
    part = session.get(Part, part_id)
    if part is None or part.owner_id != user.id:
        # Same 404 either way — don't leak the existence of other users' parts.
        raise _not_found()
    return part


@router.post("", response_model=AnchorRead)
def upsert_anchor(
    body: AnchorCreate,
    response: Response,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AnchorRead:
    """Create an anchor or return the existing one for (part_id, face_uuid).

    Returns 201 on first creation, 200 when the (part_id, face_uuid) pair
    already exists — making the endpoint idempotent against repeat clicks.
    """
    _assert_part_belongs_to(current, body.part_id, session)

    centroid_dict = {"x": body.centroid.x, "y": body.centroid.y, "z": body.centroid.z}

    # Optimistic insert first. The unique constraint catches concurrent picks
    # racing on the same face.
    candidate = Anchor(
        part_id=body.part_id,
        face_uuid=body.face_uuid,
        kind=body.kind,
        centroid=centroid_dict,
        created_by=current.id,
    )
    session.add(candidate)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        existing = session.exec(
            select(Anchor).where(
                Anchor.part_id == body.part_id,
                Anchor.face_uuid == body.face_uuid,
            )
        ).first()
        if existing is None:
            # Shouldn't happen — flush failed but no existing row was found.
            raise _bad_request("anchor write conflict") from None
        response.status_code = status.HTTP_200_OK
        return AnchorRead.model_validate(existing)

    log_event(
        session,
        event_type=EventType.ANCHOR_CREATED,
        actor_id=current.id,
        subject_id=candidate.id,
        payload={
            "part_id": candidate.part_id,
            "face_uuid": candidate.face_uuid,
            "kind": candidate.kind.value,
            "centroid": centroid_dict,
        },
    )
    session.commit()
    session.refresh(candidate)
    response.status_code = status.HTTP_201_CREATED
    return AnchorRead.model_validate(candidate)


@router.get("", response_model=list[AnchorRead])
def list_anchors(
    part_id: str = Query(..., description="The part whose anchors to list"),
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[AnchorRead]:
    """List anchors for a part. Caller must own the part."""
    _assert_part_belongs_to(current, part_id, session)
    rows = session.exec(
        select(Anchor)
        .where(Anchor.part_id == part_id)
        .order_by(Anchor.created_at.asc())  # type: ignore[attr-defined]
    ).all()
    return [AnchorRead.model_validate(a) for a in rows]
