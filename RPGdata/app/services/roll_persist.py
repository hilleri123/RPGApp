from __future__ import annotations

import base64
import hashlib
import re
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

from app.infrastructure.s3_service import MEDIA_ROOT, MEDIA_URL_PREFIX, BASE_URL
from app.logger import logger

_DATA_URL_RE = re.compile(r"^data:(image/[\w+.-]+);base64,(.+)$", re.DOTALL | re.IGNORECASE)


def seed_hash_of(seed: str | None) -> str | None:
    if not seed:
        return None
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]


def store_seed_image(seed: str | None) -> tuple[str | None, str | None]:
    """
    Persist canvas seed PNG under MEDIA_ROOT/rolls/{hash}.png.
    Returns (seed_hash, seed_image_ref relative path).
    Non-image seeds just return hash with no image ref.
    """
    if not seed:
        return None, None

    h = seed_hash_of(seed)
    assert h is not None

    m = _DATA_URL_RE.match(seed.strip())
    if not m:
        # Plain string seed (or short id) — hash only, no image file.
        return h, None

    mime = m.group(1).lower()
    raw_b64 = m.group(2)
    ext = "png" if "png" in mime else "bin"
    try:
        payload = base64.b64decode(raw_b64, validate=False)
    except Exception:
        logger.warning("failed to decode seed image for hash=%s", h)
        return h, None

    dest_dir = MEDIA_ROOT / "rolls"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{h}.{ext}"
    if not dest.exists():
        dest.write_bytes(payload)

    rel = f"rolls/{h}.{ext}"
    return h, rel


def seed_image_url(seed_image_ref: str | None) -> str | None:
    if not seed_image_ref:
        return None
    return f"{BASE_URL}{MEDIA_URL_PREFIX}/{seed_image_ref.lstrip('/')}"


def seed_image_path(seed_image_ref: str | None) -> Path | None:
    if not seed_image_ref:
        return None
    return MEDIA_ROOT / seed_image_ref.lstrip("/")


async def persist_roll_record(
    *,
    session_id: UUID | str,
    user_id: UUID | str,
    title: str = "",
    dice: list[int] | None = None,
    total: int | None = None,
    outcome: str | None = None,
    seed: str | None = None,
    roll_kind: str = "dice.roll",
    action_id: UUID | str | None = None,
    action_key: str | None = None,
    expression: str | None = None,
    system_id: str | None = None,
    character_id: UUID | str | None = None,
    player_id: UUID | str | None = None,
    meta: dict[str, Any] | None = None,
) -> Optional[UUID]:
    """Insert a roll_record row. Returns record id or None on failure."""
    from app import models
    from app.infrastructure.database import get_async_session as get_db

    seed_hash, seed_ref = store_seed_image(seed)
    try:
        async for db in get_db():
            row = models.RollRecord(
                session_id=UUID(str(session_id)),
                user_id=UUID(str(user_id)),
                player_id=UUID(str(player_id)) if player_id else None,
                character_id=UUID(str(character_id)) if character_id else None,
                action_id=UUID(str(action_id)) if action_id else None,
                action_key=action_key,
                roll_kind=roll_kind or "dice.roll",
                system_id=system_id,
                title=title or "",
                expression=expression,
                dice=list(dice or []),
                total=total,
                outcome=outcome,
                seed_hash=seed_hash,
                seed_image_ref=seed_ref,
                meta=dict(meta or {}),
            )
            db.add(row)
            await db.commit()
            await db.refresh(row)
            return row.id
    except Exception:
        logger.exception(
            "persist_roll_record failed session=%s user=%s kind=%s",
            session_id,
            user_id,
            roll_kind,
        )
        return None


def sanitize_log_seed(seed: str | None) -> str | None:
    """Keep Redis logs small — store hash instead of full PNG data-URL."""
    if not seed:
        return None
    if seed.startswith("data:image"):
        return seed_hash_of(seed)
    if len(seed) > 256:
        return seed_hash_of(seed)
    return seed
