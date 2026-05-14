"""Anchor model — a face-pick persisted to a Part.

ARCHITECTURAL NON-NEGOTIABLE #2: face_uuid is the stable topology hash from
the frontend's lib/geomHash.ts — derived from centroid + normal + area +
triangle count rounded to 1 µm. Re-uploading the same STEP file produces the
same face_uuid for the same physical face. The UNIQUE INDEX (part_id, face_uuid)
makes the POST endpoint naturally idempotent.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


class AnchorKind(str, Enum):
    FACE = "FACE"
    EDGE = "EDGE"
    VERTEX = "VERTEX"


class Anchor(SQLModel, table=True):
    __tablename__ = "anchors"
    __table_args__ = (UniqueConstraint("part_id", "face_uuid", name="uq_anchors_part_face"),)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    part_id: str = Field(index=True, foreign_key="parts.id")
    face_uuid: str = Field(index=True, max_length=64)
    kind: AnchorKind = Field(default=AnchorKind.FACE)
    centroid: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_by: str = Field(index=True, foreign_key="users.id")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
