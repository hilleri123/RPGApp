"""Данные DW сверены с русским изданием правил (indw01, 2019)."""

from __future__ import annotations

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from plugins.pbta.base.backend.workflows.perform_move.helpers import move_requires_roll
from plugins.pbta.dungeon_world.base.backend.codex import FullCodex


@pytest.fixture(scope="module")
def codex():
    return FullCodex()


def test_barbarian_load_is_eight_plus_str(codex):
    assert codex.playbooks.playbooks_map()["barbarian"].base_load == 8


@pytest.mark.parametrize(
    "move_id",
    [
        "bard_bardic_lore", "bard_charming_and_open", "bard_healing_song", "bard_healing_choir",
        "bard_monstrous_cacophony", "bard_monstrous_chord", "bard_outfox", "bard_outcheat",
        "bard_magic_listening", "wizard_reflection_field",
    ],
)
def test_moves_without_a_roll_in_the_rules_do_not_ask_for_one(codex, move_id):
    assert move_requires_roll(codex.playbooks.moves_map()[move_id]) is False


@pytest.mark.parametrize(
    ("move_id", "stat"),
    [("wizard_logic", "int"), ("wizard_iron_logic", "int"), ("fighter_interrogation", "str"),
     ("ranger_familiar_prey", "wis")],
)
def test_stat_swap_moves_offer_the_swapped_stat(codex, move_id, stat):
    assert codex.playbooks.moves_map()[move_id].available_stats == [stat]


def test_passive_class_moves_are_not_locked_to_action_scenes(codex):
    safe_place = codex.playbooks.moves_map()["bard_a_safe_place"]
    cond = safe_place.condition
    assert not (cond and list(cond.requires_context or []) == ["action"])


@pytest.mark.parametrize(
    ("spell_id", "level", "ongoing"),
    [
        ("detect_magic", 1, False), ("charm_person", 1, True), ("telepathy", 1, True),
        ("contact_spirits", 1, False), ("mirror_image", 3, False), ("mirror_double", 3, True),
        ("dominate", 7, True), ("pass_through_shadows", 7, False),
        ("cause_fear", 1, True), ("sanctuary", 1, True), ("detect_alignment", 1, True),
        ("word_of_recall", 7, False), ("harm", 7, False), ("control_weather", 7, False),
        ("curse", 9, True),
    ],
)
def test_spell_levels_follow_the_rules(spell_id, level, ongoing):
    from plugins.pbta.dungeon_world.base.backend.codex.spells import CLERIC_SPELLS, WIZARD_SPELLS

    spell = next(s for s in WIZARD_SPELLS + CLERIC_SPELLS if s.id == spell_id)
    assert spell.level == level
    assert ("длительное" in spell.tags) is ongoing
    assert spell.school != "длительное"
