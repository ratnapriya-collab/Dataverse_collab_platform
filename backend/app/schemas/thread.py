"""Pydantic schemas for the Thread + Reply API.

Contract mirrors the frontend's features/comments/types/thread.types.ts so
the swap from localStorage → REST is purely a hook-layer change.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.thread import ThreadPriority, ThreadStatus


# ── Reply ──────────────────────────────────────────────────────────────────


class ReplyCreate(BaseModel):
    """Body for POST /api/threads/{thread_id}/replies."""

    body: str = Field(min_length=1, max_length=8000)
    mentions: list[dict[str, Any]] = Field(default_factory=list)


class ReplyEdit(BaseModel):
    """Body for PATCH /api/replies/{id}."""

    body: str = Field(min_length=1, max_length=8000)
    mentions: list[dict[str, Any]] = Field(default_factory=list)


class ReactionToggle(BaseModel):
    """Body for POST /api/replies/{id}/reactions."""

    emoji: str = Field(min_length=1, max_length=20)


class ReplyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    thread_id: str
    author_id: str
    body: str
    mentions: list[dict[str, Any]]
    reactions: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


# ── Thread ─────────────────────────────────────────────────────────────────


class Centroid(BaseModel):
    x: float
    y: float
    z: float


class ThreadCreate(BaseModel):
    """Body for POST /api/threads — creates a thread AND its root reply atomically."""

    part_id: str = Field(min_length=1)
    face_uuid: str = Field(min_length=1)
    centroid: Centroid
    title: str = Field(min_length=1, max_length=300)
    root_body: str = Field(min_length=1, max_length=8000)
    priority: ThreadPriority | None = None
    tags: list[str] = Field(default_factory=list)


class ThreadPatch(BaseModel):
    """Body for PATCH /api/threads/{id} — update status, priority, assignee, tags."""

    status: ThreadStatus | None = None
    priority: ThreadPriority | None = None
    assignee_id: str | None = None
    tags: list[str] | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)


class ThreadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    part_id: str
    face_uuid: str
    centroid_x: float
    centroid_y: float
    centroid_z: float
    root_reply_id: str | None
    author_id: str
    title: str
    status: ThreadStatus
    priority: ThreadPriority | None
    assignee_id: str | None
    tags: list[str]
    reply_count: int
    last_reply_at: datetime
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    resolved_by_id: str | None


class ThreadListResponse(BaseModel):
    threads: list[ThreadRead]
    total: int
