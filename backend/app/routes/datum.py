"""Datum AI module — mocked Phase 1 handlers.

Implements the Datum AI architecture spec (M8, §6). Phase 1 is mocked: every
handler returns a canned response that respects the Pydantic contract exactly.
Phase 2 swap (post-demo) replaces handler internals with a local Ollama call;
the schema is frozen now so the swap is internal only.

Hooks shipped in this file:
    · Hook 1 · POST /api/datum/suggest-rationale  — draft rationale (legacy alias)
    · Hook 2 · POST /api/datum/summarize-thread   — executive thread summary
"""

from __future__ import annotations

import random
import time

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.models.event import EventType
from app.models.user import User
from app.schemas.decision import (
    FlaggedRegression,
    FlagRegressionsRequest,
    FlagRegressionsResponse,
    RationaleSuggestion,
    RationaleSuggestRequest,
    ScreenBoundaryRequest,
    ScreenBoundaryResponse,
    SummarizeDocumentRequest,
    SummarizeDocumentResponse,
    SummarizeThreadRequest,
    SummarizeThreadResponse,
)
from app.utils.auth import get_current_user
from app.utils.events import log_event

router = APIRouter()


def _audit_datum_call(
    session: Session,
    *,
    hook: str,
    actor_id: str,
    subject_id: str | None,
    request_payload: dict,
    response_payload: dict,
    confidence: float,
    latency_ms: int,
    source: str,
    declined: bool,
) -> None:
    """Rule #6 of the Datum AI spec: every Datum call writes a DATUM_CALLED event.

    Payload follows the architecture doc exactly:
      { hook, input, output, confidence, latency_ms, source, declined }.
    Caller still owns the commit so the audit row is durable.
    """
    log_event(
        session,
        event_type=EventType.DATUM_CALLED,
        actor_id=actor_id,
        subject_id=subject_id,
        payload={
            "hook": hook,
            "input": request_payload,
            "output": response_payload,
            "confidence": confidence,
            "latency_ms": latency_ms,
            "source": source,
            "declined": declined,
        },
    )
    session.commit()


_TEMPLATES = [
    "Wall thickness at this face is below the 2.0 mm minimum specified in the design brief. Consider rib reinforcement or material substitution.",
    "Surface roughness at {part_name} appears inconsistent with the Ra 1.6 µm spec. Confirm machining process and toolpath strategy.",
    "Geometric tolerance on this feature is tighter than necessary for the assembly tolerance stack. Loosening this could reduce inspection cost.",
]


