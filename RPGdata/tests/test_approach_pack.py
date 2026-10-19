from types import SimpleNamespace

from app.services.approach_pack import media_file, safe_name, world_text


def test_pack_names_stay_inside_the_folder():
    assert ".." not in safe_name("../секрет", "approach")
    assert media_file("../etc/passwd") is None
    assert media_file("audio/../../etc/passwd") is None


def test_world_text_lists_people_and_places():
    text = world_text(
        [SimpleNamespace(name="Аня", short_desc="воровка", story="ищет выход")],
        [SimpleNamespace(name="Страж", description_for_players="молчит", description_for_master="знает код")],
        [SimpleNamespace(name="Мост", description_for_players="узкий", description_for_master="")],
        [SimpleNamespace(name="Клятва", text="не выдавать друг друга")],
    )
    assert "Аня" in text and "Страж" in text and "Мост" in text and "Клятва" in text
