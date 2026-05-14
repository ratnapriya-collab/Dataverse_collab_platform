"""log_event — the single funnel every state mutation must go through.

ARCHITECTURAL NON-NEGOTIABLE #3: every state change writes an event.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlmodel import Session

from app.models.event import Event, EventType

logger = logging.getLogger(__name__)


def log_event(
    session: Session,
    *,
    event_type: EventType,
    actor_id: str | None = None,
    subject_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Event:
    """Persist an audit event. Caller is responsible for the surrounding commit."""
    event = Event(
        type=event_type,
        actor_id=actor_id,
        subject_id=subject_id,
        payload=payload or {},
    )
    session.add(event)
    session.flush()
    logger.info(
        "event_logged",
        extra={
            "event_id": event.id,
            "type": event_type.value,
            "actor_id": actor_id,
            "subject_id": subject_id,
        },
    )
    return event
