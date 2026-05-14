"""File storage abstraction.

Day 3 uses the local filesystem under ./uploads. The interface intentionally
mirrors S3 / MinIO so we can swap implementations later without touching
the routes layer.

Files are content-addressed: `uploads/<owner_id>/<sha256><ext>`. This gives us
free deduplication and makes it impossible to overwrite someone else's content.
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# Resolve to backend/uploads at import time so it's stable across CWD changes.
UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"

ALLOWED_EXTENSIONS = {"step", "stp", "glb", "gltf"}
MAX_FILE_BYTES = 50 * 1024 * 1024  # 50 MB


class StorageError(Exception):
    """Raised when a storage operation fails for a known reason."""


def extension_of(filename: str) -> str:
    """Lowercase extension without the dot. Raises StorageError if missing."""
    if "." not in filename:
        raise StorageError("filename has no extension")
    return filename.rsplit(".", 1)[1].lower()


def validate_upload(filename: str, data: bytes) -> str:
    """Reject anything that isn't a supported CAD file. Returns the extension."""
    if len(data) == 0:
        raise StorageError("file is empty")
    if len(data) > MAX_FILE_BYTES:
        raise StorageError(f"file exceeds {MAX_FILE_BYTES // (1024 * 1024)} MB limit")

    ext = extension_of(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise StorageError(
            f"unsupported extension '.{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
        )

    # Magic-byte sanity check — cheap defence against renamed garbage.
    if ext in ("step", "stp"):
        # STEP files are text starting with the ISO header (sometimes with a UTF-8 BOM).
        head = data[:64].lstrip(b"\xef\xbb\xbf").lstrip()
        if not head.startswith(b"ISO-10303-21"):
            raise StorageError("STEP file missing 'ISO-10303-21' header")
    elif ext == "glb":
        if not data.startswith(b"glTF"):
            raise StorageError("GLB file missing 'glTF' magic")
    elif ext == "gltf":
        # GLTF is JSON. Cheap check: starts with '{'.
        if not data.lstrip().startswith(b"{"):
            raise StorageError("GLTF file does not look like JSON")

    return ext


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_bytes(owner_id: str, data: bytes, ext: str) -> tuple[str, str]:
    """Write `data` to a content-addressed path. Returns (relative_path, sha256)."""
    digest = compute_sha256(data)
    owner_dir = UPLOAD_ROOT / owner_id
    owner_dir.mkdir(parents=True, exist_ok=True)

    rel_path = f"{owner_id}/{digest}.{ext}"
    abs_path = UPLOAD_ROOT / rel_path

    if abs_path.exists():
        logger.info("storage_dedup_hit", extra={"path": rel_path})
        return rel_path, digest

    # Write to a temp file then rename to avoid half-written files on crash.
    tmp_path = abs_path.with_suffix(abs_path.suffix + ".tmp")
    try:
        with tmp_path.open("wb") as f:
            f.write(data)
        os.replace(tmp_path, abs_path)
    except OSError as exc:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
        raise StorageError(f"failed to write file: {exc}") from exc

    logger.info("storage_saved", extra={"path": rel_path, "bytes": len(data)})
    return rel_path, digest


def absolute_path(relative_path: str) -> Path:
    """Resolve a stored relative path back to an absolute disk path."""
    abs_path = (UPLOAD_ROOT / relative_path).resolve()
    # Defence in depth: refuse to traverse out of UPLOAD_ROOT even if the DB
    # has been tampered with.
    if UPLOAD_ROOT.resolve() not in abs_path.parents and abs_path != UPLOAD_ROOT.resolve():
        raise StorageError("resolved path escapes upload root")
    return abs_path


def media_type_for(ext: str) -> str:
    return {
        "glb": "model/gltf-binary",
        "gltf": "model/gltf+json",
        "step": "model/step",
        "stp": "model/step",
    }.get(ext, "application/octet-stream")
