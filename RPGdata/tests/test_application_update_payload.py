"""Заявка обновляется без rule_id_str, а проверка персонажа умеет его принять."""

import inspect

from app.routes._helpers import validate_entity_data
from app.scheme.application import ApplicationUpdatePayload


def test_update_payload_keeps_sheet_without_rule_id():
    payload = ApplicationUpdatePayload.model_validate({
        "name": "Гарро",
        "story": "<p>История</p>",
        "data": {"playbook_id": "barbarian", "stats": {"str": 16}},
        "tags": ["варвар"],
    })
    dumped = payload.model_dump(exclude_unset=True, exclude_none=True)
    assert "rule_id_str" not in dumped
    assert dumped["data"]["playbook_id"] == "barbarian"
    assert dumped["name"] == "Гарро"


def test_validate_entity_data_accepts_rule_id_str():
    params = inspect.signature(validate_entity_data).parameters
    assert "rule_id_str" in params
