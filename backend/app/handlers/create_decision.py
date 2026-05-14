"""create_decision — implements the mandatory rationale gate.

★ THE HEART OF THE SYSTEM ★

ARCHITECTURAL NON-NEGOTIABLE #1: a Decision cannot exist without a substantive
rationale. The Pydantic schema already enforces min_length=10 with whitespace
stripped — this handler re-validates anyway. Two layers. Never trust the client.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from sqlmodel import Session

from app.models.anchor import Anchor
from app.models.decision import Decision, DecisionState
from app.models.event import EventType
from app.models.part import Part
from app.models.user import User
from app.schemas.decision import MIN_RATIONALE_LENGTH, DecisionCreate
from app.utils.events import log_event

logger = logging.getLogger(__name__)


def create_decision(payload: DecisionCreate, current_user: User, session: Session) -> Decision:
    """Create a PROPOSED Decision, enforcing the rationale gate."""

    # ── Layer 1: rationale gate (Pydantic stripped + min-checked, we verify again) ──
    rationale = payload.rationale.strip()
    if len(rationale) < MIN_RATIONALE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "mandatory_rationale_violated",
                "message": (
                    f"A Decision requires a rationale of at least "
                    f"{MIN_RATIONALE_LENGTH} characters. This is enforced "
                    f"server-side and cannot be bypassed."
                ),
            },
        )

    # ── Layer 2: ownership + anchor↔part consistency ──
    part = session.get(Part, payload.part_id)
    if part is None or part.owner_id != current_user.id:
        # Same 404 either way — don't leak the existence of other users' parts.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "anchor_or_part_not_found", "message": "Part not found"},
        )

    anchor = session.get(Anchor, payload.anchor_id)
    if anchor is None or anchor.part_id != payload.part_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "anchor_or_part_not_found",
                "message": "Anchor does not exist on this part",
            },
        )

    # ── Layer 3: insert ──
    decision = Decision(
        part_id=payload.part_id,
        anchor_id=payload.anchor_id,
        author_id=current_user.id,
        state=DecisionState.PROPOSED,
        rationale=rationale,
    )
    session.add(decision)
    session.flush()

    # ── Layer 4: audit event in the same DB transaction ──
    log_event(
        session,
        event_type=EventType.DECISION_PROPOSED,
        actor_id=current_user.id,
        subject_id=decision.id,
        payload={
            "decision_id": decision.id,
            "part_id": decision.part_id,
            "anchor_id": decision.anchor_id,
            "rationale": decision.rationale,
        },
    )
    session.commit()
    session.refresh(decision)
    return decision
