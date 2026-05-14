"""Part model — stub for Day 3. Table not created until the Day 3 migration."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel


class Part(SQLModel, table=True):
    __tablename__ = "parts"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(max_length=255)
    file_name: str = Field(max_length=255)
    file_path: str = Field(max_length=1024)
    content_hash: str = Field(max_length=128, index=True)
    face_count: int = Field(default=0)
    edge_count: int = Field(default=0)
    owner_id: str = Field(index=True, foreign_key="users.id")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
