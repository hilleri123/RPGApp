from __future__ import annotations

import random
from typing import Tuple

def best_and_crit(rolls: list[int]) -> tuple[int, bool]:
    best = max(rolls) if rolls else 0
    crit = rolls.count(6) >= 2
    return best, crit

def roll_d6(pool: int) -> list[int]:
    pool = max(0, int(pool))
    # 0 dice: roll 2d6 and take the lower
    if pool <= 0:
        r = [random.randint(1, 6), random.randint(1, 6)]
        return [min(r)]
    return [random.randint(1, 6) for _ in range(pool)]

def outcome_from(rolls: list[int]) -> Tuple[str, bool, int]:
    best, crit = best_and_crit(rolls)
    if crit:
        return "crit", True, best
    if best == 6:
        return "good", False, best
    if best in (4, 5):
        return "mixed", False, best
    return "bad", False, best
