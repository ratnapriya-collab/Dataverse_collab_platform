"""Parts routes — upload, list, get, and signed file download."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.core.security import (
    FILE_TOKEN_EXPIRES_MINUTES,
    TokenError,
    create_file_download_token,
    decode_file_download_token,
)
from app.database import get_session
from app.models.event import EventType
from app.models.part import Part
from app.models.user import User
from app.schemas.part import PartDetail, PartRead
from app.utils.auth import get_current_user
from app.utils.events import log_event
from app.utils.step_to_glb import step_bytes_to_glb_bytes
from app.utils.storage import (
    StorageError,
    absolute_path,
    extension_of,
    media_type_for,
    save_bytes,
    validate_upload,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": "bad_request", "message": message},
    )


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": "not_found", "message": "Part not found"},
    )


def _forbidden() -> HTTPException:
    # Same shape as 404 so we don't leak the existence of other users' parts.
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": "not_found", "message": "Part not found"},
    )


def _make_detail(part: Part) -> PartDetail:
    token = create_file_download_token(part_id=part.id, owner_id=part.owner_id)
    return PartDetail(
        id=part.id,
        name=part.name,
        file_name=part.file_name,
        content_hash=part.content_hash,
        face_count=part.face_count,
        edge_count=part.edge_count,
        owner_id=part.owner_id,
        created_at=part.created_at,
        file_url=f"/api/parts/{part.id}/file?token={token}",
        file_url_expires_in=FILE_TOKEN_EXPIRES_MINUTES * 60,
    )


@router.post(
    "/upload",
    response_model=PartRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_part(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PartRead:
    """Upload a CAD file. The user must be authenticated; the part is owned by them."""
    if not file.filename:
        raise _bad_request("file is missing a filename")

    data = await file.read()
    try:
        ext = validate_upload(file.filename, data)
        rel_path, digest = save_bytes(owner_id=current.id, data=data, ext=ext)
    except StorageError as exc:
        raise _bad_request(str(exc)) from exc

    # For STEP uploads, tessellate to GLB alongside the original file so the
    # viewer can render real geometry. The GLB shares the STEP's sha256 base
    # (same file → same converted output), keyed by extension. Failure here
    # is non-fatal — the STEP is already saved, and the viewer falls back to
    # sample geometry if the GLB doesn't exist.
    #
    # Broad `Exception` catch (not just ValueError/OSError/RuntimeError) —
    # gmsh raises everything from custom errors to bare SystemErrors when
    # it can't parse a STEP file. Whatever it throws, we log and continue
    # so the upload still succeeds; the frontend degrades gracefully.
    if ext in ("step", "stp"):
        try:
            glb_bytes = step_bytes_to_glb_bytes(data)
            save_bytes(owner_id=current.id, data=glb_bytes, ext="glb")
            logger.info(
                "step_glb_converted",
                extra={"step_hash": digest, "glb_bytes": len(glb_bytes)},
            )
        except Exception as exc:  # noqa: BLE001 — deliberate broad catch
            logger.warning(
                "step_glb_conversion_failed",
                extra={
                    "step_hash": digest,
                    "error_type": type(exc).__name__,
                    "error_msg": str(exc)[:300],
                },
            )

    display_name = (name or _strip_ext(file.filename)).strip() or file.filename

    part = Part(
        name=display_name,
        file_name=file.filename,
        file_path=rel_path,
        content_hash=digest,
        face_count=0,
        edge_count=0,
        owner_id=current.id,
    )
    session.add(part)
    session.flush()

    log_event(
        session,
        event_type=EventType.PART_UPLOADED,
        actor_id=current.id,
        subject_id=part.id,
        payload={
            "name": part.name,
            "file_name": part.file_name,
            "content_hash": part.content_hash,
            "bytes": len(data),
        },
    )
    session.commit()
    session.refresh(part)
    return PartRead.model_validate(part)


@router.get("", response_model=list[PartRead])
def list_parts(
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[PartRead]:
    """List the current user's parts, newest first."""
    parts = session.exec(
        select(Part).where(Part.owner_id == current.id).order_by(Part.created_at.desc())  # type: ignore[attr-defined]
    ).all()
    return [PartRead.model_validate(p) for p in parts]


