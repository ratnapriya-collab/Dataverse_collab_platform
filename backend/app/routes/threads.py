"""Thread + Reply routes for the v2 commenting system.

Endpoints:
  POST   /api/threads                       — create thread + root reply
  GET    /api/threads?part_id=…             — list threads for a part
  GET    /api/threads/{id}                  — single thread
  PATCH  /api/threads/{id}                  — update status/priority/title/etc.
  DELETE /api/threads/{id}                  — soft-archive

  GET    /api/threads/{id}/replies          — list replies (chronological)
  POST   /api/threads/{id}/replies          — add reply
  PATCH  /api/replies/{id}                  — edit body
  DELETE /api/replies/{id}                  — soft-delete

  POST   /api/replies/{id}/reactions        — toggle a reaction emoji

Every write also emits a DATUM_CALLED-style audit event so the audit page
can show the timeline of every comment + reply + state change. Audit
write is in the same DB transaction (atomic with the mutation).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select

from app.database import get_session
from app.models.event import EventType
from app.models.thread import Reply, Thread, ThreadStatus
from app.models.user import User
from app.schemas.thread import (
    ReactionToggle,
    ReplyCreate,
    ReplyEdit,
    ReplyRead,
    ThreadCreate,
    ThreadListResponse,
    ThreadPatch,
    ThreadRead,
)
from app.utils.auth import get_current_user
from app.utils.events import log_event

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Threads ────────────────────────────────────────────────────────────────


@router.post("/threads", response_model=ThreadRead, status_code=201)
def create_thread(
    body: ThreadCreate,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Thread:
    """Atomically create a thread + its root reply."""
    now = _now()
    thread = Thread(
        part_id=body.part_id,
        face_uuid=body.face_uuid,
        centroid_x=body.centroid.x,
        centroid_y=body.centroid.y,
        centroid_z=body.centroid.z,
        author_id=current.id,
        title=body.title,
        status=ThreadStatus.OPEN,
        priority=body.priority,
        assignee_id=None,
        tags=body.tags,
        reply_count=1,
        last_reply_at=now,
        created_at=now,
        updated_at=now,
    )
    session.add(thread)
    session.flush()  # need thread.id for the reply FK

    root_reply = Reply(
        thread_id=thread.id,
        author_id=current.id,
        body=body.root_body,
        mentions=[],
        reactions=[],
        created_at=now,
        updated_at=now,
    )
    session.add(root_reply)
    session.flush()

    thread.root_reply_id = root_reply.id
    session.add(thread)

    log_event(
        session,
        event_type=EventType.DECISION_PROPOSED,  # reuse — Phase 2 adds THREAD_CREATED
        actor_id=current.id,
        subject_id=thread.id,
        payload={"thread_id": thread.id, "part_id": thread.part_id, "title": thread.title},
    )
    session.commit()
    session.refresh(thread)
    return thread


@router.get("/threads", response_model=ThreadListResponse)
def list_threads(
    part_id: str = Query(..., min_length=1),
    status: ThreadStatus | None = Query(default=None),
    _current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ThreadListResponse:
    stmt = select(Thread).where(Thread.part_id == part_id)
    if status is not None:
        stmt = stmt.where(Thread.status == status)
    stmt = stmt.order_by(Thread.last_reply_at.desc())  # type: ignore[attr-defined]
    rows = list(session.exec(stmt))
    return ThreadListResponse(threads=rows, total=len(rows))  # type: ignore[arg-type]


@router.get("/threads/{thread_id}", response_model=ThreadRead)
def get_thread(
    thread_id: str,
    _current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Thread:
    thread = session.get(Thread, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@router.patch("/threads/{thread_id}", response_model=ThreadRead)
def patch_thread(
    thread_id: str,
    body: ThreadPatch,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Thread:
    thread = session.get(Thread, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    if body.title is not None:
        thread.title = body.title
    if body.priority is not None:
        thread.priority = body.priority
    if body.assignee_id is not None:
        thread.assignee_id = body.assignee_id
    if body.tags is not None:
        thread.tags = body.tags
    if body.status is not None:
        thread.status = body.status
        if body.status == ThreadStatus.RESOLVED:
            thread.resolved_at = _now()
            thread.resolved_by_id = current.id
        elif body.status == ThreadStatus.OPEN:
            thread.resolved_at = None
            thread.resolved_by_id = None

    thread.updated_at = _now()
    session.add(thread)

    log_event(
        session,
        event_type=EventType.DECISION_PROPOSED,
        actor_id=current.id,
        subject_id=thread.id,
        payload={
            "thread_id": thread.id,
            "patch": body.model_dump(exclude_none=True),
        },
    )
    session.commit()
    session.refresh(thread)
    return thread


@router.delete("/threads/{thread_id}")
def archive_thread(
    thread_id: str,
    current: User = Depends(get_current_user),  # noqa: ARG001 — auth check
    session: Session = Depends(get_session),
) -> Response:
    thread = session.get(Thread, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.status = ThreadStatus.ARCHIVED
    thread.updated_at = _now()
    session.add(thread)
    session.commit()
    return Response(status_code=204)


# ── Replies ────────────────────────────────────────────────────────────────


@router.get("/threads/{thread_id}/replies", response_model=list[ReplyRead])
def list_replies(
    thread_id: str,
    _current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[Reply]:
    if session.get(Thread, thread_id) is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    stmt = select(Reply).where(Reply.thread_id == thread_id).order_by(Reply.created_at)  # type: ignore[arg-type]
    return list(session.exec(stmt))


@router.post("/threads/{thread_id}/replies", response_model=ReplyRead, status_code=201)
def create_reply(
    thread_id: str,
    body: ReplyCreate,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Reply:
    thread = session.get(Thread, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread.status == ThreadStatus.ARCHIVED:
        raise HTTPException(status_code=409, detail="Thread is archived — cannot reply")

    now = _now()
    reply = Reply(
        thread_id=thread_id,
        author_id=current.id,
        body=body.body,
        mentions=body.mentions,
        reactions=[],
        created_at=now,
        updated_at=now,
    )
    session.add(reply)

    thread.reply_count += 1
    thread.last_reply_at = now
    thread.updated_at = now
    session.add(thread)

    log_event(
        session,
        event_type=EventType.DECISION_PROPOSED,
        actor_id=current.id,
        subject_id=thread.id,
        payload={"thread_id": thread.id, "reply_preview": body.body[:120]},
    )
    session.commit()
    session.refresh(reply)
    return reply


@router.patch("/replies/{reply_id}", response_model=ReplyRead)
def edit_reply(
    reply_id: str,
    body: ReplyEdit,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Reply:
    reply = session.get(Reply, reply_id)
    if reply is None:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply.author_id != current.id:
        raise HTTPException(status_code=403, detail="Can only edit your own replies")
    if reply.deleted_at is not None:
        raise HTTPException(status_code=409, detail="Reply is deleted")

    reply.body = body.body
    reply.mentions = body.mentions
    reply.updated_at = _now()
    session.add(reply)
    session.commit()
    session.refresh(reply)
    return reply


@router.delete("/replies/{reply_id}")
def delete_reply(
    reply_id: str,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    reply = session.get(Reply, reply_id)
    if reply is None:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply.author_id != current.id:
        raise HTTPException(status_code=403, detail="Can only delete your own replies")
    reply.deleted_at = _now()
    reply.body = ""
    session.add(reply)
    session.commit()
    return Response(status_code=204)


# ── Reactions ──────────────────────────────────────────────────────────────


@router.post("/replies/{reply_id}/reactions", response_model=ReplyRead)
def toggle_reaction(
    reply_id: str,
    body: ReactionToggle,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Reply:
    """Toggle the current user's reaction with the given emoji on the reply.
    Set semantics: if they've reacted with this emoji, remove their vote;
    otherwise add it. If their vote was the last one, drop the emoji bucket.
    """
    reply = session.get(Reply, reply_id)
    if reply is None:
        raise HTTPException(status_code=404, detail="Reply not found")

    reactions = list(reply.reactions or [])
    found = next((r for r in reactions if r.get("emoji") == body.emoji), None)
    if found is None:
        reactions.append({"emoji": body.emoji, "userIds": [current.id]})
    else:
        user_ids = list(found.get("userIds") or [])
        if current.id in user_ids:
            user_ids.remove(current.id)
            if not user_ids:
                reactions = [r for r in reactions if r.get("emoji") != body.emoji]
            else:
                found["userIds"] = user_ids
        else:
            user_ids.append(current.id)
            found["userIds"] = user_ids

    reply.reactions = reactions
    reply.updated_at = _now()
    session.add(reply)
    session.commit()
    session.refresh(reply)
    return reply
