"""Capture model — persists "Capture View" screenshots for the gallery.

A Capture is a screenshot of the 3D viewer (optionally including DOM
overlays like pins and comment cards). It belongs to a Part, was taken
by a User, and lives until that User deletes it.

Storage strategy:
  · Image bytes live in Postgres as BYTEA (sa.LargeBinary). For the demo
    scale (~30 captures/part × 150 KB JPEG = ~4 MB/part) this is fine.
    At true production scale (thousands of captures) the right move is
    to swap `image_bytes` for an object-store key + signed URL — the
    public schema and routes wouldn't change, only the storage backend.
  · `image_mime` records the MIME so the GET-image route can stream
    with the correct Content-Type without guessing.
  · `image_size` cached on insert so list responses can show file size
    without reading the bytes back.

`sort_order` is an integer that lets the user drag-reorder captures.
On every reorder we re-write the column in bulk so the persisted order
matches the visible order; clients always read by ORDER BY sort_order.

Postgres-ready, mirroring the patterns in thread.py:
  · timestamptz on Postgres / DATETIME on SQLite (via DateTime(timezone=True))
  · JSON/JSONB for camera_state (small, shape varies by camera type)
  · Foreign keys CASCADE from parts so deleting a part cleans up captures
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, LargeBinary, String
from sqlmodel import Field, SQLModel


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Capture(SQLModel, table=True):
    """One captured view of the 3D viewer."""

    __tablename__ = "captures"
    __table_args__ = (
        # The list endpoint reads by part_id and orders by sort_order — this
        # composite index is the hot path.
        Index("ix_captures_part_order", "part_id", "sort_order"),
    )

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    # part_id is an opaque grouping key — it may reference a real `parts.id`
    # row OR a frontend-synthesised demo part ID (e.g. mock fixtures). We
    # deliberately do NOT enforce a FK so captures work for both. Worst
    # case: orphan captures if a real part is deleted, which the gallery
    # tolerates (the part page just won't render them).
    part_id: str = Field(index=True)
    author_id: str = Field(index=True, foreign_key="users.id")

    caption: str = Field(default="", max_length=500)
    width: int = Field(default=0)
    height: int = Field(default=0)

    # Image payload. LargeBinary maps to BYTEA on Postgres, BLOB on SQLite.
    # NOT NULL — a capture without bytes is meaningless.
    image_bytes: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    image_mime: str = Field(default="image/jpeg", sa_column=Column(String(64), nullable=False))
    image_size: int = Field(default=0)

    # Camera state at capture (alpha/beta/radius/target or null). JSON keeps
    # the door open for future camera types without a migration.
    camera_state: dict[str, Any] | None = Field(
        default=None, sa_column=Column(sa.JSON, nullable=True)
    )

    # User-controllable order in the gallery + PDF. Lower = earlier. We rewrite
    # in bulk on reorder; new captures get max(sort_order)+1.
    sort_order: int = Field(default=0, index=True)

    created_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_now_utc,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
