"""Tests for canonical player-seen entity keys."""

from uuid import uuid4

from app.services.entity_seen import (
    canonical_seen_id,
    entity_matches_seen,
    resolve_seen_entry_from_inner,
    resolve_seen_entries_from_inner,
)


class _Npc:
    def __init__(self, id, copied_from=None):
        self.id = id
        self.copied_from = copied_from


class _Inner:
    def __init__(self, npcs=None, items=None, locations=None, characters=None):
        self.npcs = npcs or []
        self.items = items or []
        self.locations = locations or []
        self.characters = characters or []


def test_canonical_seen_id_uses_template_parent():
    template = uuid4()
    instance = uuid4()
    assert canonical_seen_id(
        entity_type="npc",
        entity_id=instance,
        copied_from=template,
    ) == template


def test_canonical_seen_id_without_template_uses_self():
    entity_id = uuid4()
    assert canonical_seen_id(
        entity_type="npc",
        entity_id=entity_id,
        copied_from=None,
    ) == entity_id


def test_resolve_seen_entry_from_inner_npc_instance():
    template = uuid4()
    instance = uuid4()
    inner = _Inner(npcs=[_Npc(instance, copied_from=template)])
    assert resolve_seen_entry_from_inner(inner, instance) == ("npc", template)


def test_resolve_seen_entries_dedup_same_template():
    template = uuid4()
    inst_a = uuid4()
    inst_b = uuid4()
    inner = _Inner(npcs=[_Npc(inst_a, copied_from=template), _Npc(inst_b, copied_from=template)])
    entries = resolve_seen_entries_from_inner(inner, [inst_a, inst_b])
    assert entries == [("npc", template)]


def test_entity_matches_seen_by_parent():
    template = uuid4()
    instance = uuid4()
    seen = {template}
    assert entity_matches_seen(
        entity_type="npc",
        entity_id=instance,
        copied_from=template,
        seen_ids=seen,
    )
