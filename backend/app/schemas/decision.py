"""Pydantic schemas for the Decision resource.

ARCHITECTURAL NON-NEGOTIABLE #1: the rationale gate. Pydantic enforces
min_length=10 AND the handler re-validates after stripping whitespace.
Defense in depth — never trust the client.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.decision import DecisionState

MIN_RATIONALE_LENGTH = 10
MAX_RATIONALE_LENGTH = 4000


class DecisionCreate(BaseModel):
    """Body for POST /api/decisions."""

    part_id: str = Field(min_length=1)
    anchor_id: str = Field(min_length=1)
    rationale: str = Field(min_length=MIN_RATIONALE_LENGTH, max_length=MAX_RATIONALE_LENGTH)

    @field_validator("rationale")
    @classmethod
    def _strip_and_check(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < MIN_RATIONALE_LENGTH:
            raise ValueError(
                f"rationale must be at least {MIN_RATIONALE_LENGTH} characters after trimming whitespace",
            )
        return stripped


class DecisionTransition(BaseModel):
    """Body for PATCH /api/decisions/{id}/transition."""

    model_config = ConfigDict(use_enum_values=False)

    to: DecisionState


class DecisionAuthor(BaseModel):
    """Nested author info for DecisionRead."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str


class DecisionAnchor(BaseModel):
    """Nested anchor info for DecisionRead."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    face_uuid: str
    centroid: dict[str, float]


class DecisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    part_id: str
    anchor_id: str
    author_id: str
    state: DecisionState
    rationale: str
    accepted_at: datetime | None
    accepted_by_id: str | None
    created_at: datetime
    updated_at: datetime
    # Joined for convenience — the panel UI uses these directly.
    author: DecisionAuthor | None = None
    anchor: DecisionAnchor | None = None


class RationaleSuggestion(BaseModel):
    """Mocked Datum response. Templates with optional placeholders filled in."""

    suggestion: str


class RationaleSuggestRequest(BaseModel):
    part_name: str | None = None
    anchor_id: str | None = None