@router.post("/suggest-rationale", response_model=RationaleSuggestion)
def suggest_rationale(
    body: RationaleSuggestRequest,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RationaleSuggestion:
    """Hook 1 · Draft Rationale (mocked). Always auth-gated."""
    started = time.perf_counter()
    template = random.choice(_TEMPLATES)
    suggestion = template.format(part_name=body.part_name or "this part")
    # Citations: the mock templates each cite a real standard string from
    # SEED_FULL_DECISIONS so the UI's citation chips have something to render.
    citations = ["AS9100 §6.4.3"] if "AS9100" in template or "thickness" in template else []
    response = RationaleSuggestion(
        suggestion=suggestion,
        confidence=0.82,
        citations=citations,
        source="mocked-fallback",
        declined=False,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)
    _audit_datum_call(
        session,
        hook="suggest-rationale",
        actor_id=current.id,
        subject_id=body.anchor_id,
        request_payload=body.model_dump(),
        response_payload=response.model_dump(),
        confidence=response.confidence,
        latency_ms=latency_ms,
        source=response.source,
        declined=response.declined,
    )
    return response


# ── Hook 2: Summarize Thread ────────────────────────────────────────────────


_SUMMARY_TEMPLATES = [
    {
        "summary": (
            "The thread on {part_name} centres on a wall-thickness flag at face Z3. "
            "Two reviewers asked whether the 1.6 mm reading meets AS9100 §6.4.3; the "
            "owner committed to a follow-up FEA before signoff. A separate concern "
            "about surface roughness on the inlet flange was tabled — verbal "
            "agreement to tighten Ra from 3.2 µm to 1.6 µm per the gasket vendor's "
            "datasheet."
        ),
        "key_concerns": [
            "Wall thickness 1.6 mm < 2.0 mm minimum spec (face Z3)",
            "Surface roughness on inlet flange not matched to gasket vendor datasheet",
            "FEA justification missing per AS9100 §6.4.3",
        ],
        "recommended_action": (
            "Hold the supplier signoff until the FEA at face Z3 is attached. "
            "Update the inlet-flange callout to Ra 1.6 µm before pushing to PLM."
        ),
        "confidence": 0.84,
    },
    {
        "summary": (
            "Thread converges on a tolerance question: the bolt hole pattern on "
            "{part_name} is offset 0.3 mm vs. drawing. Supplier flags this as a "
            "tolerance-stack issue against the mating boss. Reviewer agrees the "
            "offset must be either intentional and documented or reverted to "
            "nominal before PLM push."
        ),
        "key_concerns": [
            "Bolt hole pattern offset 0.3 mm vs. drawing",
            "Tolerance stack against mating boss not documented",
            "ASME Y14.5 §1.4 reference cited but not resolved",
        ],
        "recommended_action": (
            "Confirm intent of the 0.3 mm offset with design; otherwise revert to "
            "nominal and re-run the stack-up check. Block PLM push until resolved."
        ),
        "confidence": 0.78,
    },
]


@router.post("/summarize-thread", response_model=SummarizeThreadResponse)
def summarize_thread(
    body: SummarizeThreadRequest,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SummarizeThreadResponse:
    """Hook 2 · Summarize Thread (mocked).

    Returns an executive summary + key_concerns + recommended_action. Citations
    reference the actual decision IDs passed in the request, so the response
    feels grounded even though the LLM call is stubbed.
    """
    started = time.perf_counter()
    template = random.choice(_SUMMARY_TEMPLATES)
    part_name = body.part_name or "this part"
    citations = body.decision_ids[:3] if body.decision_ids else ["AS9100 §6.4.3"]
    response = SummarizeThreadResponse(
        summary=template["summary"].format(part_name=part_name),
        key_concerns=template["key_concerns"],
        recommended_action=template["recommended_action"],
        confidence=template["confidence"],
        citations=citations,
        source="mocked-fallback",
        declined=False,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)
    _audit_datum_call(
        session,
        hook="summarize-thread",
        actor_id=current.id,
        subject_id=body.thread_id,
        request_payload=body.model_dump(),
        response_payload=response.model_dump(),
        confidence=response.confidence,
        latency_ms=latency_ms,
        source=response.source,
        declined=response.declined,
    )
    return response


# ── Hook 4: Flag Regressions ────────────────────────────────────────────────


# Canned flag set — each entry references the resolver buckets surfaced in
# SEED_RESOLVER_RESULT.regressed so the demo lines up. Real Phase 2 will
# generate these via Ollama after the resolver runs.
_REGRESSION_TEMPLATES = [
    {
        "decision_id": "DEC-BRACKET-09",
        "likelihood": 0.91,
        "reasoning": (
            "Bolt hole pattern offset 0.3 mm vs. drawing in Rev B — the same anchor "
            "Sarah flagged on Rev A. Tolerance stack against the mating boss is "
            "unresolved and the new geometry widens the offset by ~0.05 mm."
        ),
        "suggested_action": "urgent_review",
    },
    {
        "decision_id": "DEC-BRACKET-12",
        "likelihood": 0.74,
        "reasoning": (
            "Fillet radius at the inner web reduced from 2.5 mm to 1.8 mm. Prior "
            "decision recommended ≥ 2.0 mm to clear stress concentration per "
            "AS9100 §6.4.3."
        ),
        "suggested_action": "verify_anchor",
    },
    {
        "decision_id": "DEC-BRACKET-15",
        "likelihood": 0.63,
        "reasoning": (
            "Surface-finish callout dropped from the Rev B drawing. The original "
            "decision tightened roughness to Ra 1.6 µm for gasket sealing."
        ),
        "suggested_action": "verify_anchor",
    },
]


@router.post("/flag-regressions", response_model=FlagRegressionsResponse)
def flag_regressions(
    body: FlagRegressionsRequest,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FlagRegressionsResponse:
    """Hook 4 · Flag Regressions (mocked).

    Scans a fresh RevSnapshot and surfaces decisions Datum thinks likely
    regressed. Phase 1 returns a fixed-but-grounded set; Phase 2 runs after
    the cross-rev resolver completes and feeds Ollama with the diff.
    """
    started = time.perf_counter()
    flagged = [FlaggedRegression(**t) for t in _REGRESSION_TEMPLATES]
    runtime_ms = int((time.perf_counter() - started) * 1000)
    response = FlagRegressionsResponse(
        flagged=flagged,
        scanned_count=len(flagged) + 9,  # also "scanned" 9 non-flagged decisions
        runtime_ms=runtime_ms,
        source="mocked-fallback",
    )
    _audit_datum_call(
        session,
        hook="flag-regressions",
        actor_id=current.id,
        subject_id=body.rev_snapshot_id,
        request_payload=body.model_dump(),
        response_payload=response.model_dump(),
        confidence=max((f.likelihood for f in flagged), default=0.0),
        latency_ms=runtime_ms,
        source=response.source,
        declined=False,
    )
    return response


# ── Hook 3: Screen Boundary ────────────────────────────────────────────────


# Three redaction reason categories from the spec (matches the existing
# partner-view client heuristic so admin debug "Show what's hidden" stays
# consistent across the two surfaces).
_REDACTION_REASONS = ["internal-flag", "cost-keyword", "admin-only-thread"]


@router.post("/screen-boundary", response_model=ScreenBoundaryResponse)
def screen_boundary(
    body: ScreenBoundaryRequest,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScreenBoundaryResponse:
    """Hook 3 · Screen Boundary (mocked).

    Decides which decisions to redact for a partner viewer. Admin role
    sees everything; partner/oem roles get a deterministic subset
    redacted with a stable reason category per ID.

    Phase 2 will replace the deterministic mod-3 selection with a real
    LLM call that classifies each comment by content sensitivity.
    """
    started = time.perf_counter()

    if body.viewer_role == "admin":
        response = ScreenBoundaryResponse(
            redacted_comment_ids=[],
            redaction_reasons={},
            safe_summary=None,
        )
    else:
        redacted: list[str] = []
        reasons: dict[str, str] = {}
        for decision_id in body.decision_ids:
            digest = sum(ord(c) for c in decision_id)
            # Roughly 33% get redacted — deterministic across reloads.
            if digest % 3 == 0:
                redacted.append(decision_id)
                reasons[decision_id] = _REDACTION_REASONS[digest % 3]
        count = len(redacted)
        if count == 0:
            safe_summary = None
        else:
            safe_summary = (
                f"{count} comment{'s' if count != 1 else ''} hidden from {body.viewer_role} "
                f"view by Datum — internal review notes, cost-sensitive content, or "
                f"admin-only threads."
            )
        response = ScreenBoundaryResponse(
            redacted_comment_ids=redacted,
            redaction_reasons=reasons,
            safe_summary=safe_summary,
        )

    latency_ms = int((time.perf_counter() - started) * 1000)
    _audit_datum_call(
        session,
        hook="screen-boundary",
        actor_id=current.id,
        subject_id=body.thread_id,
        request_payload=body.model_dump(),
        response_payload=response.model_dump(),
        # Confidence is high for admin (nothing to redact) and 0.78 mocked
        # for partner/oem so the spec's "every output has a confidence" rule
        # is satisfied. Phase 2 will compute this from the LLM classifier.
        confidence=1.0 if body.viewer_role == "admin" else 0.78,
        latency_ms=latency_ms,
        source=response.source,
        declined=False,
    )
    return response


# ── Hook 6: Summarize Document ─────────────────────────────────────────────


# Templates keyed off length buckets — chooses a different "shape" of summary
# so demos vary by document size. Phase 2 will swap for a real Ollama call
# that streams the doc through llama3.1:8b.
_DOC_SUMMARY_TEMPLATES = [
    {
        "summary": (
            "{title} centres on the geometry, material spec, and tolerance "
            "decisions for the {part_name} build. The author walks through "
            "the as-designed values, calls out the open risks, and proposes "
            "tightening three callouts before supplier release."
        ),
        "key_points": [
            "Wall thickness minimum tightened from 1.6 mm → 2.0 mm per AS9100 §6.4.3",
            "Surface roughness on the inlet flange held to Ra 1.6 µm for gasket sealing",
            "Bolt-hole tolerance widened to ±0.1 mm to absorb supplier stack",
            "Material spec: 6061-T6 confirmed by metallurgy review",
        ],
        "action_items": [
            "Run FEA validation on the revised wall section by EOD Friday",
            "Update drawing DRW-TURBO-V3-A2 with the new flange callout",
            "Loop supplier into the tolerance discussion before sign-off",
        ],
        "confidence": 0.84,
    },
    {
        "summary": (
            "{title} is a design-review note covering the {part_name}. The "
            "doc reads as a chronological log: starting from the CFD output, "
            "moving through the tolerance stack, and closing on supplier "
            "constraints. Two items remain unresolved."
        ),
        "key_points": [
            "CFD shows 4.1 kPa pressure drop at peak flow — within target",
            "Tolerance stack-up clears assembly with 0.05 mm margin",
            "Supplier draft-angle minimum is 3° (current geometry: 1.5°)",
        ],
        "action_items": [
            "Modify rib draft to 3° before re-quoting",
            "Confirm cold-soak thermal behavior with one more FEA cycle",
        ],
        "confidence": 0.79,
    },
]


@router.post("/summarize-document", response_model=SummarizeDocumentResponse)
def summarize_document(
    body: SummarizeDocumentRequest,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SummarizeDocumentResponse:
    """Hook 6 · Summarize Document (mocked).

    Reads the doc body, picks a canned summary template, fills in the part
    + title, and returns it. Length buckets choose different templates so a
    short doc and a long doc don't feel identical in the demo.
    """
    started = time.perf_counter()

    word_count_in = len(body.body.split())

    if word_count_in < 5:
        response = SummarizeDocumentResponse(
            summary="There isn't enough content yet to summarise. Write a paragraph or two and try again.",
            key_points=[],
            action_items=[],
            word_count_in=word_count_in,
            word_count_out=0,
            confidence=0.0,
            source="mocked-fallback",
            declined=True,
            declined_reason="Document body has fewer than 5 words.",
        )
    else:
        template = _DOC_SUMMARY_TEMPLATES[0] if word_count_in > 60 else _DOC_SUMMARY_TEMPLATES[1]
        title = body.document_title or "This document"
        part_name = body.part_name or "the current part"
        summary_text = template["summary"].format(title=title, part_name=part_name)
        response = SummarizeDocumentResponse(
            summary=summary_text,
            key_points=template["key_points"],
            action_items=template["action_items"],
            word_count_in=word_count_in,
            word_count_out=len(summary_text.split()),
            confidence=template["confidence"],
            source="mocked-fallback",
            declined=False,
        )

    latency_ms = int((time.perf_counter() - started) * 1000)
    _audit_datum_call(
        session,
        hook="summarize-document",
        actor_id=current.id,
        subject_id=body.document_id,
        request_payload={
            "document_id": body.document_id,
            "document_title": body.document_title,
            "word_count": word_count_in,
        },
        response_payload=response.model_dump(),
        confidence=response.confidence,
        latency_ms=latency_ms,
        source=response.source,
        declined=response.declined,
    )
    return response
