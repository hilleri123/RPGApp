"""Dungeon World: max HP = base_hp + CON score (not modifier)."""

from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from plugins.pbta.dungeon_world.base.backend.managers.characters_manager import CharactersManager
from plugins.pbta.dungeon_world.base.backend.types import CharacterData


def test_max_hp_uses_con_score_not_modifier():
    codex = FullCodex()
    mgr = CharactersManager(full_codex=codex)
    pb = codex.playbooks.playbooks_map()["fighter"]

    ch = CharacterData(
        playbook_id="fighter",
        moves=list(pb.starting_moves),
        race_id="human",
        alignment_id="good",
        stats={"str": 16, "dex": 13, "con": 15, "int": 9, "wis": 12, "cha": 8},
    )
    result = mgr.validate_and_enrich({"data": ch.model_dump()})
    assert result.ok
    enriched = CharacterData.model_validate(result.result.data)
    assert enriched.max_hp == pb.base_hp + 15


def test_stat_spread_allows_level_up_bumps():
    codex = FullCodex()
    mgr = CharactersManager(full_codex=codex)
    pb = codex.playbooks.playbooks_map()["fighter"]

    ch = CharacterData(
        playbook_id="fighter",
        moves=list(pb.starting_moves),
        race_id="human",
        alignment_id="good",
        level=3,
        stats={"str": 18, "dex": 13, "con": 15, "int": 9, "wis": 12, "cha": 8},
    )
    result = mgr.validate_and_enrich({"data": ch.model_dump()})
    stat_issues = [i for i in result.issues if i.path == "data.stats"]
    assert not stat_issues, stat_issues


def test_barbarian_starting_armor_choice():
    codex = FullCodex()
    mgr = CharactersManager(full_codex=codex)
    pb = codex.playbooks.playbooks_map()["barbarian"]
    assert pb.starting_move_choices == [
        ["barbarian_unbowed_unbent_unbroken", "barbarian_heavy_armor"],
    ]

    base_moves = list(pb.starting_moves) + ["barbarian_outlander"]
    ch = CharacterData(
        playbook_id="barbarian",
        moves=base_moves,
        race_id="human",
        alignment_id="chaotic",
        stats={"str": 16, "dex": 13, "con": 15, "int": 9, "wis": 12, "cha": 8},
    )
    result = mgr.validate_and_enrich({"data": ch.model_dump()})
    choice_issues = [
        i for i in result.issues if "Choose one starting move" in i.message
    ]
    assert choice_issues, result.issues

    ch.moves = base_moves + ["barbarian_unbowed_unbent_unbroken"]
    result2 = mgr.validate_and_enrich({"data": ch.model_dump()})
    choice_issues2 = [
        i for i in result2.issues if "Choose one starting move" in i.message
    ]
    assert not choice_issues2

    codex = FullCodex()
    pbs = codex.playbooks.playbooks_map()
    assert "immolator" in pbs
    assert pbs["immolator"].title == "Испепелитель"
    assert pbs["immolator"].base_hp == 4


def test_ranger_in_codex():
    codex = FullCodex()
    pbs = codex.playbooks.playbooks_map()
    moves = codex.playbooks.moves_map()
    pb = pbs["ranger"]
    assert pb.title == "Следопыт"
    assert pb.base_hp == 8
    assert pb.base_load == 11
    assert pb.damage_die == "d8"
    assert pb.starting_moves == [
        "ranger_hunt_and_track",
        "ranger_called_shot",
        "ranger_animal_companion",
        "ranger_command",
    ]
    assert len(pb.advanced_moves) == 11
    assert len(pb.advanced_moves_6_10) == 9
    all_ids = (
        list(pb.starting_moves)
        + list(pb.advanced_moves)
        + list(pb.advanced_moves_6_10)
    )
    assert all(mid in moves for mid in all_ids)
    assert moves["ranger_hunt_and_track"].title == "Выследить"
    assert moves["ranger_command"].kind == "class"
