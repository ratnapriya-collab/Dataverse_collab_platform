"""Pydantic schemas for User-shaped requests and responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole

# bcrypt has a 72-byte input cap. Capping passwords at 64 chars keeps us well clear
# and avoids the silent-truncation footgun.
MIN_PASSWORD_LEN = 8
MAX_PASSWORD_LEN = 64


class UserCreate(BaseModel):
    """Body for POST /api/auth/register."""

    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LEN, max_length=MAX_PASSWORD_LEN)
    name: str = Field(min_length=1, max_length=120)


class UserLogin(BaseModel):
    """Body for POST /api/auth/login."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LEN)


class UserRead(BaseModel):
    """Public user view — never leaks password_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    name: str
    role: UserRole
    created_at: datetime
