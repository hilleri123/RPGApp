from __future__ import annotations

import pytest

from plugins.pbta.base.backend.custom_moves import merge_moves_map
from plugins.pbta.base.backend.move_overrides import apply_move_override, has_move_override
from plugins.pbta.base.backend.types.types_classes import Move, MoveTextOverride


def _sample_move() -> Move:
    return Move(
        id="druid_born_of_the_soil",
        title="Рождённый из почвы",
        kind="class",
        effect="Ты принадлежишь земле {{land}}.",
    )


def test_apply_move_override_replaces_text():
    base = _sample_move()
    ov = MoveTextOverride(effect="Ты принадлежишь земле Великие леса; знак: кольцо мха.")
    merged = apply_move_override(base, ov)
    assert merged.effect == ov.effect
    assert merged.title == base.title


def test_apply_move_override_empty_keeps_base():
    base = _sample_move()
    ov = MoveTextOverride()
    assert apply_move_override(base, ov) is base
    assert not has_move_override(ov)


def test_merge_moves_map_applies_overrides():
    base = _sample_move()
    actor = {
        "moves": [base.id],
        "move_overrides": {
            base.id: {"effect": "Правка на листе."},
        },
    }
    merged = merge_moves_map({base.id: base}, actor)
    assert merged[base.id].effect == "Правка на листе."


def test_character_validate_accepts_move_overrides():
    from plugins.pbta.dungeon_world.base.backend.managers.characters_manager import (
        CharactersManager,
    )
    from plugins.pbta.dungeon_world.base.backend.codex import FullCodex

    mgr = CharactersManager(FullCodex())
    payload = {
        "data": {
            "playbook_id": "druid",
            "moves": [
                "druid_born_of_the_soil",
                "druid_by_nature_sustained",
                "druid_spirit_tongue",
                "druid_shapeshifter",
            ],
            "race_id": "elf",
            "alignment_id": "neutral",
            "stats": {"str": 15, "dex": 13, "con": 12, "int": 9, "wis": 16, "cha": 8},
            "state": {},
            "move_overrides": {
                "druid_born_of_the_soil": {
                    "effect": "Земля: Великие леса. Знак: кольцо из ивы.",
                },
            },
            "level": 1,
            "hp": 0,
            "xp": 0,
            "armor_cache": 0,
        },
        "tags": [],
    }
    res = mgr.validate_and_enrich(payload)
    assert res.ok is True
    data = res.result["data"] if isinstance(res.result, dict) else res.result.data
    assert (
        data["move_overrides"]["druid_born_of_the_soil"]["effect"]
        == "Земля: Великие леса. Знак: кольцо из ивы."
    )
