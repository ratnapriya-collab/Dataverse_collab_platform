"""threads + replies — v2 commenting system

Revision ID: 0005_threads
Revises: 0004_decisions
Create Date: 2026-05-29

Threads = anchor + meta (status, priority, assignee, tags). Replies are
separate rows so editing one reply doesn't churn the thread row. All
datetime columns are timezone-aware (timestamptz on Postgres).

JSONB columns on Postgres (JSON on SQLite) for mentions[] · reactions[]
· tags[] — flexible shape without per-change migrations.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_threads"
down_revision: str | None = "0004_decisions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "threads",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "part_id",
            sa.String(length=36),
            sa.ForeignKey("parts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("face_uuid", sa.String(length=64), nullable=False),
        sa.Column("centroid_x", sa.Float(), nullable=False),
        sa.Column("centroid_y", sa.Float(), nullable=False),
        sa.Column("centroid_z", sa.Float(), nullable=False),
        sa.Column("root_reply_id", sa.String(length=36), nullable=True),
        sa.Column(
            "author_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(length=20), nullable=True),
        sa.Column(
            "assignee_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("reply_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_reply_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "resolved_by_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_threads_part_status", "threads", ["part_id", "status"])
    op.create_index("ix_threads_last_reply", "threads", ["part_id", "last_reply_at"])
    op.create_index("ix_threads_face_uuid", "threads", ["face_uuid"])
    op.create_index("ix_threads_author_id", "threads", ["author_id"])

    op.create_table(
        "replies",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "thread_id",
            sa.String(length=36),
            sa.ForeignKey("threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("mentions", sa.JSON(), nullable=False),
        sa.Column("reactions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_replies_thread_created", "replies", ["thread_id", "created_at"])
    op.create_index("ix_replies_author_id", "replies", ["author_id"])


def downgrade() -> None:
    op.drop_index("ix_replies_author_id", table_name="replies")
    op.drop_index("ix_replies_thread_created", table_name="replies")
    op.drop_table("replies")
    op.drop_index("ix_threads_author_id", table_name="threads")
    op.drop_index("ix_threads_face_uuid", table_name="threads")
    op.drop_index("ix_threads_last_reply", table_name="threads")
    op.drop_index("ix_threads_part_status", table_name="threads")
    op.drop_table("threads")
