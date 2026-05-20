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
    RationaleSuggestion,
    RationaleSuggestRequest,
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
    latency_ms = int((time.perf_counter() - started) * 1000)
    _audit_datum_call(
        session,
        hook="suggest-rationale",
        actor_id=current.id,
        subject_id=body.anchor_id,
        request_payload=body.model_dump(),
        response_payload={"suggestion": suggestion},
        confidence=0.82,
        latency_ms=latency_ms,
        source="mocked-fallback",
        declined=False,
    )
    return RationaleSuggestion(suggestion=suggestion)


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
