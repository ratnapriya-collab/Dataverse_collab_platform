"""anchors — face picks persisted to a part

Revision ID: 0003_anchors
Revises: 0002_parts
Create Date: 2026-05-14
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_anchors"
down_revision: str | None = "0002_parts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "anchors",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "part_id",
            sa.String(length=36),
            sa.ForeignKey("parts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("face_uuid", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="FACE"),
        sa.Column("centroid", sa.JSON(), nullable=False),
        sa.Column(
            "created_by",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("part_id", "face_uuid", name="uq_anchors_part_face"),
    )
    op.create_index("ix_anchors_part_id", "anchors", ["part_id"])
    op.create_index("ix_anchors_face_uuid", "anchors", ["face_uuid"])
    op.create_index("ix_anchors_created_by", "anchors", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_anchors_created_by", table_name="anchors")
    op.drop_index("ix_anchors_face_uuid", table_name="anchors")
    op.drop_index("ix_anchors_part_id", table_name="anchors")
    op.drop_table("anchors")
