"""SQLModel table classes. Importing this module registers all tables."""

from app.models.anchor import Anchor, AnchorKind
from app.models.capture import Capture
from app.models.decision import ALLOWED_TRANSITIONS, Decision, DecisionState
from app.models.event import Event, EventType
from app.models.part import Part
from app.models.thread import Reply, Thread, ThreadPriority, ThreadStatus
from app.models.user import User, UserRole

__all__ = [
    "ALLOWED_TRANSITIONS",
    "Anchor",
    "AnchorKind",
    "Capture",
    "Decision",
    "DecisionState",
    "Event",
    "EventType",
    "Part",
    "Reply",
    "Thread",
    "ThreadPriority",
    "ThreadStatus",
    "User",
    "UserRole",
]
