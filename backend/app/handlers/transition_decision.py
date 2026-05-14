"""transition_decision — apply a state transition against the FSM whitelist.

ARCHITECTURAL NON-NEGOTIABLE #1: when transitioning to ACCEPTED we re-verify
the rationale is still ≥ 10 chars. Defense in depth.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session

from app.models.decision import ALLOWED_TRANSITIONS, Decision, DecisionState
from app.models.event import EventType
from app.models.user import User
from app.schemas.decision import MIN_RATIONALE_LENGTH
from app.utils.events import log_event

logger = logging.getLogger(__name__)


_STATE_TO_EVENT: dict[DecisionState, EventType] = {
    DecisionState.PROPOSED: EventType.DECISION_PROPOSED,
    DecisionState.ACCEPTED: EventType.DECISION_ACCEPTED,
    DecisionState.REJECTED: EventType.DECISION_REJECTED,
    DecisionState.SUPERSEDED: EventType.DECISION_SUPERSEDED,
}


def transition_decision(
    decision: Decision, target: DecisionState, current_user: User, session: Session
) -> Decision:
    """Validate + apply a state transition. Raises 400 on illegal transitions."""

    allowed = ALLOWED_TRANSITIONS.get(decision.state, set())
    if target not in allowed:
        allowed_list = sorted(s.value for s in allowed) if allowed else []
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_transition",
                "message": (
                    f"Cannot transition from {decision.state.value} to {target.value}. "
                    f"Allowed targets: {allowed_list if allowed_list else 'none (terminal state)'}"
                ),
            },
        )

    # Defence in depth: re-check rationale on ACCEPTED. Even if the row was
    # somehow mutated to a bad rationale, we refuse to bless it.
    if target == DecisionState.ACCEPTED:
        if len(decision.rationale.strip()) < MIN_RATIONALE_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "mandatory_rationale_violated",
                    "message": "Cannot accept a Decision whose rationale is below the minimum length",
                },
            )

    now = datetime.now(timezone.utc)
    decision.state = target
    decision.updated_at = now
    if target == DecisionState.ACCEPTED:
        decision.accepted_at = now
        decision.accepted_by_id = current_user.id

    session.add(decision)
    session.flush()

    event_type = _STATE_TO_EVENT.get(target, EventType.DECISION_SUPERSEDED)
    log_event(
        session,
        event_type=event_type,
        actor_id=current_user.id,
        subject_id=decision.id,
        payload={
            "decision_id": decision.id,
            "part_id": decision.part_id,
            "from_state": decision.state.value if target == decision.state else decision.state.value,
            "to_state": target.value,
        },
    )
    session.commit()
    session.refresh(decision)
    return decision
