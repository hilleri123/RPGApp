"""Игры, которые игроку вели, и его персонажи. Пока не в проде."""

from datetime import datetime, timezone
from uuid import uuid4

from app.services.player_cabinet import Evening, Membership, build_played_games


def test_played_games_skip_a_scenario_the_player_masters_alone():
    me = uuid4()
    other = uuid4()
    mine = uuid4()
    theirs = uuid4()
    when = datetime(2026, 11, 1, tzinfo=timezone.utc)
    result = build_played_games(
        me,
        [
            Membership(mine, "Моя", me, "Я", "Герой", "#fff"),
            Membership(theirs, "Чужая", other, "Мастер", "Путник", "#abc"),
        ],
        [
            Evening(uuid4(), theirs, "Вечер", "Чужая", when, True, "Мастер", "Путник"),
        ],
    )
    assert [item.name for item in result.items] == ["Чужая"]
    assert result.items[0].active_session_id is not None
    assert result.items[0].character_name == "Путник"
    assert result.items[0].master_name == "Мастер"


def test_orphan_evening_is_its_own_card():
    me = uuid4()
    session_id = uuid4()
    result = build_played_games(
        me,
        [],
        [Evening(session_id, None, "Разовая", None, None, False, "Ведущий", "Бард")],
    )
    assert result.items[0].id == str(session_id)
    assert result.items[0].master_name == "Ведущий"
    assert result.items[0].active_session_id is None
