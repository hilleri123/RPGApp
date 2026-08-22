from pydantic import BaseModel, Field

from app.plugins.contracts import EntityPayload
from app.services.entity_data_rule import (
    merge_validated_entity_fields,
    resolve_rule_id_from_data,
    stamp_entity_data,
)


def test_stamp_entity_data_sets_rule_id():
    data = stamp_entity_data({"hp": 10}, "dungeon_world")
    assert data["rule_id_str"] == "dungeon_world"
    assert data["hp"] == 10


def test_resolve_rule_id_from_data():
    assert resolve_rule_id_from_data({"rule_id_str": "pbta_base"}) == "pbta_base"
    assert resolve_rule_id_from_data({}, fallback="gumshoe") == "gumshoe"


class _Payload(BaseModel):
    name: str = "Test NPC"
    tags: list[str] = Field(default_factory=lambda: ["a"])
    data: dict = Field(default_factory=dict)
    force: bool = False


def test_merge_validated_entity_fields_no_duplicate_tags():
    merged = merge_validated_entity_fields(
        payload=_Payload(),
        plugin_payload=EntityPayload(data={"level": 1}, tags=["b"]),
        exclude=set(),
        tags=["template"],
    )
    assert merged["tags"] == ["template"]
    assert merged["data"] == {"level": 1}
    assert merged["name"] == "Test NPC"
