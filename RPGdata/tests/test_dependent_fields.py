import importlib

importlib.import_module("app.main")

from app.managers.session import expand_dependent_fields  # noqa: E402


def test_character_edit_refreshes_scenes_and_player_views():
    out = expand_dependent_fields(["characters"])
    assert out[0] == "characters"
    assert {"scenes", "players", "self_player"} <= set(out)


def test_npc_and_item_edits_refresh_scenes_and_no_duplicates():
    assert expand_dependent_fields(["npcs", "scenes"]).count("scenes") == 1
    assert {"scenes", "characters"} <= set(expand_dependent_fields(["items"]))


def test_unrelated_fields_untouched():
    assert expand_dependent_fields(["notes"]) == ["notes"]
    assert expand_dependent_fields([]) == []


def test_expanded_fields_exist_in_update_models():
    """Регрессия: расширение добавляло `players`, которого не было в MasterSessionUpdate,
    и push после правки персонажа мастером падал (игроки не получали обновление)."""
    from app.managers.session import DEPENDENT_UPDATE_FIELDS
    from app.scheme.session.ws_messages import MasterSessionUpdate, PlayerSessionUpdate

    known = set(MasterSessionUpdate.model_fields) | set(PlayerSessionUpdate.model_fields)
    for src, deps in DEPENDENT_UPDATE_FIELDS.items():
        for name in deps:
            assert name in known, (src, name)
    assert "players" in MasterSessionUpdate.model_fields
