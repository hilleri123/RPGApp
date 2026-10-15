from app.services.application_entity_service import next_photo_url


def test_upload_replaces_photo():
    assert next_photo_url(current="old", uploaded="file", url="link", clear=False) == "file"


def test_clear_removes_photo():
    assert next_photo_url(current="old", uploaded=None, url=None, clear=True) is None


def test_url_replaces_photo():
    assert next_photo_url(current="old", uploaded=None, url="link", clear=False) == "link"


def test_empty_patch_keeps_photo():
    assert next_photo_url(current="old", uploaded=None, url=None, clear=False) == "old"
