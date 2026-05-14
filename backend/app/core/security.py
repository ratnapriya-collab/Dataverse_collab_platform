"""Password hashing (bcrypt) and JWT encode/decode."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        return _pwd_context.verify(plain, hashed)
    except ValueError:
        return False


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """Encode a JWT with the given subject (user id) and optional extra claims."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.jwt_expires_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class TokenError(Exception):
    """Raised when a JWT cannot be decoded or is invalid."""


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode a JWT and return its claims, or raise TokenError."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc


# ── Short-lived file-download tokens ──────────────────────────────────────────
#
# Babylon's SceneLoader fetches files via a URL, not headers, so we can't pass
# the user's session bearer in the Authorization header. Instead the file route
# accepts a short-lived (10 min) JWT in the `?token=` query param. The token is
# scoped to a single part + owner — even if it leaks, the blast radius is one
# file for ten minutes.

FILE_TOKEN_SCOPE = "file_download"
FILE_TOKEN_EXPIRES_MINUTES = 10


def create_file_download_token(part_id: str, owner_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=FILE_TOKEN_EXPIRES_MINUTES)
    payload: dict[str, Any] = {
        "sub": part_id,
        "owner": owner_id,
        "scope": FILE_TOKEN_SCOPE,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_file_download_token(token: str) -> dict[str, Any]:
    """Decode and validate a file-download token. Raises TokenError on any failure."""
    claims = decode_access_token(token)
    if claims.get("scope") != FILE_TOKEN_SCOPE:
        raise TokenError("token is not scoped for file download")
    if not isinstance(claims.get("sub"), str) or not isinstance(claims.get("owner"), str):
        raise TokenError("token missing sub or owner claim")
    return claims
