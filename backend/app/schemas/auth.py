"""Auth response schemas."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.user import UserRead


class TokenResponse(BaseModel):
    """Response body for POST /api/auth/login."""

    access_token: str
    token_type: str = "bearer"
    user: UserRead
