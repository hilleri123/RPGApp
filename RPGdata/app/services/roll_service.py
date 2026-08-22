from __future__ import annotations

import hashlib
import random
import re
from typing import Any, Optional

from pydantic import BaseModel, Field


class RollModifier(BaseModel):
    id: str
    label: str
    value: int = 0


class RollSpec(BaseModel):
    expression: str = "2d6"
    count: Optional[int] = None
    sides: Optional[int] = None
    modifiers: list[RollModifier] = Field(default_factory=list)
    interpreter: str = "generic"
    layout: str = "combined"


class RollResult(BaseModel):
    expression: str
    dice: list[int] = Field(default_factory=list)
    rolled_sum: int = 0
    modifier_total: int = 0
    total: int = 0
    seed_hash: str = ""
    breakdown: list[dict[str, Any]] = Field(default_factory=list)
    seed_image_ref: Optional[str] = None
    record_id: Optional[str] = None


_DICE_RE = re.compile(r"^\s*(\d+)\s*d\s*(\d+)\s*$", re.IGNORECASE)


def parse_expression(expression: str) -> tuple[int, int]:
    m = _DICE_RE.match(expression or "")
    if not m:
        return 2, 6
    return int(m.group(1)), int(m.group(2))


def roll_from_seed(seed: str, spec: RollSpec) -> RollResult:
    count, sides = spec.count, spec.sides
    if count is None or sides is None:
        count, sides = parse_expression(spec.expression)

    rng = random.Random(seed)
    dice = [rng.randint(1, sides) for _ in range(count)]
    rolled_sum = sum(dice)
    modifier_total = sum(m.value for m in spec.modifiers)
    total = rolled_sum + modifier_total
    seed_hash = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]

    breakdown = [
        {"kind": "dice", "label": spec.expression, "value": rolled_sum, "dice": dice},
    ]
    for mod in spec.modifiers:
        breakdown.append({"kind": "modifier", "id": mod.id, "label": mod.label, "value": mod.value})

    return RollResult(
        expression=spec.expression,
        dice=dice,
        rolled_sum=rolled_sum,
        modifier_total=modifier_total,
        total=total,
        seed_hash=seed_hash,
        breakdown=breakdown,
    )


def roll_2d6(seed: str) -> tuple[list[int], int]:
    result = roll_from_seed(seed, RollSpec(expression="2d6"))
    return result.dice, result.rolled_sum


def commit_roll(
    seed: str,
    spec: RollSpec | None = None,
    *,
    store_seed: bool = True,
) -> RollResult:
    """
    Deterministic roll + optional seed image storage.
    DB persistence happens via persist_roll_record (async) from the action pipeline.
    """
    from app.services.roll_persist import store_seed_image

    result = roll_from_seed(seed, spec or RollSpec())
    if store_seed:
        seed_hash, seed_ref = store_seed_image(seed)
        if seed_hash:
            result.seed_hash = seed_hash
        result.seed_image_ref = seed_ref
    return result
