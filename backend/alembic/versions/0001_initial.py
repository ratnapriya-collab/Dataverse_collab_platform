"""initial — users + events

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-13
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False, server_default="REVIEWER"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("subject_id", sa.String(length=36), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_events_type", "events", ["type"])
    op.create_index("ix_events_actor_id", "events", ["actor_id"])
    op.create_index("ix_events_subject_id", "events", ["subject_id"])
    op.create_index("ix_events_created_at", "events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_events_created_at", table_name="events")
    op.drop_index("ix_events_subject_id", table_name="events")
    op.drop_index("ix_events_actor_id", table_name="events")
    op.drop_index("ix_events_type", table_name="events")
    op.drop_table("events")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
