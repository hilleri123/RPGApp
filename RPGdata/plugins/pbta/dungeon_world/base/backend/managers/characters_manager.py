from __future__ import annotations

from itertools import permutations
from typing import Any, Type

from plugins.common.types import ValidationIssue
from plugins.pbta.base.backend.managers import CharactersManager as PbtaCharactersManager
from ..types import CharacterData, Playbook
from ..codex import FullCodex

_STAT_MIN = 3
_STAT_MAX = 18

STAT_ARRAYS: list[frozenset[int]] = [
    frozenset([16, 15, 13, 12, 9, 8]),
    frozenset([17, 15, 13, 11, 9, 8]),
    frozenset([16, 16, 13, 12, 9, 8]),
    frozenset([17, 15, 12, 11, 10, 8]),
]


def _stat_spread_matches_dw_progression(
    stats: dict[str, int],
    skill_ids: list[str],
    level: int,
) -> bool:
    """Проверка: статы = один из стандартных массивов + (level−1) повышений по +1."""
    if len(skill_ids) != len(stats):
        return True
    extra = max(0, int(level or 1) - 1)
    ordered_ids = [sid for sid in skill_ids if sid in stats]
    if len(ordered_ids) != len(skill_ids):
        return True
    current = [int(stats[sid]) for sid in ordered_ids]

    if extra == 0:
        return frozenset(current) in STAT_ARRAYS

    for base in STAT_ARRAYS:
        base_list = list(base)
        for perm in permutations(base_list):
            bumps = [current[i] - perm[i] for i in range(len(current))]
            if all(b >= 0 for b in bumps) and sum(bumps) == extra:
                if all(current[i] <= _STAT_MAX for i in range(len(current))):
                    return True
    return False


class CharactersManager(PbtaCharactersManager):
    kind = "character"

    def __init__(self, full_codex: FullCodex):
        super().__init__(codex=full_codex)
        self.codex: FullCodex

    def data_model(self) -> Type[CharacterData]:
        return CharacterData

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        data = super().config(context)
        data["nameGenerators"] = self.codex.name_generators.as_config()
        return data

    def _constraints(self) -> dict[str, Any]:
        return {
            "stat_min": _STAT_MIN,
            "stat_max": _STAT_MAX,
            "stat_arrays": [sorted(a, reverse=True) for a in STAT_ARRAYS],
        }

    def _default_stat_value(self) -> int:
        return 10

    def init(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        data = super().init(context)
        data["hp"] = 0
        data["max_hp"] = 0
        data["level"] = 1
        data["xp"] = 0
        data["armor_cache"] = 0
        return data

    def _validate_stats(
        self,
        ch: CharacterData,
        skills_map: dict,
    ) -> list[ValidationIssue]:
        issues = super()._validate_stats(ch, skills_map)
        stats = ch.stats

        valid_stat_ids: set[str] = set()

        for sid, val in stats.items():
            if sid not in skills_map:
                continue

            if not (_STAT_MIN <= val <= _STAT_MAX):
                issues.append(ValidationIssue(
                    path=f"data.stats.{sid}",
                    message=f"Stat '{sid}' = {val} is out of range ({_STAT_MIN}–{_STAT_MAX})",
                    icon="error",
                ))
                continue

            valid_stat_ids.add(sid)

        if valid_stat_ids == set(skills_map.keys()):
            level = int(getattr(ch, "level", 1) or 1)
            if not _stat_spread_matches_dw_progression(
                stats,
                list(skills_map.keys()),
                level,
            ):
                issues.append(ValidationIssue(
                    path="data.stats",
                    message="Stat spread doesn't match any standard DW array — make sure this is intentional",
                    icon="warning",
                ))

        return issues

    def _validate_extra(
        self,
        ch: CharacterData,
        pb: Playbook,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        if pb:
            advanced_chosen = [mid for mid in ch.moves if mid in pb.advanced_moves]
            if advanced_chosen and ch.level < 2:
                issues.append(ValidationIssue(
                    path="data.moves",
                    message=f"Advanced moves require level 2 or higher (current: {ch.level})",
                    icon="warning",
                ))
            master_ids = set(getattr(pb, "advanced_moves_6_10", None) or [])
            master_chosen = [mid for mid in ch.moves if mid in master_ids]
            if master_chosen and ch.level < 6:
                issues.append(ValidationIssue(
                    path="data.moves",
                    message=f"Moves for levels 6–10 require level 6 or higher (current: {ch.level})",
                    icon="warning",
                ))

        if ch.hp < 0:
            issues.append(ValidationIssue(
                path="data.hp",
                message="HP cannot be negative",
                icon="error",
            ))

        if ch.max_hp < 0:
            issues.append(ValidationIssue(
                path="data.max_hp",
                message="Max HP cannot be negative",
                icon="error",
            ))

        if ch.level < 1:
            issues.append(ValidationIssue(
                path="data.level",
                message="Level must be at least 1",
                icon="error",
            ))

        if ch.xp < 0:
            issues.append(ValidationIssue(
                path="data.xp",
                message="XP cannot be negative",
                icon="error",
            ))

        if ch.armor_cache < 0:
            issues.append(ValidationIssue(
                path="data.armor_cache",
                message="Armor cannot be negative",
                icon="error",
            ))

        if pb:
            race_ids = {r.id for r in pb.races}
            if ch.race_id and ch.race_id not in race_ids:
                issues.append(ValidationIssue(
                    path="data.race_id",
                    message=f"Unknown race '{ch.race_id}' for playbook '{pb.id}'",
                    icon="error",
                ))
            align_ids = {a.id for a in pb.alignments}
            if ch.alignment_id and ch.alignment_id not in align_ids:
                issues.append(ValidationIssue(
                    path="data.alignment_id",
                    message=f"Unknown alignment '{ch.alignment_id}' for playbook '{pb.id}'",
                    icon="error",
                ))
            if pb.races and not ch.race_id:
                issues.append(ValidationIssue(
                    path="data.race_id",
                    message="Choose a race for this class",
                    icon="warning",
                ))
            if pb.alignments and not ch.alignment_id:
                issues.append(ValidationIssue(
                    path="data.alignment_id",
                    message="Choose an alignment for this class",
                    icon="warning",
                ))

        return issues

    def _enrich_base(self, ch: CharacterData, pb: Playbook) -> CharacterData:
        if pb:
            con_score = int(ch.stats.get("con", 10))
            ch.max_hp = pb.base_hp + con_score
            if ch.hp == 0:
                ch.hp = ch.max_hp
        ch = self._sync_race_move(ch, pb)
        return ch

    def _sync_race_move(self, ch: CharacterData, pb: Playbook | None) -> CharacterData:
        if not pb or not ch.race_id:
            return ch
        race_opt = next((r for r in pb.races if r.id == ch.race_id), None)
        if not race_opt:
            return ch
        moves = list(ch.moves or [])
        if race_opt.move_id not in moves:
            moves.append(race_opt.move_id)
            ch.moves = moves
        return ch

    def _enrich_derived(
        self,
        ch: CharacterData,
        pb: Playbook,
    ) -> CharacterData:
        # Сначала базовые модификаторы (stat_modifiers)
        ch = super()._enrich_derived(ch, pb)
        return ch