# DataVerse Collab — Backend

FastAPI + SQLModel + Postgres + Alembic + pytest.

## Local setup

```bash
# From the repo root, start Postgres + MinIO
docker compose up -d

cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Copy env template and fill in a real JWT secret
copy .env.example .env       # or:  cp .env.example .env
# Generate a secret:
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Apply migrations
alembic upgrade head

# Run tests (uses isolated in-memory SQLite — no real DB needed)
pytest

# Serve
uvicorn app.main:app --reload --port 4000
```

## Endpoints (Day 1)

| Method | Path                 | Auth | Description                       |
|--------|----------------------|------|-----------------------------------|
| GET    | `/health`            | no   | Liveness + DB connectivity probe  |
| POST   | `/api/auth/register` | no   | Create an account                 |
| POST   | `/api/auth/login`    | no   | Exchange credentials for a JWT    |
| GET    | `/api/auth/me`       | yes  | Return the current user           |

OpenAPI docs: http://localhost:4000/docs

## Conventions

- Pydantic v2 schemas for every request and response. No raw dicts cross the wire.
- `Depends(get_current_user)` on every non-public route.
- Every state-changing handler calls `log_event(...)` exactly once.
- Errors via `raise HTTPException(status_code=..., detail={"error": code, "message": "..."})`.
- Structured logs: `logger.info("event_name", extra={"key": value})`.

## Migrations

```bash
# Create a new revision
alembic revision -m "your message" --autogenerate

# Apply
alembic upgrade head

# Roll back one step
alembic downgrade -1
```

## Deploy (Render)

1. Create a Web Service from this repo, root = `backend/`.
2. Use the Dockerfile (Render auto-detects).
3. Add a managed Postgres add-on (or use Neon free tier — paste the `postgresql://...` URL).
4. Set env vars:
   - `DATABASE_URL` — use the `postgresql+psycopg2://` form.
   - `JWT_SECRET` — long random string (NOT the placeholder from `.env.example`).
   - `FRONTEND_ORIGINS` — your Vercel URL, e.g. `https://dataverse-collab.vercel.app`.
   - `ENV=production`.

Migrations run automatically at container startup (`alembic upgrade head` in the CMD).
