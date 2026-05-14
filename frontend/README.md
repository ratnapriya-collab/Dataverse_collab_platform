# DataVerse Collab — Frontend

Next.js 14 (App Router) + React 18 + TypeScript (strict) + Tailwind.

## Local setup

```bash
cd frontend
npm install
copy .env.local.example .env.local   # or: cp .env.local.example .env.local

npm run typecheck                    # no errors
npm run dev                          # http://localhost:3000
```

Backend must be running at the URL in `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`).

## Pages

- `/`           → redirects to `/login` or `/home` based on token presence.
- `/login`      → email/password sign-in.
- `/register`   → create account + auto-login.
- `/home`       → authenticated dashboard placeholder. Day 3 adds upload + parts list.

## Conventions

- TypeScript `strict: true` and `noUncheckedIndexedAccess: true`. No `any`.
- All API calls go through `src/lib/api.ts`. Pages NEVER call `fetch()` directly.
- Response types live in `src/types/api.ts` and mirror the FastAPI Pydantic schemas.
- Token storage in `src/lib/auth.ts` — currently localStorage; httpOnly cookie post-MVP.
- Tailwind colors: `primary` (#15524a) for accents.

## Production source maps

`next.config.js` sets `productionBrowserSourceMaps: false`. This is intentional —
keep it off so the bundled in-house 3D viewer (added on Day 2) cannot be trivially
reverse-engineered from a customer's browser.

## Deploy (Vercel)

1. Import this repo into Vercel; set the **Root Directory** to `frontend/`.
2. Add env vars:
   - `NEXT_PUBLIC_API_BASE_URL` — your Render backend URL, e.g. `https://dataverse-api.onrender.com`.
3. Make sure the underlying GitHub repo is **private**. The viewer code shipping
   on Day 2 must not leak.