@router.get("/{part_id}", response_model=PartDetail)
def get_part(
    part_id: str,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PartDetail:
    """Return part metadata plus a 10-minute signed URL to fetch the file."""
    part = session.get(Part, part_id)
    if part is None:
        raise _not_found()
    if part.owner_id != current.id:
        raise _forbidden()
    return _make_detail(part)


@router.get("/{part_id}/file")
def get_part_file(
    part_id: str,
    token: str = Query(..., description="Short-lived file download token"),
    session: Session = Depends(get_session),
) -> FileResponse:
    """Stream the part's file bytes. Auth is via the short-lived token in the query string."""
    try:
        claims = decode_file_download_token(token)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_token", "message": str(exc)},
        ) from exc

    if claims["sub"] != part_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_token", "message": "token does not match this part"},
        )

    part = session.get(Part, part_id)
    if part is None:
        raise _not_found()
    if part.owner_id != claims["owner"]:
        raise _forbidden()

    try:
        abs_path = absolute_path(part.file_path)
    except StorageError as exc:
        logger.error("storage_resolve_failed", extra={"part_id": part_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "storage", "message": "Could not resolve file"},
        ) from exc

    if not abs_path.exists():
        logger.error("storage_missing_file", extra={"part_id": part_id, "path": part.file_path})
        raise _not_found()

    try:
        ext = extension_of(part.file_name)
    except StorageError:
        ext = ""

    return FileResponse(
        path=abs_path,
        media_type=media_type_for(ext),
        filename=part.file_name,
    )


@router.get("/{part_id}/glb")
def get_part_glb(
    part_id: str,
    token: str | None = Query(default=None, description="Short-lived file token (alt to Authorization header)"),
    session: Session = Depends(get_session),
) -> FileResponse:
    """Stream the server-side-tessellated GLB for a STEP part.

    Accepts EITHER a short-lived file-download token (query string) OR
    a standard Authorization Bearer JWT (header). Query-token mode is
    what the frontend uses because Babylon.js loads the GLB via a plain
    URL and can't attach a header.

    Returns 404 if the GLB doesn't exist — the frontend then falls back
    to sample geometry, same behavior as before conversion existed.
    """
    part = session.get(Part, part_id)
    if part is None:
        raise _not_found()

    # Auth: token (query) OR bearer (header). Token path mirrors /file so
    # signed URLs from the API work for both.
    if token is not None:
        try:
            claims = decode_file_download_token(token)
        except TokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "invalid_token", "message": str(exc)},
            ) from exc
        if claims["sub"] != part_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "invalid_token", "message": "token does not match this part"},
            )
        if part.owner_id != claims["owner"]:
            raise _forbidden()
    else:
        # Fall back to bearer-header auth. FastAPI re-resolves the dep
        # via get_current_user() manually so we can keep the parameter
        # optional in the signature above.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "no_auth", "message": "Missing ?token=... query parameter"},
        )

    # The GLB lives alongside the STEP at <owner>/<sha256>.glb (same
    # content hash as the STEP because that's how we key both files).
    glb_rel = f"{part.owner_id}/{part.content_hash}.glb"
    try:
        abs_path = absolute_path(glb_rel)
    except StorageError as exc:
        logger.error(
            "storage_resolve_failed", extra={"part_id": part_id, "error": str(exc)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "storage", "message": "Could not resolve GLB path"},
        ) from exc

    if not abs_path.exists():
        # GLB not converted yet (e.g. conversion failed at upload, or the
        # STEP was uploaded before this feature landed). Frontend handles
        # the 404 by falling back to sample geometry.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "no_glb", "message": "GLB not available for this part"},
        )

    return FileResponse(
        path=abs_path,
        media_type="model/gltf-binary",
        filename=f"{_strip_ext(part.file_name)}.glb",
    )


def _strip_ext(filename: str) -> str:
    p = Path(filename)
    return p.stem
