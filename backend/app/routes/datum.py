"""Datum mock — stubbed rationale suggestions.

NOT a real LLM. Picks from three hardcoded templates so the Day 6 UI has
something to render against. Real Datum integration is post-MVP.
"""

from __future__ import annotations

import random

from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.decision import RationaleSuggestion, RationaleSuggestRequest
from app.utils.auth import get_current_user

router = APIRouter()


_TEMPLATES = [
    "Wall thickness at this face is below the 2.0 mm minimum specified in the design brief. Consider rib reinforcement or material substitution.",
    "Surface roughness at {part_name} appears inconsistent with the Ra 1.6 µm spec. Confirm machining process and toolpath strategy.",
    "Geometric tolerance on this feature is tighter than necessary for the assembly tolerance stack. Loosening this could reduce inspection cost.",
]


@router.post("/suggest-rationale", response_model=RationaleSuggestion)
def suggest_rationale(
    body: RationaleSuggestRequest,
    _current: User = Depends(get_current_user),
) -> RationaleSuggestion:
    """Return a plausible-sounding rationale suggestion. Stub. Always auth-gated."""
    template = random.choice(_TEMPLATES)
    suggestion = template.format(part_name=body.part_name or "this part")
    return RationaleSuggestion(suggestion=suggestion)
