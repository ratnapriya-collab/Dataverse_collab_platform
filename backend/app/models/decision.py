"""Decision model — the rationale-anchored opinion at the heart of the system.

ARCHITECTURAL NON-NEGOTIABLE #1: a Decision cannot exist without a rationale
≥ 10 characters. The Pydantic schema and the handler both enforce this — two
layers of defense. The DB column is also NOT NULL.

State machine:
    DRAFT      → PROPOSED
    PROPOSED   → ACCEPTED | REJECTED
    ACCEPTED   → SUPERSEDED
    REJECTED   → (terminal)
    SUPERSEDED → (terminal)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel


class DecisionState(str, Enum):
    DRAFT = "DRAFT"
    PROPOSED = "PROPOSED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    SUPERSEDED = "SUPERSEDED"


# Single source of truth for valid transitions. Used by transition_decision
# and surfaced in error messages so the client knows what's allowed.
ALLOWED_TRANSITIONS: dict[DecisionState, set[DecisionState]] = {
    DecisionState.DRAFT: {DecisionState.PROPOSED},
    DecisionState.PROPOSED: {DecisionState.ACCEPTED, DecisionState.REJECTED},
    DecisionState.ACCEPTED: {DecisionState.SUPERSEDED},
    DecisionState.REJECTED: set(),
    DecisionState.SUPERSEDED: set(),
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Decision(SQLModel, table=True):
    __tablename__ = "decisions"
    __table_args__ = (Index("ix_decisions_part_state", "part_id", "state"),)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    part_id: str = Field(index=True, foreign_key="parts.id")
    anchor_id: str = Field(index=True, foreign_key="anchors.id")
    author_id: str = Field(index=True, foreign_key="users.id")
    state: DecisionState = Field(default=DecisionState.PROPOSED)
    rationale: str = Field(min_length=10, max_length=4000)
    accepted_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    accepted_by_id: str | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
