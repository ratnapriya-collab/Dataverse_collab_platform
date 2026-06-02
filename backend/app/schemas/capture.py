"""Pydantic schemas for the Capture API.

Contract mirrors the frontend's features/capture/types/capture.types.ts.
Notably: `image_url` is server-built (route URL pointing at the bytes
endpoint), not stored. The frontend fetches that URL with auth and
creates a blob URL — keeps Bearer auth working with <img src>.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CaptureUpdate(BaseModel):
    """Body for PATCH /api/captures/{id}. All fields optional."""

    caption: str | None = Field(default=None, max_length=500)


class CaptureReorder(BaseModel):
    """Body for POST /api/parts/{part_id}/captures/reorder.

    `ordered_ids` is the new full order — every existing capture for the
    part must appear exactly once. The server validates the set matches
    what's persisted before doing the bulk update.
    """

    ordered_ids: list[str] = Field(min_length=1)


class CaptureRead(BaseModel):
    """Server → client capture metadata. Bytes are NOT included here;
    the client follows `image_url` to fetch them with auth."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    part_id: str
    author_id: str
    caption: str
    width: int
    height: int
    image_url: str
    image_mime: str
    image_size: int
    camera_state: dict[str, Any] | None
    sort_order: int
    created_at: datetime
    updated_at: datetime
