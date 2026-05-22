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
    """Datum AI · Hook 1 · Draft Rationale response (matches spec §6).

    `suggestion` is kept for backward-compat with the original Day 6 client.
    All other fields are required by the spec — Phase 1 fills them with
    mocked-but-grounded values so the contract is frozen for the Ollama swap.
    """

    suggestion: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.82)
    citations: list[str] = Field(default_factory=list)
    source: str = "mocked-fallback"
    declined: bool = False
    declined_reason: str | None = None


class RationaleSuggestRequest(BaseModel):
    part_name: str | None = None
    anchor_id: str | None = None


# ── Hook 2: Summarize Thread ────────────────────────────────────────────────
# Pydantic contract matches the Datum AI module architecture spec (§6).
# Phase 1 mocked: the handler returns a canned response that still respects
# the schema. Phase 2 swap is handler internals only — schema is frozen.


class SummarizeThreadRequest(BaseModel):
    """Request to summarize a comment thread on a decision/part."""

    thread_id: str = Field(min_length=1)
    part_name: str | None = None
    decision_ids: list[str] = Field(default_factory=list)


class SummarizeThreadResponse(BaseModel):
    """Datum's executive summary of a thread."""

    summary: str = Field(min_length=20, max_length=800)
    key_concerns: list[str]
    recommended_action: str
    confidence: float = Field(ge=0.0, le=1.0)
    citations: list[str] = Field(default_factory=list)
    source: str = "mocked-fallback"
    declined: bool = False
    declined_reason: str | None = None


# ── Hook 4: Flag Regressions ────────────────────────────────────────────────


class FlagRegressionsRequest(BaseModel):
    """Run Datum across a new revision and ask for flagged regressions."""

    rev_snapshot_id: str = Field(min_length=1)
    part_id: str | None = None


class FlaggedRegression(BaseModel):
    """A single decision Datum thinks likely regressed in the new revision."""

    decision_id: str
    likelihood: float = Field(ge=0.0, le=1.0)
    reasoning: str
    suggested_action: str  # "urgent_review" | "verify_anchor" | "no_action"


class FlagRegressionsResponse(BaseModel):
    """Result of a flag-regressions sweep."""

    flagged: list[FlaggedRegression]
    scanned_count: int
    runtime_ms: int
    source: str = "mocked-fallback"


# ── Hook 3: Screen Boundary ─────────────────────────────────────────────────


class ScreenBoundaryRequest(BaseModel):
    """Ask Datum which decisions to redact for a partner viewer."""

    thread_id: str = Field(min_length=1)
    viewer_role: str = "partner"  # 'admin' | 'oem' | 'partner'
    decision_ids: list[str] = Field(default_factory=list)


class ScreenBoundaryResponse(BaseModel):
    """List of redacted decision IDs plus the reason category for each.

    redaction_reasons keys must be subset of redacted_comment_ids.
    safe_summary is what the partner sees in place of the hidden content.
    """

    redacted_comment_ids: list[str]
    redaction_reasons: dict[str, str]
    safe_summary: str | None = None
    source: str = "mocked-fallback"
