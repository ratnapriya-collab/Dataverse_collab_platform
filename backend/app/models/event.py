"""Event model — append-only audit log foundation.

Every state change in the system writes a row here via `log_event()`.
Hash-chaining is post-MVP; for now we keep it append-only with timestamps.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


class EventType(str, Enum):
    USER_REGISTERED = "USER_REGISTERED"
    USER_LOGGED_IN = "USER_LOGGED_IN"
    PART_UPLOADED = "PART_UPLOADED"
    ANCHOR_CREATED = "ANCHOR_CREATED"
    # One event per state transition — used by the audit feed to reconstruct
    # the timeline of every decision.
    DECISION_PROPOSED = "DECISION_PROPOSED"
    DECISION_ACCEPTED = "DECISION_ACCEPTED"
    DECISION_REJECTED = "DECISION_REJECTED"
    DECISION_SUPERSEDED = "DECISION_SUPERSEDED"
    # Datum AI (M8). Rule #6: every Datum invocation MUST be audited.
    # Payload carries { hook, input, output, confidence, latency_ms, source }
    # so reviewers can trace every AI suggestion that ever influenced a decision.
    DATUM_CALLED = "DATUM_CALLED"


class Event(SQLModel, table=True):
    __tablename__ = "events"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    type: EventType = Field(index=True)
    actor_id: str | None = Field(default=None, index=True)
    subject_id: str | None = Field(default=None, index=True)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
