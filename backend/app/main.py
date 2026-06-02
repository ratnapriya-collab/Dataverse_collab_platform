"""FastAPI entrypoint — lifespan, CORS, routers, /health."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlmodel import Session

from app.config import get_settings
from app.database import engine
from app.routes import anchors as anchors_routes
from app.routes import auth as auth_routes
from app.routes import captures as captures_routes
from app.routes import datum as datum_routes
from app.routes import decisions as decisions_routes
from app.routes import parts as parts_routes
from app.routes import threads as threads_routes

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """App-level startup/shutdown."""
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format='{"level":"%(levelname)s","name":"%(name)s","msg":"%(message)s"}',
    )
    logger.info("startup", extra={"app": settings.app_name, "env": settings.env})
    # Alembic is the sole schema authority — do NOT call init_db() here.
    # Auto-create-all collides with migration history on every model addition.
    # If migrations haven't run, the /health probe will surface a DB error.
    yield
    logger.info("shutdown")


def create_app() -> FastAPI:
    """Build the FastAPI app. Factory pattern keeps tests clean."""
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
    app.include_router(parts_routes.router, prefix="/api/parts", tags=["parts"])
    app.include_router(anchors_routes.router, prefix="/api/anchors", tags=["anchors"])
    app.include_router(decisions_routes.router, prefix="/api/decisions", tags=["decisions"])
    app.include_router(datum_routes.router, prefix="/api/datum", tags=["datum"])
    # Mounted at /api so threads.py's paths read /api/threads, /api/replies/...
    app.include_router(threads_routes.router, prefix="/api", tags=["threads"])
    # Mounted at /api — captures.py uses /parts/{id}/captures and /captures/{id}/image,
    # which become /api/parts/{id}/captures and /api/captures/{id}/image.
    app.include_router(captures_routes.router, prefix="/api", tags=["captures"])

    @app.get("/health")
    def health() -> dict[str, object]:
        """Liveness + DB connectivity probe."""
        db_ok = False
        try:
            with Session(engine) as session:
                session.exec(text("SELECT 1"))  # type: ignore[arg-type]
                db_ok = True
        except Exception as exc:  # noqa: BLE001
            logger.error("health_db_check_failed", extra={"error": str(exc)})
        return {"status": "ok", "db_connected": db_ok}

    return app


app = create_app()
