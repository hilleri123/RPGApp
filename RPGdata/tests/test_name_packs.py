from app.services.name_generators_merge import merge_name_generators_config


def test_merge_name_generators_adds_pack_entries_and_part_kinds():
    base = {
        "entries": [{"name": "Codex", "part_kind": "full", "tags": ["npc"]}],
        "tags": ["npc"],
    }
    pack = [
        {"name": "Иван", "part_kind": "given", "tags": ["human", "npc"]},
        {"name": "Быков", "part_kind": "family", "tags": ["human", "npc"]},
    ]
    merged = merge_name_generators_config(base, pack)
    assert len(merged["entries"]) == 3
    assert "given" in merged["partKinds"]
    tags = set(merged["tags"])
    assert "human" in tags
    assert "npc" in tags


def test_merge_name_generators_empty_base():
    merged = merge_name_generators_config(None, [{"name": "X", "part_kind": "given", "tags": []}])
    assert merged["entries"][0]["name"] == "X"
