from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_serializer, model_validator

from plugins.pbta.base.backend.workflows.perform_move.types import (
    EffectRecord,
    PendingChoice,
    PerformMoveContext as PerformMoveContextBase,
    PerformMoveEntry as PerformMoveEntryBase,
)


DamageSourceKind = Literal["character", "npc", "world"]
DamageTargetKind = Literal["character", "npc"]
HpEffectKind = Literal["damage", "heal"]
ResourceEntityKind = Literal["character", "npc", "none"]
AffectedEntityKind = Literal["character", "npc"]


class DieAllocation(BaseModel):
    die_index: int = 0
    value: int = 0
    target_kind: DamageTargetKind = "npc"
    target_character_id: Optional[str] = None
    target_npc_id: Optional[str] = None


class DamageClaim(BaseModel):
    id: str

    source_kind: DamageSourceKind = "character"
    source_character_id: Optional[str] = None
    source_npc_id: Optional[str] = None
    source_label: str = ""
    source_move_id: str = ""
    # Атака NPC, которой нанесён урон (только для source_kind == "npc").
    source_attack_id: str = ""
    source_attack_name: str = ""

    target_kind: DamageTargetKind = "npc"
    target_character_id: Optional[str] = None
    target_npc_id: Optional[str] = None
    target_label: str = ""

    formula: str = ""
    preset_formula: str = ""
    hp_effect: HpEffectKind = "damage"
    tags: list[str] = Field(default_factory=list)
    piercing: int = 0
    ignores_armor: bool = False
    multiplier: float = 1.0
    half_damage: bool = False

    counter_move_id: str = ""
    counter_move_title: str = ""

    # Кто бросает кубы этой заявки (мастер или игрок)
    roller_user_id: Optional[str] = None
    roller_character_id: Optional[str] = None
    roller_label: str = ""

    roll_seed: str = ""
    dice: list[int] = Field(default_factory=list)
    dice_allocations: list[DieAllocation] = Field(default_factory=list)
    flat_bonus: int = 0
    total_raw: int = 0
    armor_applied: int = 0
    total_final: int = 0

    needs_roll: bool = True
    rolled: bool = False
    applied: bool = False
    cancelled: bool = False
    cancel_reason: str = ""


class AffectedEntity(BaseModel):
    """Сущность, на которую повлиял ход — цель выдачи ресурсов в grant-wizard."""
    kind: AffectedEntityKind = "character"
    id: str
    name: str = ""
    done: bool = False


class ResourceDraft(BaseModel):
    id: str
    move_id: str = ""
    move_title: str = ""
    mod_index: int = 0
    spec_id: str = ""
    mod_kind: str = "add"
    amount: int = 0
    target_kind: ResourceEntityKind = "none"
    target_id: str = ""
    description: str = ""
    filter_stats: list[str] = Field(default_factory=list)
    filter_moves: list[str] = Field(default_factory=list)
    filter_tags: list[str] = Field(default_factory=list)
    confirmed: bool = False
    skipped: bool = False
    factory_id: str = ""


class ResourceGrant(BaseModel):
    id: str = ""
    spec_id: str = ""
    amount: int = 1
    target_kind: ResourceEntityKind = "character"
    target_id: str = ""
    filter_stats: list[str] = Field(default_factory=list)
    filter_moves: list[str] = Field(default_factory=list)
    filter_tags: list[str] = Field(default_factory=list)
    description: str = ""
    source_move_id: str = ""
    factory_id: str = ""


class ResolveState(BaseModel):
    """Outcome of perform_move.resolve — effects, choices, resource drafts, logs."""

    effects: list[EffectRecord] = Field(default_factory=list)
    pending_choices: list[PendingChoice] = Field(default_factory=list)
    resource_drafts: list[ResourceDraft] = Field(default_factory=list)
    log_lines: list[str] = Field(default_factory=list)


class NpcAttackRef(BaseModel):
    """Снимок атаки NPC, выбранной мастером при старте хода (идёт через все фазы)."""
    id: str = ""
    name: str = ""
    damage: str = ""
    range_tags: list[str] = Field(default_factory=list)
    attack_tags: list[str] = Field(default_factory=list)
    description: str = ""


class PerformMoveEntry(PerformMoveEntryBase):
    # NPC не выполняет ход сам, но может быть его «поводом» (заставляет уклоняться и т.п.):
    # действует персонаж (actor_*), а NPC и его атака лишь сопровождают ход.
    source_npc_id: Optional[str] = None
    source_npc_name: str = ""
    npc_attack: Optional[NpcAttackRef] = None
    resolve: ResolveState = Field(default_factory=ResolveState)
    damage_claims: list[DamageClaim] = Field(default_factory=list)
    resource_grants: list[ResourceGrant] = Field(default_factory=list)
    affected_entities: list[AffectedEntity] = Field(default_factory=list)
    grant_cursor: int = 0
    resource_bonus_total: int = 0
    scene_context_tags: list[str] = Field(default_factory=list)
    # Optional spell chosen at declare (cast via perform_move)
    cast_spell_entry_id: str = ""
    cast_spell_id: str = ""
    cast_spell_title: str = ""
    # When True and cast_spell_entry_id is set, unprepare that spell on the caster at apply.
    # Default True (9-); after roll 10+ is set to False automatically.
    unprepare_cast_spell: bool = True
    # Косяк на 7–9: произвольный текст мастера («что пошло не так»). Только hit_7_9.
    gm_complication: str = ""

    @model_validator(mode="before")
    @classmethod
    def _migrate_flat_resolve(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        resolve_raw = dict(payload.get("resolve") or {})
        for key in ("effects", "pending_choices", "log_lines", "resource_drafts"):
            flat = payload.get(key)
            if flat and not resolve_raw.get(key):
                resolve_raw[key] = flat
            payload.pop(key, None)
        payload["resolve"] = resolve_raw
        return payload

    @model_serializer(mode="wrap")
    def _serialize_entry(self, handler):
        data = handler(self)
        if isinstance(data, dict):
            for key in ("effects", "pending_choices", "log_lines", "resource_drafts"):
                data.pop(key, None)
        return data


class PerformMoveContext(PerformMoveContextBase):
    entry: PerformMoveEntry
