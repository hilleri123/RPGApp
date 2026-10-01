"""Игроку уходят только «презентационные» теги NPC (enemy/dead), остальные скрыты.

Раньше для игрока вычищались все теги, и NPC-враг рисовался ему зелёным, как союзник.
"""

import importlib
from types import SimpleNamespace


def _mgr():
    importlib.import_module("app.main")
    return importlib.import_module("app.managers.session").CurrentSessionManager


class _Entity:
    def __init__(self, tags):
        self.id = "x"
        self.tags = tags
        self.data = {"secret": 1}
        self.copied_from = None

    def model_copy(self, update):
        e = _Entity(self.tags)
        for k, v in update.items():
            setattr(e, k, v)
        return e


def _strip(entity_type, tags):
    cls = _mgr()
    fake = SimpleNamespace(
        _player_visible_tags=lambda et, e: cls._player_visible_tags(fake, et, e),
        _entity_data_access=lambda et, e, m: None,
        PLAYER_VISIBLE_NPC_TAGS=cls.PLAYER_VISIBLE_NPC_TAGS,
    )
    return cls._strip_entity_data_for_player(fake, _Entity(tags), entity_type, {})


def test_enemy_and_dead_tags_reach_player_but_secrets_do_not():
    out = _strip("npc", ["enemy", "dead", "secret-villain", "party:rogue"])
    assert out.tags == ["enemy", "dead"]
    assert out.data == {}  # данные по-прежнему режутся


def test_non_npc_entities_still_lose_all_tags():
    assert _strip("game_item", ["enemy", "x"]).tags == []
    assert _strip("player_character", ["dead"]).tags == []


def test_npc_without_presentation_tags_gets_empty_list():
    assert _strip("npc", ["secret"]).tags == []
