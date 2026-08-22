# plugins/gumshoe/attack/stages/attack_setup.py
from __future__ import annotations
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, NonNegativeInt

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import AttackContext, AttackEntry
from ....types import CharacterData, ItemData, WeaponType, NpcData
from ....codex import SkillsCodex, FullCodex


class AttackSetupInput(BaseModel):
    # атакующий (GM может переопределить)
    attacker_character_id: Optional[UUID] = None
    attacker_npc_id:       Optional[UUID] = None

    # цель
    target_npc_id:       Optional[UUID] = None
    target_character_id: Optional[UUID] = None

    # оружие/атака
    weapon_item_id:  Optional[UUID] = None  # если атакует персонаж
    attack_name:     Optional[str]  = None  # если атакует NPC

    weapon_mode:   WeaponType
    skill_points:  NonNegativeInt = 0


class AttackSetupStage(BaseStage):
    key = "gumshoe.attack.setup"
    def __init__(self, full_codex: FullCodex):
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

        parsed = ctx.rb.parse_input(AttackSetupInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        is_gm = ctx.actor_user_id == ctx.participants.gmUserId
        scene = ctx.scene
        codex: SkillsCodex = self.full_codex.skills

        # ── 1. Определяем атакующего ──────────────────────────────────────────

        if is_gm:
            # GM может выбрать атакующего явно
            if parsed.attacker_npc_id:
                attacker_npc = next(
                    (n for n in (scene.npcs or []) if n.id == parsed.attacker_npc_id), None
                )
                if attacker_npc is None:
                    return err("attacker_npc_id", "Attacker NPC not found")
                entry.attackerNpcId       = attacker_npc.id
                entry.attackerCharacterId = None
            elif parsed.attacker_character_id:
                attacker_char = next(
                    (ch for ch in (scene.characters or [])
                     if ch.id == parsed.attacker_character_id), None
                )
                if attacker_char is None:
                    return err("attacker_character_id", "Character not found")
                entry.attackerCharacterId = attacker_char.id
                entry.attackerNpcId       = None
            else:
                return err("attacker_character_id", "GM must choose attacker")
        else:
            # Игрок — только его персонаж
            if entry.attackerCharacterId is None:
                return err("attackerCharacterId", "No character assigned to player")
            attacker_char = next(
                (ch for ch in (scene.characters or [])
                 if ch.id == entry.attackerCharacterId), None
            )
            if attacker_char is None:
                return err("attackerCharacterId", "Character not found in scene")

        # ── 2. Определяем цель ────────────────────────────────────────────────

        if parsed.target_npc_id:
            target_npc = next(
                (n for n in (scene.npcs or []) if n.id == parsed.target_npc_id), None
            )
            if target_npc is None:
                return err("target_npc_id", "Target NPC not found")
            entry.targetNpcId          = target_npc.id
            entry.targetNpcName        = target_npc.name or ""
            entry.targetCharacterId    = None
            entry.targetCharacterName  = ""

        elif parsed.target_character_id:
            if not is_gm:
                return err("target_character_id", "Player can only target NPCs")
            target_char = next(
                (ch for ch in (scene.characters or [])
                 if ch.id == parsed.target_character_id), None
            )
            if target_char is None:
                return err("target_character_id", "Target character not found")
            entry.targetCharacterId   = target_char.id
            entry.targetCharacterName = target_char.name or ""
            entry.targetNpcId         = None
            entry.targetNpcName       = ""
        else:
            return err("target_npc_id", "Target is required")

        # ── 3. Оружие / атака ────────────────────────────────────────────────

        if entry.attackerCharacterId:
            # персонаж → оружие из items
            char = next(
                (ch for ch in (scene.characters or [])
                 if ch.id == entry.attackerCharacterId), None
            )
            if parsed.weapon_item_id is None:
                return err("weapon_item_id", "Weapon is required for character attacker")

            weapon = next(
                (it for it in (char.items or []) if it.id == parsed.weapon_item_id), None
            )
            if weapon is None:
                return err("weapon_item_id", "Weapon not found on character")

            weapon_data = ItemData.model_validate(weapon.data)
            if weapon_data.weapon is None:
                return err("weapon_item_id", "Item is not a weapon")

            entry.weaponItemId = weapon.id
            entry.weaponName   = weapon.name or ""
            entry.attackName   = ""

            # Проверяем скилл
            skill = codex.attack_skill(parsed.weapon_mode)
            char_data = CharacterData.model_validate(char.data)
            available = char_data.skills.get(skill.id, 0)
            if parsed.skill_points > available:
                return err(
                    "skill_points",
                    f"Character has only {available} pts of {skill.title}, "
                    f"but {parsed.skill_points} spent",
                )
            entry.skill_id     = skill.id
            entry.skill_points = parsed.skill_points

        elif entry.attackerNpcId:
            # NPC → атака из npc.data.attacks
            attacker_npc = next(
                (n for n in (scene.npcs or []) if n.id == entry.attackerNpcId), None
            )
            npc_data = NpcData.model_validate(attacker_npc.data)

            if not parsed.attack_name:
                return err("attack_name", "Attack name is required for NPC attacker")

            npc_attack = next(
                (a for a in (npc_data.attacks or []) if a.name == parsed.attack_name), None
            )
            if npc_attack is None:
                return err("attack_name", f"Attack '{parsed.attack_name}' not found on NPC")

            entry.weaponItemId = None
            entry.weaponName   = ""
            entry.attackName   = npc_attack.name
            entry.skill_id     = npc_attack.attack_skill
            entry.skill_points = parsed.skill_points

        # ── 4. Режим атаки ───────────────────────────────────────────────────
        entry.weaponMode = parsed.weapon_mode

        c.entry = entry
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "gumshoe.attack.roll"

        return ctx.rb.result(
            ok=True, wf=wf, participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            can_close=True,
        )
