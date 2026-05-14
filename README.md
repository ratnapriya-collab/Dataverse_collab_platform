# DataVerse Collab

CAD/engineering collaboration platform. Vertical MVP slice.

> **Repo visibility**: keep this repository **private**. The 3D viewer module bundled here is proprietary and must not leak.

## Day 1 status

- Backend: FastAPI + Postgres + JWT auth + Alembic + tests
- Frontend: Next.js 14 + Tailwind + login / register / home
- Local infra: Postgres + MinIO via Docker Compose

## Quick start

```bash
# 1. Local services
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env             # or: cp .env.example .env
alembic upgrade head
pytest                              # all green
uvicorn app.main:app --reload --port 4000

# 3. Frontend (new terminal)
cd frontend
npm install
copy .env.local.example .env.local  # or: cp .env.local.example .env.local
npm run typecheck                   # no errors
npm run dev                         # http://localhost:3000
```

## Acceptance (end of Day 1)

- `curl http://localhost:4000/health` → `{"status":"ok","db_connected":true}`
- Open http://localhost:3000 → register → log in → `/home` shows "Welcome, {name}."
- Refresh → still logged in.
- `pytest` from `backend/` → all green.
- `npm run typecheck` from `frontend/` → no errors.
- `events` table contains USER_REGISTERED + USER_LOGGED_IN rows.

## Architecture non-negotiables

1. Mandatory rationale gate (>= 10 chars) — server-side, Day 5.
2. Stable face UUIDs from topology hash, not array index — Day 2.
3. Every state change writes an event — `log_event()` helper.
4. Every API route is auth-gated — `Depends(get_current_user)`.
5. Pydantic schemas for every request and response.

## Out of scope (post-deadline)

Cross-rev resolver, real PLM integration, real Datum AI, JT/OBJ parsers, hash-chained audit, signoffs, threads, 3-layer RBAC.

## Days

- Day 1 (today): foundation + auth + deploy
- Day 2: integrate provided in-house 3D viewer
- Day 3: file upload + part page
- Days 4-14: anchors, decisions, audit, polish
