"""NPC как «повод» хода: атака NPC идёт через фазы, урон NPC подставляет нужный куб."""
from __future__ import annotations

import importlib
from types import SimpleNamespace
from uuid import uuid4

importlib.import_module("app.main")

from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import (  # noqa: E402
    attacks_to_damage_claims,
    damage_quick_options,
    find_npc_attack,
    npc_attack_options,
)
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.stages.setup import (  # noqa: E402
    PerformMoveSetupStage,
)
from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import (  # noqa: E402
    PerformMoveEntry,
)


def _npc(attacks=None):
    return SimpleNamespace(
        id=uuid4(),
        name="Гоблин",
        data={
            "attacks": attacks
            if attacks is not None
            else [
                {"name": "Копьё", "damage": "d8+1", "range_tags": ["reach"], "attack_tags": ["messy"]},
                {"name": "Укус", "damage": "d6", "range_tags": ["hand"], "attack_tags": []},
                {"name": "Взгляд", "damage": ""},
            ]
        },
    )


def _scene(npc, ch=None):
    ch = ch or SimpleNamespace(id=uuid4(), name="Торин", data={"derived": {"damage_die": "d10"}})
    return SimpleNamespace(characters=[ch], npcs=[npc])


def test_attack_options_are_normalized_and_skip_empty_damage():
    opts = npc_attack_options(_npc())
    assert [o["name"] for o in opts] == ["Копьё", "Укус"]
    assert opts[0]["damage"] == "d8+1"
    assert opts[0]["description"] == "Копьё — d8+1 · reach, messy"
    assert find_npc_attack(_npc(), "Укус")["damage"] == "d6"
    assert find_npc_attack(_npc(), "нет") is None


def test_quick_options_carry_attack_description():
    npc = _npc()
    quick = [o for o in damage_quick_options(_scene(npc)) if o["kind"] == "npc_attack"]
    assert {o["attack_name"] for o in quick} == {"Копьё", "Укус"}
    spear = next(o for o in quick if o["attack_name"] == "Копьё")
    assert spear["damage_expr"] == "d8+1"
    assert spear["attack_tags"] == ["messy"]
    assert "Копьё" in spear["description"]


def test_claim_keeps_npc_attack_name():
    npc = _npc()
    scene = _scene(npc)
    target = scene.characters[0]
    claims = attacks_to_damage_claims(
        [
            {
                "source_kind": "npc",
                "source_id": str(npc.id),
                "target_kind": "character",
                "target_id": str(target.id),
                "damage_expr": "d8+1",
                "attack_id": "Копьё",
                "attack_name": "Копьё",
            },
            {
                "source_kind": "character",
                "source_id": str(target.id),
                "target_kind": "npc",
                "target_id": str(npc.id),
                "damage_expr": "d10",
                "attack_id": "",
                "attack_name": "Торин",
            },
        ],
        scene=scene,
    )
    assert claims[0].source_attack_id == "Копьё"
    assert claims[0].source_attack_name == "Копьё"
    # для не-NPC название «атаки» не фиксируется
    assert claims[1].source_attack_name == ""


class _RB:
    @staticmethod
    def result(**kw):
        return SimpleNamespace(ok=kw["ok"], issues=kw.get("issues"), workflow=kw.get("wf"))


def _ctx(scene):
    return SimpleNamespace(scene=scene, rb=_RB, participants=None, participants_dict={})


def test_resolve_npc_source_validates_attack():
    npc = _npc()
    ctx = _ctx(_scene(npc))
    stage = PerformMoveSetupStage.__new__(PerformMoveSetupStage)

    none = stage._resolve_npc_source(None, ctx, {})
    assert none == ("", "", None)

    ok = stage._resolve_npc_source(None, ctx, {"source_npc_id": str(npc.id), "source_attack_id": "Копьё"})
    npc_id, name, attack = ok
    assert npc_id == str(npc.id) and name == "Гоблин"
    assert attack.damage == "d8+1" and attack.description.startswith("Копьё")

    bad_attack = stage._resolve_npc_source(None, ctx, {"source_npc_id": str(npc.id), "source_attack_id": "x"})
    assert bad_attack.ok is False

    bad_npc = stage._resolve_npc_source(None, ctx, {"source_npc_id": str(uuid4())})
    assert bad_npc.ok is False


def test_entry_roundtrips_npc_attack():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.types import NpcAttackRef

    entry = PerformMoveEntry(actor_user_id=uuid4())
    entry.source_npc_id = "n1"
    entry.source_npc_name = "Гоблин"
    entry.npc_attack = NpcAttackRef(id="a", name="Копьё", damage="d8", description="Копьё — d8")
    dumped = entry.model_dump(mode="json")
    assert dumped["npc_attack"]["name"] == "Копьё"
    again = PerformMoveEntry.model_validate(dumped)
    assert again.npc_attack.damage == "d8" and again.source_npc_id == "n1"


# ── HP NPC: ноль — это ноль, а не «поле не задано» ─────────────────────────────

def _hp_ctx(npc_data):
    from types import SimpleNamespace as NS

    npc = NS(id=uuid4(), name="Гоблин", data=npc_data, tags=["enemy"])
    return NS(scene=NS(characters=[], npcs=[npc])), npc


def test_damage_does_not_revive_npc_with_zero_hp():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move import engine

    ctx, npc = _hp_ctx({"hp": 6, "hp_current": 0, "armor": 0})
    eff = SimpleNamespace(payload={"target_kind": "npc", "target_id": str(npc.id), "fixed_damage": 3})
    patch = engine._apply_fixed_damage(ctx, eff)
    assert patch["npcs"][0]["dataPatch"]["hp_current"] == 0
    assert patch["npcs"][0]["dataPatch"]["hp"] == 6


def test_damage_uses_stored_current_hp_and_full_when_missing():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move import engine

    ctx, npc = _hp_ctx({"hp": 6, "hp_current": 3})
    eff = SimpleNamespace(payload={"target_kind": "npc", "target_id": str(npc.id), "fixed_damage": 2})
    assert engine._apply_fixed_damage(ctx, eff)["npcs"][0]["dataPatch"]["hp_current"] == 1

    # hp_current не сохранён вовсе → NPC целый: считаем от максимума, а не от дефолта модели
    ctx2, npc2 = _hp_ctx({"hp": 20})
    eff2 = SimpleNamespace(payload={"target_kind": "npc", "target_id": str(npc2.id), "fixed_damage": 5})
    assert engine._apply_fixed_damage(ctx2, eff2)["npcs"][0]["dataPatch"]["hp_current"] == 15


def test_heal_from_zero_adds_only_the_amount_and_revives():
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move import engine

    ctx, npc = _hp_ctx({"hp": 6, "hp_current": 0})
    npc.tags = ["enemy", "dead"]
    patch = engine._apply_fixed_heal(ctx, "npc", str(npc.id), 2)
    item = patch["npcs"][0]
    assert item["dataPatch"]["hp_current"] == 2
    assert "dead" not in item["tagsPatch"]
