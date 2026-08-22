# plugins/gumshoe/attack/dice.py
from __future__ import annotations
import re
import random


_DICE_RE = re.compile(
    r'^\s*(?:(\d+)\s*)?d\s*(\d+)\s*([+-]\s*\d+)?\s*$',
    re.IGNORECASE,
)

def parse_dice(expr: str) -> tuple[int, int, int]:
    """
    Парсит строки вида "1d6+2", "d4", "2d8 - 1", "3".
    Возвращает (count, sides, modifier).
    Если sides=0 — это константа (count=значение, modifier=0).
    """
    expr = expr.strip()

    # Чисто число: "2", "5"
    if re.fullmatch(r'[+-]?\d+', expr):
        return (int(expr), 0, 0)

    m = _DICE_RE.match(expr)
    if not m:
        raise ValueError(f"Cannot parse dice expression: {repr(expr)}")

    count    = int(m.group(1)) if m.group(1) else 1
    sides    = int(m.group(2))
    modifier = int(re.sub(r'\s+', '', m.group(3))) if m.group(3) else 0

    return (count, sides, modifier)


def roll_dice(expr: str, rng: random.Random) -> tuple[int, list[int], int]:
    """
    Бросает кости по выражению.
    Возвращает (total, rolls, modifier).
    """
    count, sides, modifier = parse_dice(expr)

    if sides == 0:
        # константа
        return (count, [], 0)

    rolls = [rng.randint(1, sides) for _ in range(count)]
    total = sum(rolls) + modifier
    return (total, rolls, modifier)
