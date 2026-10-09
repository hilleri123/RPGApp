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


def _fighter_sheet(**extra):
    codex = FullCodex()
    mgr = CharactersManager(full_codex=codex)
    pb = codex.playbooks.playbooks_map()["fighter"]
    data = dict(
        playbook_id="fighter",
        moves=list(pb.starting_moves),
        race_id="human",
        alignment_id="good",
        stats={"str": 16, "dex": 13, "con": 15, "int": 9, "wis": 12, "cha": 8},
    )
    data.update(extra)
    return mgr, CharacterData.model_validate(data)


def test_custom_move_is_a_known_move():
    codex = FullCodex()
    mgr = CharactersManager(full_codex=codex)
    pb = codex.playbooks.playbooks_map()["fighter"]
    ch = CharacterData.model_validate({
        "playbook_id": "fighter",
        "moves": list(pb.starting_moves) + ["custom_oath"],
        "custom_moves": [{"id": "custom_oath", "title": "Клятва"}],
        "race_id": "human",
        "alignment_id": "good",
        "stats": {"str": 16, "dex": 13, "con": 15, "int": 9, "wis": 12, "cha": 8},
    })
    result = mgr.validate_and_enrich({"data": ch.model_dump(), "tags": ["kept"]})
    assert result.ok, [i.message for i in result.issues]
    assert result.result is not None
    assert "custom_oath" in result.result.data["moves"]
    assert result.result.data["custom_moves"][0]["title"] == "Клятва"
    assert result.result.tags == ["kept"]
    assert not any("Unknown move" in i.message for i in result.issues)


def test_unknown_move_keeps_sheet_for_force_save():
    mgr, ch = _fighter_sheet()
    ch.moves = list(ch.moves) + ["not_a_real_move"]
    result = mgr.validate_and_enrich({"data": ch.model_dump()})
    assert result.ok is False
    assert result.result is not None
    assert "not_a_real_move" in result.result.data["moves"]
    assert any("Unknown move: 'not_a_real_move'" in i.message for i in result.issues)


def test_warnings_do_not_block_save():
    mgr, ch = _fighter_sheet(race_id="")
    result = mgr.validate_and_enrich({"data": ch.model_dump()})
    assert any("Choose a race" in i.message for i in result.issues)
    assert result.ok is True
    assert result.result is not None
    assert result.result.data["playbook_id"] == "fighter"


def test_invalid_payload_keeps_submitted_data():
    mgr = CharactersManager(full_codex=FullCodex())
    result = mgr.validate_and_enrich({
        "data": {"playbook_id": "fighter", "moves": "not-a-list"},
        "tags": ["draft"],
    })
    assert result.ok is False
    assert result.result is not None
    assert result.result.data["playbook_id"] == "fighter"
    assert result.result.data["moves"] == "not-a-list"
    assert result.result.tags == ["draft"]


def test_free_spell_is_stored_prepared():
    mgr, ch = _fighter_sheet()
    ch = CharacterData.model_validate({
        **ch.model_dump(),
        "spellcasting": {
            "spells": [{
                "id": "gift",
                "title": "Дар",
                "level": 2,
                "prepared": False,
                "free": True,
                "source": "custom",
                "school": "воплощение",
            }],
        },
    })
    result = mgr.validate_and_enrich({"data": ch.model_dump()})
    assert result.ok, [i.message for i in result.issues]
    spell = result.result.data["spellcasting"]["spells"][0]
    assert spell["free"] is True
    assert spell["prepared"] is True
    assert spell["school"] == "воплощение"


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
