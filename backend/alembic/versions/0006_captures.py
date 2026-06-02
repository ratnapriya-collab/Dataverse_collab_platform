"""captures — Capture View gallery, persistent screenshots per part

Revision ID: 0006_captures
Revises: 0005_threads
Create Date: 2026-06-01

A Capture is a screenshot of the 3D viewer (optionally compositing in
DOM overlays). Bytes live in BYTEA on Postgres / BLOB on SQLite. Each
capture has a user-controlled sort_order so drag-reorder in the gallery
survives reloads.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_captures"
down_revision: str | None = "0005_threads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "captures",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "part_id",
            sa.String(length=36),
            sa.ForeignKey("parts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("caption", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("width", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("height", sa.Integer(), nullable=False, server_default="0"),
        # BYTEA on Postgres, BLOB on SQLite.
        sa.Column("image_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("image_mime", sa.String(length=64), nullable=False, server_default="image/jpeg"),
        sa.Column("image_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("camera_state", sa.JSON(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Hot-path: list captures for a part in display order.
    op.create_index("ix_captures_part_order", "captures", ["part_id", "sort_order"])
    op.create_index("ix_captures_part_id", "captures", ["part_id"])
    op.create_index("ix_captures_author_id", "captures", ["author_id"])


def downgrade() -> None:
    op.drop_index("ix_captures_author_id", table_name="captures")
    op.drop_index("ix_captures_part_id", table_name="captures")
    op.drop_index("ix_captures_part_order", table_name="captures")
    op.drop_table("captures")
