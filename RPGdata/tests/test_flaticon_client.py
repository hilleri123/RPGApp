import json

import pytest

from app.services.flaticon import (
    FlaticonError,
    author_page,
    cdn_png_url,
    download_target,
    icon_author,
    parse_search,
)


def test_search_keeps_preview_and_author():
    hits = parse_search({
        "data": [
            {
                "id": 13719,
                "team_name": "Freepik",
                "images": {"128": "https://cdn.example/128.png", "32": "https://cdn.example/32.png"},
            },
            {"id": 1, "team_name": "Someone"},
        ]
    })
    assert len(hits) == 1
    assert hits[0].id == 13719
    assert hits[0].preview_url == "https://cdn.example/128.png"
    assert hits[0].author_name == "Freepik"
    assert hits[0].author_url == author_page("Freepik")


def test_site_search_uses_png_and_team_name():
    hits = parse_search({
        "items": [
            {
                "id": 2603009,
                "team_name": "Icongeek26",
                "png": "https://cdn-icons-png.flaticon.com/128/2603/2603009.png",
            }
        ]
    })
    assert hits[0].preview_url.endswith("/2603009.png")
    assert hits[0].author_name == "Icongeek26"
    assert cdn_png_url(2603009) == "https://cdn-icons-png.flaticon.com/256/2603/2603009.png"


def test_author_object_wins_over_team_name():
    name, url = icon_author({"team_name": "Freepik", "author": {"name": "Ada", "url": "https://www.flaticon.com/authors/ada"}})
    assert name == "Ada"
    assert url == "https://www.flaticon.com/authors/ada"


def test_download_target_reads_png_and_json_url():
    png = b"\x89PNG\r\n\x1a\nrest"
    assert download_target("image/png", png) == png
    url = download_target("application/json", json.dumps({"url": "https://cdn.example/icon.png"}).encode())
    assert url == "https://cdn.example/icon.png"
    with pytest.raises(FlaticonError):
        download_target("application/json", b"{}")
