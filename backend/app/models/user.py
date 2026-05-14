"""User model — authenticated identity in the system."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    """Persona-level role. Real 3-layer RBAC is post-MVP."""

    REVIEWER = "REVIEWER"
    ENGINEER = "ENGINEER"
    ADMIN = "ADMIN"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    email: str = Field(index=True, unique=True, max_length=254)
    password_hash: str = Field(max_length=255)
    name: str = Field(max_length=120)
    role: UserRole = Field(default=UserRole.REVIEWER)
    created_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
