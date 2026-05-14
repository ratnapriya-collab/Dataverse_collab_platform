"""Authentication routes — register, login, and current-user echo.

Every state-changing handler emits an Event via log_event().
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_session
from app.models.event import EventType
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate, UserLogin, UserRead
from app.utils.auth import get_current_user
from app.utils.events import log_event

logger = logging.getLogger(__name__)
router = APIRouter()


def _conflict(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"error": "conflict", "message": message},
    )


def _bad_credentials() -> HTTPException:
    # Intentionally vague — never reveal whether the email exists.
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": "invalid_credentials", "message": "Invalid email or password"},
    )


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def register(body: UserCreate, session: Session = Depends(get_session)) -> UserRead:
    """Create a new user account."""
    existing = session.exec(select(User).where(User.email == body.email.lower())).first()
    if existing is not None:
        raise _conflict("Email already registered")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        name=body.name.strip(),
    )
    session.add(user)
    session.flush()  # populate user.id before we log the event

    log_event(
        session,
        event_type=EventType.USER_REGISTERED,
        actor_id=user.id,
        subject_id=user.id,
        payload={"email": user.email, "name": user.name},
    )
    session.commit()
    session.refresh(user)
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, session: Session = Depends(get_session)) -> TokenResponse:
    """Verify credentials and issue a JWT."""
    user = session.exec(select(User).where(User.email == body.email.lower())).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise _bad_credentials()

    token = create_access_token(subject=user.id, extra_claims={"email": user.email})

    log_event(
        session,
        event_type=EventType.USER_LOGGED_IN,
        actor_id=user.id,
        subject_id=user.id,
        payload={"email": user.email},
    )
    session.commit()
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(current: User = Depends(get_current_user)) -> UserRead:
    """Return the currently authenticated user."""
    return UserRead.model_validate(current)
