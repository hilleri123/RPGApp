import importlib

importlib.import_module("app.main")

from app import models  # noqa: E402
from app.scheme.character import CharacterUpsertPayload  # noqa: E402
from app.scheme.common import dump_entity_fields  # noqa: E402


def test_upsert_payload_drops_application_id():
    """Регрессия: POST /scenarios/{id}/characters падал с
    TypeError: 'application_id' is an invalid keyword argument for PlayerCharacter."""
    payload = CharacterUpsertPayload.model_validate(
        {"name": "Герой", "application_id": "11111111-1111-1111-1111-111111111111", "data": {}}
    )
    fields = dump_entity_fields(payload, exclude={"owned_items"})
    assert "application_id" not in fields

    obj = models.PlayerCharacter(**fields)
    assert obj.name == "Герой"


def test_every_upsert_field_is_a_model_column():
    payload = CharacterUpsertPayload.model_validate({"name": "x", "location_id": None, "bound_user_id": None})
    fields = dump_entity_fields(payload, exclude={"owned_items"})
    columns = set(models.PlayerCharacter.__table__.columns.keys())
    assert set(fields) <= columns, set(fields) - columns


def test_all_upsert_payloads_map_to_model_columns():
    """Любое поле Upsert-payload либо колонка модели, либо явно исключается в роуте.
    Список исключений синхронизирован с вызовами dump_entity_fields в routes/*."""
    from app.scheme.game_item import ItemUpsertPayload
    from app.scheme.location import LocationUpsertPayload
    from app.scheme.npc import NPCUpsertPayload
    from app.scheme.story_beat import StoryBeatUpsertPayload

    cases = [
        (CharacterUpsertPayload, models.PlayerCharacter, {"owned_items"}),
        (NPCUpsertPayload, models.NPC, {"owned_items"}),
        (ItemUpsertPayload, models.GameItem, {"contained_items"}),
        (LocationUpsertPayload, models.Location, {"map_objects", "sublocations", "scene_exposures"}),
        (StoryBeatUpsertPayload, models.StoryBeat, {"scene_exposures", "location_ids", "npc_ids"}),
    ]
    for payload_cls, model, excluded in cases:
        fields = set(payload_cls.model_fields) - {"force", "data", "tags"} - excluded
        columns = set(model.__table__.columns.keys())
        assert fields <= columns, (payload_cls.__name__, sorted(fields - columns))
