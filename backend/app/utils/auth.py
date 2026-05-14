"""FastAPI dependency that resolves the current authenticated user from a Bearer token."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.core.security import TokenError, decode_access_token
from app.database import get_session
from app.models.user import User

# auto_error=False lets us emit our own 401 shape instead of FastAPI's default.
_bearer = HTTPBearer(auto_error=False)


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": "unauthorized", "message": message},
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> User:
    """Resolve the user identified by the request's Bearer token.

    Raises 401 if missing, malformed, expired, or pointing at a deleted user.
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorized("missing bearer token")
    try:
        claims = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise _unauthorized(f"invalid token: {exc}") from exc

    user_id = claims.get("sub")
    if not isinstance(user_id, str):
        raise _unauthorized("invalid token: missing sub claim")

    user = session.get(User, user_id)
    if user is None:
        raise _unauthorized("user no longer exists")
    return user
