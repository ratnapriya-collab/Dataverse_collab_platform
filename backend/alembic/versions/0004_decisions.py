"""decisions — anchored rationales with an FSM

Revision ID: 0004_decisions
Revises: 0003_anchors
Create Date: 2026-05-14
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_decisions"
down_revision: str | None = "0003_anchors"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "part_id",
            sa.String(length=36),
            sa.ForeignKey("parts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "anchor_id",
            sa.String(length=36),
            sa.ForeignKey("anchors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("state", sa.String(length=16), nullable=False, server_default="PROPOSED"),
        sa.Column("rationale", sa.String(length=4000), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "accepted_by_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decisions_part_id", "decisions", ["part_id"])
    op.create_index("ix_decisions_anchor_id", "decisions", ["anchor_id"])
    op.create_index("ix_decisions_author_id", "decisions", ["author_id"])
    op.create_index("ix_decisions_part_state", "decisions", ["part_id", "state"])


def downgrade() -> None:
    op.drop_index("ix_decisions_part_state", table_name="decisions")
    op.drop_index("ix_decisions_author_id", table_name="decisions")
    op.drop_index("ix_decisions_anchor_id", table_name="decisions")
    op.drop_index("ix_decisions_part_id", table_name="decisions")
    op.drop_table("decisions")
