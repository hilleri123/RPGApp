"""Контексты сцены для ходов DW: action / camp / travel.

Соответствие режимам сцены:
- action  — бой, опасность, исследование «здесь и сейчас»
- camp    — привал, поселение, отдых, закупки, пирушка
- travel  — путь, переходы, следопытство в дикой местности
"""

from __future__ import annotations

from plugins.pbta.base.backend.types import Move, MoveCondition

ACTION = ["action"]
CAMP = ["camp"]
TRAVEL = ["travel"]
ACTION_CAMP = ["action", "camp"]
ACTION_TRAVEL = ["action", "travel"]
CAMP_TRAVEL = ["camp", "travel"]
ALL_SCENES = ["action", "camp", "travel"]

# id хода → requires_context (базовые заданы в moves.py, здесь — классовые и уточнения)
MOVE_CONTEXT_BY_ID: dict[str, list[str]] = {
    # ── базовые (дублируем для единого справочника; в moves.py уже проставлено) ──
    "help_or_hinder": ALL_SCENES,
    # ── Воин ──
    "fighter_bend_bars_lift_gates": ACTION,
    "fighter_through_death": ACTION,
    # ── Жрец ──
    "cleric_prayer": CAMP,
    "cleric_cast_a_spell": ACTION,
    "cleric_turn_undead": ACTION,
    "cleric_divine_intervention": ACTION_CAMP,
    "cleric_pray_for_guidance": ACTION_CAMP,
    # ── Бард ──
    "bard_bardic_lore": ACTION_TRAVEL,
    "bard_charming_and_open": ACTION_CAMP,
    "bard_arcane_art": ACTION_CAMP,
    "bard_an_ear_for_magic": CAMP,
    "bard_eldritch_chord": ACTION,
    "bard_duelist_block": ACTION,
    "bard_reputation": CAMP,
    # ── Вор ──
    "thief_tricks_of_the_trade": ACTION,
    "thief_flexible_morals": CAMP,
    "thief_backstab": ACTION,
    "thief_poisoner": CAMP,
    "thief_envenom": ACTION,
    "thief_second_story_work": ACTION,
    "thief_shoot_first": ACTION,
    # ── Волшебник ──
    "wizard_prepare_spells": CAMP,
    "wizard_cast_a_spell": ACTION,
    "wizard_fount_of_knowledge": ACTION_TRAVEL,
    "wizard_ritual": CAMP,
    # ── Следопыт ──
    "ranger_hunt_and_track": TRAVEL,
    "ranger_called_shot": ACTION,
    "ranger_animal_companion": CAMP,
    "ranger_command": ALL_SCENES,
    "ranger_familiar_prey": ACTION_TRAVEL,
    "ranger_my_prey": ACTION_TRAVEL,
    "ranger_camouflage": ACTION,
    "ranger_viper_strike": ACTION,
    "ranger_viper_fangs": ACTION,
    "ranger_friend_of_beast": ACTION,
    "ranger_hail_of_arrows": ACTION,
    "ranger_follow_me": TRAVEL,
    "ranger_wanderer": TRAVEL,
    "ranger_safe_camp": CAMP,
    "ranger_really_safe_camp": CAMP,
    "ranger_bird_of_god": CAMP,
    "ranger_watcher": TRAVEL,
    # ── Паладин ──
    "paladin_lay_on_hands": ACTION_CAMP,
    "paladin_i_am_the_law": ACTION,
    "paladin_quest": CAMP,
    "paladin_bloody_shield": ACTION,
    "paladin_exterminatus": ACTION,
    "paladin_coordinated_attack": ACTION,
    "paladin_joint_attack": ACTION,
    "paladin_hospitaller": ACTION_CAMP,
    "paladin_perfect_hospitaller": ACTION_CAMP,
    "paladin_mark_of_faith": ACTION,
    # ── Друид ──
    "druid_shapeshifter": ACTION,
    "druid_spirit_whispers": ACTION,
    "druid_lord_of_elements": ACTION,
}


def tag_move_for_scene(m: Move) -> Move:
    """Проставляет condition.requires_context, если ещё не задан."""
    ctx = MOVE_CONTEXT_BY_ID.get(m.id)

    if ctx is None and m.kind in ("class", "advanced"):
        if not getattr(m, "requires_roll", True):
            return m
        existing = getattr(m, "condition", None)
        if existing and list(getattr(existing, "requires_context", None) or []):
            return m
        ctx = ACTION

    if ctx is None:
        return m

    existing = getattr(m, "condition", None)
    if existing and list(getattr(existing, "requires_context", None) or []):
        return m

    base = existing.model_dump() if existing is not None else {}
    base["requires_context"] = ctx
    return m.model_copy(update={"condition": MoveCondition.model_validate(base)})


def tag_moves_for_scene(moves: list[Move]) -> list[Move]:
    return [tag_move_for_scene(m) for m in moves]
