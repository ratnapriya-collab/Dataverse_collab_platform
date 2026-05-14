"""Pydantic schemas for the Part resource."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PartRead(BaseModel):
    """Full part view returned by upload, get, and list."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    file_name: str
    content_hash: str
    face_count: int
    edge_count: int
    owner_id: str
    created_at: datetime


class PartDetail(PartRead):
    """Part view plus a short-lived signed URL to download the file."""

    file_url: str
    file_url_expires_in: int  # seconds
