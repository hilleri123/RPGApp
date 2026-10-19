from app.services.application_entity_service import apply_character_photo_urls, next_photo_url


def test_upload_replaces_photo():
    assert next_photo_url(current="old", uploaded="file", url="link", clear=False) == "file"


def test_clear_removes_photo():
    assert next_photo_url(current="old", uploaded=None, url=None, clear=True) is None


def test_url_replaces_photo():
    assert next_photo_url(current="old", uploaded=None, url="link", clear=False) == "link"


def test_empty_patch_keeps_photo():
    assert next_photo_url(current="old", uploaded=None, url=None, clear=False) == "old"


def test_lobby_snapshot_photo_updates_matching_character_only():
    characters = [
        {"id": "char-1", "icon_url": "old-icon", "img_url": "old-img"},
        {"id": "char-2", "copied_from": "char-1", "icon_url": "copy-icon", "img_url": "copy-img"},
        {"id": "other", "icon_url": "keep", "img_url": "keep"},
    ]
    changed = apply_character_photo_urls(
        characters,
        {"char-1"},
        icon_url="new-icon",
        img_url="new-img",
    )
    assert changed
    assert characters[0]["img_url"] == "new-img"
    assert characters[1]["img_url"] == "new-img"
    assert characters[2]["img_url"] == "keep"
