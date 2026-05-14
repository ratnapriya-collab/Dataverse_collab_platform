"""Pydantic schemas for the Anchor resource."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.anchor import AnchorKind


class CentroidIn(BaseModel):
    """A 3D point in the part's local coordinate system."""

    x: float
    y: float
    z: float


class AnchorCreate(BaseModel):
    """Body for POST /api/anchors.

    `face_uuid` MUST be the topology-hash UUID computed on the client by
    lib/geomHash.ts. We treat it as a stable identifier — same face produces
    the same UUID across re-uploads. The UNIQUE INDEX (part_id, face_uuid)
    makes repeat picks safe.
    """

    part_id: str = Field(min_length=1)
    face_uuid: str = Field(min_length=8, max_length=64)
    kind: AnchorKind = AnchorKind.FACE
    centroid: CentroidIn


class AnchorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    part_id: str
    face_uuid: str
    kind: AnchorKind
    centroid: dict[str, float]
    created_by: str
    created_at: datetime

    @field_validator("centroid", mode="before")
    @classmethod
    def _coerce_centroid(cls, v: dict[str, float] | None) -> dict[str, float]:
        # Postgres JSONB returns dicts directly; SQLite returns the same.
        # If centroid is missing (legacy rows), default to origin.
        if not v:
            return {"x": 0.0, "y": 0.0, "z": 0.0}
        return v
