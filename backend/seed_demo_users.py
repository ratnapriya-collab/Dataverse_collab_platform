"""Seed the 5 demo users used by the login-tile UI.

Idempotent — running twice is safe; it upserts each user.

Password for all demo users: `dataverse2026`. This is intentionally
shared and public — the login screen advertises "Demo mode — no
passwords" and the tiles POST this password automatically so the user
never sees it. Real prod uses Keycloak SSO.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.core.security import hash_password
from app.database import engine
from app.models.user import User

DEMO_PASSWORD = "dataverse2026"

DEMO_USERS = [
    {
        "email": "kushal@aurora.demo",
        "name": "Kushal",
    },
    {
        "email": "dana.okafor@aurora.demo",
        "name": "Dana Okafor",
    },
    {
        "email": "marcus.chen@aurora.demo",
        "name": "Marcus Chen",
    },
    {
        "email": "priya.nair@aurora.demo",
        "name": "Priya Nair",
    },
    {
        "email": "sam.rivera@rivera-composites.demo",
        "name": "Sam Rivera",
    },
]


def main() -> None:
    with Session(engine) as session:
        for spec in DEMO_USERS:
            email = spec["email"].lower()
            existing = session.exec(select(User).where(User.email == email)).first()
            if existing is None:
                session.add(
                    User(
                        email=email,
                        name=spec["name"],
                        password_hash=hash_password(DEMO_PASSWORD),
                    )
                )
                print(f"  + created: {email}")
            else:
                # Keep password fresh in case it drifted from the shared demo pw.
                existing.password_hash = hash_password(DEMO_PASSWORD)
                existing.name = spec["name"]
                session.add(existing)
                print(f"  = refreshed: {email}")
        session.commit()
    print(f"\nSeeded {len(DEMO_USERS)} demo users. Password for all: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
