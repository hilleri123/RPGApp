# plugins/gumshoe/attack/stages/attack_damage.py
from __future__ import annotations
from typing import Any
import random
from pydantic import BaseModel

from plugins.common.types import Workflow, SubmitResult, SceneContext
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import AttackContext, AttackEntry
from ....helpers import roll_dice
from ....types import NpcData, ItemData, CharacterData

from ....codex import SkillsCodex


class AttackDamageInput(BaseModel):
    damage_seed: str


def _get_target_armor(entry: AttackEntry, scene: SceneContext) -> int:
    """Броня цели: NPC → data.armor; персонаж → макс среди items[].data.armor."""
    if entry.targetNpcId:
        target = next(
            (n for n in (scene.npcs or []) if n.id == entry.targetNpcId), None
        )
        if target is None:
            return 0
        npc_data = NpcData.model_validate(target.data)
        return npc_data.armor or 0

    if entry.targetCharacterId:
        target = next(
            (ch for ch in (scene.characters or []) if ch.id == entry.targetCharacterId), None
        )
        if target is None:
            return 0
        armor_values = [
            it.data.get("armor") or 0
            for it in (target.items or [])
            if isinstance(it.data, dict) and it.data.get("armor")
        ]
        return max(armor_values, default=0)

    return 0


def _get_damage_expr(entry: AttackEntry, scene: SceneContext) -> tuple[str, str]:
    """
    Возвращает (damage_expr, error_msg).
    Атакующий персонаж → weapon.damage
    Атакующий NPC      → NPCAttack.attack_dmg
    """
    if entry.attackerCharacterId:
        attacker = next(
            (ch for ch in (scene.characters or []) if ch.id == entry.attackerCharacterId), None
        )
        if attacker is None:
            return "", "Attacker character not found"
        weapon_item = next(
            (it for it in (attacker.items or []) if it.id == entry.weaponItemId), None
        )
        if weapon_item is None:
            return "", "Weapon item not found"
        item_data = ItemData.model_validate(weapon_item.data)
        if item_data.weapon is None:
            return "", "Item is not a weapon"
        return item_data.weapon.damage, ""

    if entry.attackerNpcId:
        attacker = next(
            (n for n in (scene.npcs or []) if n.id == entry.attackerNpcId), None
        )
        if attacker is None:
            return "", "Attacker NPC not found"
        npc_data = NpcData.model_validate(attacker.data)
        atk = next((a for a in (npc_data.attacks or []) if a.name == entry.attackName), None)
        if atk is None:
            return "", f"NPC attack '{entry.attackName}' not found"
        return atk.attack_dmg, ""

    return "", "No attacker found"


class AttackDamageStage(BaseStage):
    key = "gumshoe.attack.damage"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(field, msg):
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = AttackContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        parsed = ctx.rb.parse_input(AttackDamageInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        is_gm = ctx.actor_user_id == ctx.participants.gmUserId

        if not is_gm and entry.attackerUserId != ctx.actor_user_id:
            return err("", "Only attacker or GM can roll damage")

        scene = ctx.scene

        # ── Формула урона ──────────────────────────────────────────────────────
        damage_expr, expr_err = _get_damage_expr(entry, scene)
        if expr_err:
            return err("damage", expr_err)

        rng = random.Random(parsed.damage_seed)
        try:
            total, rolls, modifier = roll_dice(damage_expr, rng)
        except ValueError as e:
            return err("damage", str(e))

        raw_damage = max(0, total)

        # ── Броня цели ─────────────────────────────────────────────────────────
        armor = _get_target_armor(entry, scene)
        final_damage = max(0, raw_damage - armor)

        entry.damage_seed     = parsed.damage_seed
        entry.damage_rolls    = rolls
        entry.damage_modifier = modifier
        entry.damage_total    = final_damage

        # ── Текст ──────────────────────────────────────────────────────────────
        target_name = entry.targetNpcName or entry.targetCharacterName or "цель"
        rolls_str = f"[{', '.join(str(r) for r in rolls)}]" if rolls else ""
        mod_str   = f" {modifier:+d}" if modifier else ""
        armor_str = f" − броня {armor}" if armor else ""

        # Текущее здоровье цели для отображения
        codex: SkillsCodex = self.full_codex.skills
        health_id = codex.health_skill().id
        current_health = _get_target_health(entry, scene, health_id)
        new_health = current_health - final_damage
        dead_str = " — цель повержена!" if new_health <= 0 else ""

        entry.damage_text = (
            f"Урон: {rolls_str}{mod_str} = {raw_damage}{armor_str} → {final_damage} | "
            f"HP {target_name}: {current_health} → {new_health}{dead_str}"
        )

        c.entry = entry
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "gumshoe.attack.result"

        return ctx.rb.result(
            ok=True, wf=wf, participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )


def _get_target_health(entry: AttackEntry, scene: SceneContext, health_id: str) -> int:
    if entry.targetNpcId:
        target = next((n for n in (scene.npcs or []) if n.id == entry.targetNpcId), None)
        if target is None:
            return 0
        npc_data = NpcData.model_validate(target.data)
        return (npc_data.skills or {}).get(health_id, 0)

    if entry.targetCharacterId:
        target = next(
            (ch for ch in (scene.characters or []) if ch.id == entry.targetCharacterId), None
        )
        if target is None:
            return 0
        char_data = CharacterData.model_validate(target.data)
        return (char_data.skills or {}).get(health_id, 0)

    return 0
