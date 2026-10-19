from datetime import datetime, timezone

import pytest

from app.services.table_recap import draft_from_sources, paragraphs_of
from app.services.table_session import (
    bridge_audio_path,
    game_time_at,
    looks_like_endpoint,
    parse_room_url,
    tally_recordings,
)


def test_peregovorka_room_link():
    host, code = parse_room_url("https://peregovorka.mos.ru/room/xtsdcwngzn5n")
    assert host == "peregovorka.mos.ru"
    assert code == "xtsdcwngzn5n"


def test_bridge_reads_track_from_shared_media():
    assert bridge_audio_path("http://localhost:6602/api/media/audio/theme.mp3") == "audio/theme.mp3"
    assert bridge_audio_path("http://localhost:6602/api/media/../etc/passwd") is None


def test_other_jitsi_is_rejected():
    with pytest.raises(ValueError):
        parse_room_url("https://meet.jit.si/example")


def test_game_time_uses_last_mark_not_after_speech():
    marks = [
        (datetime(2026, 10, 18, 17, 0, tzinfo=timezone.utc), "1200-01-01T08:00:00"),
        (datetime(2026, 10, 18, 18, 0, tzinfo=timezone.utc), "1200-01-01T09:30:00"),
    ]
    spoken = datetime(2026, 10, 18, 17, 40, tzinfo=timezone.utc)
    assert game_time_at(marks, spoken) == "1200-01-01T08:00:00"
    later = datetime(2026, 10, 18, 18, 5, tzinfo=timezone.utc)
    assert game_time_at(marks, later) == "1200-01-01T09:30:00"


def test_jitsi_display_name_is_not_an_endpoint_id():
    assert looks_like_endpoint("7e5fff80")
    assert looks_like_endpoint("ssrc-400")
    assert not looks_like_endpoint("Александр")


def test_recording_tally_sums_weight_and_time():
    stats = tally_recordings([
        ("anya", "Аня", 1_500_000, 90),
        ("anya", "Аня", 500_000, 30),
        ("boris", "Борис", 0, 0),
    ])
    assert stats["bytes"] == 2_000_000
    by_name = {row["display_name"]: row for row in stats["participants"]}
    assert by_name["Аня"]["bytes"] == 2_000_000
    assert by_name["Аня"]["seconds"] == 120
    assert by_name["Борис"]["seconds"] == 0


def test_recap_keeps_utterances_chronicle_and_moves():
    text = draft_from_sources(
        utterances=[("Аня", "открываю дверь", "1200-01-01T08:00:00")],
        chronicle=["мастер записал дождь"],
        moves=["Аня: Discern Realities"],
    )
    assert "открываю дверь" in text
    assert "1200-01-01T08:00:00" in text
    assert "дождь" in text
    assert "Discern Realities" in text
    assert paragraphs_of(text)
