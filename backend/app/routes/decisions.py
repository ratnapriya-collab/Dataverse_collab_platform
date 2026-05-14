"""Decisions routes — list, create, transition."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.handlers.create_decision import create_decision
from app.handlers.transition_decision import transition_decision
from app.models.anchor import Anchor
from app.models.decision import Decision, DecisionState
from app.models.part import Part
from app.models.user import User
from app.schemas.decision import (
    DecisionAnchor,
    DecisionAuthor,
    DecisionCreate,
    DecisionRead,
    DecisionTransition,
)
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _hydrate(d: Decision, session: Session) -> DecisionRead:
    """Add the nested author + anchor info that the UI panel needs."""
    author = session.get(User, d.author_id)
    anchor = session.get(Anchor, d.anchor_id)
    result = DecisionRead.model_validate(d)
    if author is not None:
        result.author = DecisionAuthor.model_validate(author)
    if anchor is not None:
        result.anchor = DecisionAnchor(
            id=anchor.id,
            face_uuid=anchor.face_uuid,
            centroid={
                "x": float(anchor.centroid.get("x", 0)),
                "y": float(anchor.centroid.get("y", 0)),
                "z": float(anchor.centroid.get("z", 0)),
            },
        )
    return result


@router.get("", response_model=list[DecisionRead])
def list_decisions(
    part_id: str = Query(..., description="Filter by part"),
    state: DecisionState | None = Query(default=None, description="Optional state filter"),
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[DecisionRead]:
    """List decisions for a part. Caller must own the part."""
    part = session.get(Part, part_id)
    if part is None or part.owner_id != current.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Part not found"},
        )

    stmt = select(Decision).where(Decision.part_id == part_id)
    if state is not None:
        stmt = stmt.where(Decision.state == state)
    stmt = stmt.order_by(Decision.created_at.desc())  # type: ignore[attr-defined]
    rows = session.exec(stmt).all()
    return [_hydrate(d, session) for d in rows]


@router.post("", response_model=DecisionRead, status_code=status.HTTP_201_CREATED)
def post_decision(
    body: DecisionCreate,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DecisionRead:
    """Create a Decision in PROPOSED state. Mandatory rationale enforced."""
    d = create_decision(body, current, session)
    return _hydrate(d, session)


@router.patch("/{decision_id}/transition", response_model=DecisionRead)
def transition(
    decision_id: str,
    body: DecisionTransition,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DecisionRead:
    """Transition a Decision through its FSM. Rejects illegal targets with 400."""
    decision = session.get(Decision, decision_id)
    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Decision not found"},
        )

    # Ownership check — only the part's owner can transition decisions on it.
    part = session.get(Part, decision.part_id)
    if part is None or part.owner_id != current.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Decision not found"},
        )

    d = transition_decision(decision, body.to, current, session)
    return _hydrate(d, session)
