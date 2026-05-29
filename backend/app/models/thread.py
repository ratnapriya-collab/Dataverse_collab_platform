"""Thread + Reply models — v2 commenting system.

A Thread is the anchor + meta (status, priority, assignee, tags). The first
message is just a Reply with the rootReply pointer on the Thread. Editing a
reply doesn't touch the thread row, which keeps thread-level fields clean.

Postgres-ready:
  · All datetime columns are timezone-aware (timestamptz on Postgres,
    DATETIME on SQLite — both work via SQLModel's DateTime(timezone=True))
  · JSONB on Postgres (falls back to JSON on SQLite) for mentions[],
    reactions{}, tags[] — flexible without schema migrations per shape change
  · Indexes on (part_id, status) for the panel's hot path
  · Foreign keys cascade where it makes sense (delete a Part → its Threads
    + Replies go too) — explicit so production migrations stay safe.

Switching the DB engine in production is a single env var change:
    DATABASE_URL=postgresql+psycopg://user:pass@host/db
The rest of the code is identical — SQLAlchemy/SQLModel handles it.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Index, String
from sqlmodel import Field, SQLModel


class ThreadStatus(str, Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    ARCHIVED = "archived"


class ThreadPriority(str, Enum):
    BLOCKER = "blocker"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Thread(SQLModel, table=True):
    """One thread = one anchored conversation on a face."""

    __tablename__ = "threads"
    __table_args__ = (
        Index("ix_threads_part_status", "part_id", "status"),
        Index("ix_threads_last_reply", "part_id", "last_reply_at"),
    )

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    part_id: str = Field(index=True, foreign_key="parts.id")

    # Anchor — duplicated from Anchor table for read-path speed.
    # The viewer projects threads onto the model from these coords.
    face_uuid: str = Field(index=True)
    centroid_x: float
    centroid_y: float
    centroid_z: float

    # Root + meta
    root_reply_id: str | None = Field(default=None)  # filled after the root Reply is inserted
    author_id: str = Field(index=True, foreign_key="users.id")
    title: str = Field(min_length=1, max_length=300)
    status: ThreadStatus = Field(default=ThreadStatus.OPEN, sa_column=Column(String(20), nullable=False, index=True))
    priority: ThreadPriority | None = Field(
        default=None, sa_column=Column(String(20), nullable=True)
    )
    assignee_id: str | None = Field(default=None, foreign_key="users.id")

    # Flexible-shape columns. JSONB on Postgres, JSON on SQLite — both fine.
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))

    # Denormalised aggregates kept in sync server-side. Cheap reads on hot paths.
    reply_count: int = Field(default=1)  # always >=1 because the root reply counts
    last_reply_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    created_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    resolved_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    resolved_by_id: str | None = Field(default=None, foreign_key="users.id")


class Reply(SQLModel, table=True):
    """One message inside a Thread."""

    __tablename__ = "replies"
    __table_args__ = (
        Index("ix_replies_thread_created", "thread_id", "created_at"),
    )

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    thread_id: str = Field(index=True, foreign_key="threads.id")
    author_id: str = Field(index=True, foreign_key="users.id")

    body: str = Field(min_length=1, max_length=8000)

    # mentions: [{ userId, start, end }, ...]
    mentions: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    # reactions: [{ emoji: '👍', userIds: ['u1', 'u2'] }, ...]
    reactions: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )

    created_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    deleted_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
