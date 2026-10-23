"""Сохраняет жест в media и в roll_gesture, вычищает base64 из документа хода."""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from app.infrastructure.database import AsyncSessionLocal
from app.models.roll_gesture import RollGesture
from app.services.gesture_materialize import apply_gesture_refs, collect_image_seeds
from app.services.roll_persist import seed_image_url, store_seed_image


async def create_gesture_from_seed(
    seed: str | None,
    *,
    session_id: UUID | str | None,
    user_id: UUID | str | None,
    reason: str | None = None,
) -> UUID | None:
    from app.services.gesture_materialize import is_image_data_url

    if not is_image_data_url(seed):
        return None
    seed_hash, image_ref = store_seed_image(seed)
    gesture_id = uuid4()
    async with AsyncSessionLocal() as db:
        db.add(
            RollGesture(
                id=gesture_id,
                session_id=UUID(str(session_id)) if session_id else None,
                user_id=UUID(str(user_id)) if user_id else None,
                seed_hash=seed_hash,
                image_ref=image_ref,
                reason=reason,
            )
        )
        await db.commit()
    return gesture_id


async def materialize_gestures(
    node: Any,
    *,
    session_id: UUID | str | None,
    user_id: UUID | str | None,
    reason: str | None = None,
) -> Any:
    found = collect_image_seeds(node)
    if not found:
        return node

    replacements: dict[tuple, dict[str, str]] = {}
    async with AsyncSessionLocal() as db:
        for path, seed in found:
            seed_hash, image_ref = store_seed_image(seed)
            gesture_id = uuid4()
            db.add(
                RollGesture(
                    id=gesture_id,
                    session_id=UUID(str(session_id)) if session_id else None,
                    user_id=UUID(str(user_id)) if user_id else None,
                    seed_hash=seed_hash,
                    image_ref=image_ref,
                    reason=reason,
                )
            )
            url = seed_image_url(image_ref) or ""
            replacements[path] = {
                "gesture_id": str(gesture_id),
                "gesture_url": url,
                "seed_hash": seed_hash or "",
            }
        await db.commit()
    return apply_gesture_refs(node, replacements)
