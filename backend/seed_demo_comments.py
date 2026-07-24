"""Seed demo comment threads on a specific part for demo purposes.

Populates all three tabs — OPEN, RESOLVED, and @ME — with realistic
mechanical review comments so the CommentsPanel isn't empty in demos.

Distribution:
  · 3 threads → assigned to Kushal (appear in @ME tab, status=OPEN)
  · 3 threads → status=RESOLVED (appear in RESOLVED tab)
  · 3 threads → generic OPEN (add bulk to the OPEN tab)

Usage:
    python seed_demo_comments.py <part_id>

Idempotent-ish: creates 9 new threads each run. Delete them via the UI
or another DB script if you want a clean slate.
"""

from __future__ import annotations

import sys
import uuid

import httpx


BASE = "http://localhost:4000"
KUSHAL_EMAIL = "kushal@aurora.demo"
DEMO_PASSWORD = "dataverse2026"


# ── Comment library ─────────────────────────────────────────────────────────
# Each entry: (title, root_body, priority, tags)

ASSIGNED_TO_ME: list[tuple[str, str, str, list[str]]] = [
    (
        "Pin timing off by 7° — needs your review",
        "Driver pin engages the slot at ~7° before the star-wheel radial "
        "reaches horizontal. Ideal is 0° for shock-free entry. Kushal — "
        "confirm whether we advance the crank by 7° or shorten the pin "
        "lever by 1.2 mm. This affects the fatigue calc on the driver arm.",
        "high",
        ["kinematics", "review-needed"],
    ),
    (
        "Star wheel material spec — sign-off required",
        "Current spec is AL 7075-T6 for the star wheel. Steel driver pin "
        "will Brinell into the alloy within 5000 cycles. Recommend switch "
        "to hardened 4140 (32 HRC) OR add a bushing sleeve. Please approve "
        "the material change before I release the drawing to procurement.",
        "high",
        ["material", "sign-off"],
    ),
    (
        "Slot mouth chamfer — approve rework?",
        "Slot mouth on the orange wheel has no lead-in chamfer. Recommend "
        "0.5×45° on both edges to reduce galling on high-cycle applications "
        "(>50k idx/day). Rework cost: ~$800 for the tooling change. Need "
        "sign-off before Monday to hit the ship date.",
        "medium",
        ["manufacturing", "cost"],
    ),
]

RESOLVED: list[tuple[str, str, str, list[str]]] = [
    (
        "O-ring groove depth corrected to 2.10 mm",
        "Groove depth was 1.85 mm giving 30% squeeze which was too high "
        "and would extrude under pressure. Updated to 2.10 mm for 20% "
        "squeeze per Parker handbook. Rev C released. Closing this out.",
        "medium",
        ["sealing", "closed"],
    ),
    (
        "Shaft-shoulder radius updated to R1.5",
        "Original R0.5 fillet had SCF of 2.4 under bending load. Increased "
        "to R1.5 minimum per ISO 3096 shoulder-fillet ratio. FEA re-run "
        "shows stress reduced by 42%, well within endurance limit. "
        "Approved — no further action needed.",
        "high",
        ["structural", "fea-verified"],
    ),
    (
        "Torque spec reduced from 25 → 18 Nm on M8",
        "Original 25 Nm on M8 exceeded yield of the 6061-T6 boss "
        "(calc ≈ 18 Nm). Reduced to 18 Nm on the assembly drawing. "
        "Alternative Heli-Coil path documented in the maintenance manual "
        "for future upgrades. Closed.",
        "medium",
        ["fasteners", "safety"],
    ),
]

OPEN_GENERAL: list[tuple[str, str, str, list[str]]] = [
    (
        "Backlash 0.15 mm — acceptable for now",
        "Play measured between pin and slot at engagement. Acceptable for "
        "<500 rpm operation but will produce chatter above that. Flag for "
        "the Phase-2 high-speed variant — no action needed for current rev.",
        "low",
        ["kinematics", "phase-2"],
    ),
    (
        "Counterweight missing on driver arm",
        "Imbalance calc = 0.08 kg·m² on the yellow crank. Will produce "
        "vibration at any RPM. Add balance mass 28 g at r=30 mm opposite "
        "the pin. Design change queued for next revision.",
        "medium",
        ["vibration", "design"],
    ),
    (
        "Missing keyway on disc-to-shaft interface",
        "Currently relies on interference fit alone. Add 3 mm × 3 mm "
        "keyway for positive engagement. Won't fail at rated torque but "
        "no margin for overload conditions.",
        "medium",
        ["design", "assembly"],
    ),
]


def login(email: str, password: str) -> tuple[str, str]:
    """Return (token, user_id)."""
    r = httpx.post(
        f"{BASE}/api/auth/login",
        json={"email": email, "password": password},
        timeout=10.0,
    )
    r.raise_for_status()
    data = r.json()
    return data["access_token"], data["user"]["id"]


def create_thread(
    token: str,
    part_id: str,
    title: str,
    body: str,
    priority: str,
    tags: list[str],
) -> str:
    """Create a thread; return its id."""
    payload = {
        "part_id": part_id,
        "face_uuid": uuid.uuid4().hex,  # synthetic — pin won't render on the mesh
        "centroid": {"x": 0.0, "y": 0.0, "z": 0.0},
        "title": title,
        "root_body": body,
        "priority": priority,
        "tags": tags,
    }
    r = httpx.post(
        f"{BASE}/api/threads",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
        timeout=10.0,
    )
    r.raise_for_status()
    return r.json()["id"]


def patch_thread(token: str, thread_id: str, patch: dict) -> None:
    r = httpx.patch(
        f"{BASE}/api/threads/{thread_id}",
        headers={"Authorization": f"Bearer {token}"},
        json=patch,
        timeout=10.0,
    )
    r.raise_for_status()


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <part_id>")
        sys.exit(1)
    part_id = sys.argv[1]

    print(f"Logging in as {KUSHAL_EMAIL}…")
    token, kushal_id = login(KUSHAL_EMAIL, DEMO_PASSWORD)
    print(f"  ✓ user_id: {kushal_id}")

    print(f"\n[@ME] Creating {len(ASSIGNED_TO_ME)} threads assigned to Kushal…")
    for title, body, prio, tags in ASSIGNED_TO_ME:
        tid = create_thread(token, part_id, title, body, prio, tags)
        patch_thread(token, tid, {"assignee_id": kushal_id})
        print(f"  ✓ {title[:60]}")

    print(f"\n[RESOLVED] Creating {len(RESOLVED)} resolved threads…")
    for title, body, prio, tags in RESOLVED:
        tid = create_thread(token, part_id, title, body, prio, tags)
        patch_thread(token, tid, {"status": "resolved"})
        print(f"  ✓ {title[:60]}")

    print(f"\n[OPEN] Creating {len(OPEN_GENERAL)} general open threads…")
    for title, body, prio, tags in OPEN_GENERAL:
        create_thread(token, part_id, title, body, prio, tags)
        print(f"  ✓ {title[:60]}")

    total = len(ASSIGNED_TO_ME) + len(RESOLVED) + len(OPEN_GENERAL)
    print(f"\n✅ Seeded {total} threads on part {part_id}")
    print(f"   Distribution: {len(OPEN_GENERAL) + len(ASSIGNED_TO_ME)} open / "
          f"{len(RESOLVED)} resolved / {len(ASSIGNED_TO_ME)} assigned-to-me")


if __name__ == "__main__":
    main()
