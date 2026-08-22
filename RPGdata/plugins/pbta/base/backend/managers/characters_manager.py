from __future__ import annotations

from typing import Any, Type
from pydantic import ValidationError

from plugins.common.types import ValidateResult, ValidationIssue
from plugins.common.protocols import PluginPayload
from ..types import CharacterData, Playbook
from ..codex import PbtaFullCodex


class CharactersManager:
    """
    Базовый менеджер персонажей для любой PbtA.

    Содержит только общее:
    - схемная валидация CharacterData
    - проверка: статы известны и все присутствуют
    - проверка: плейбук существует
    - проверка: ходы допустимы для плейбука

    Конкретная игра наследуется и переопределяет:
    - data_model             — pydantic-модель данных персонажа
    - _validate_stats        — диапазоны, массивы и т.п.
    - _validate_extra        — уровни, load, hp и т.п.
    - _default_stat_value    — стартовое значение стата
    - _constraints           — ограничения для фронта
    """

    kind = "character"

    def __init__(self, codex: PbtaFullCodex) -> None:
        self.codex = codex

    # ── model hook ───────────────────────────────────────────────────────────

    def data_model(self) -> Type[CharacterData]:
        return CharacterData

    # ── config ───────────────────────────────────────────────────────────────

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "pbta": {**self.codex.as_config()},
            "constraints": self._constraints(),
            "initialData": self.init(context),
        }

    def schema(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "pbta": {**self.codex.as_config()},
            "constraints": self._constraints(),
        }

    def options(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        ctx = context or {}
        playbook_id = ctx.get("playbook_id") or (ctx.get("data") or {}).get("playbook_id")
        level = ctx.get("level")
        if level is None:
            level = (ctx.get("data") or {}).get("level", 1)
        try:
            level = int(level)
        except (TypeError, ValueError):
            level = 1

        if not playbook_id:
            return {}

        pb_map = self.codex.playbooks.playbooks_map()
        pb = pb_map.get(playbook_id)
        if not pb:
            return {"playbook_id": playbook_id, "allowed_move_ids": []}

        basic_ids = {m.id for m in self.codex.moves.get_basic()}
        master = set(getattr(pb, "advanced_moves_6_10", None) or [])
        choice_ids = {
            mid
            for group in (getattr(pb, "starting_move_choices", None) or [])
            for mid in group
        }
        allowed = (
            set(pb.starting_moves)
            | choice_ids
            | set(pb.advanced_moves)
            | master
            | basic_ids
        )
        for race in getattr(pb, "races", None) or []:
            allowed.add(race.move_id)
        if level < 2:
            allowed -= set(pb.advanced_moves)
        if level < 6:
            allowed -= master

        return {
            "playbook_id": playbook_id,
            "level": level,
            "allowed_move_ids": sorted(allowed),
            "starting_move_ids": list(pb.starting_moves),
            "advanced_move_ids": list(pb.advanced_moves),
            "advanced_move_ids_6_10": list(getattr(pb, "advanced_moves_6_10", None) or []),
        }

    def _constraints(self) -> dict[str, Any]:
        return {}

    # ── init ─────────────────────────────────────────────────────────────────

    def init(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        stat_ids = self.codex.skills.get_ids()
        return self.data_model()(
            playbook_id="",
            moves=[],
            stats={sid: self._default_stat_value() for sid in stat_ids},
            state={},
        ).model_dump(mode="json")

    def _default_stat_value(self) -> int:
        return 0

    # ── validate & enrich ────────────────────────────────────────────────────

    def validate_and_enrich(
        self,
        payload: PluginPayload,
        context: dict[str, Any] | None = None,
    ) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            ch = self.data_model().model_validate(payload["data"])
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(
                    path=f"data.{loc}" if loc else "data",
                    message=err.get("msg", "Invalid"),
                    icon="error",
                ))
            return ValidateResult(ok=False, issues=issues, result=None)

        skills_map = self.codex.skills.skills_map()
        pb_map     = self.codex.playbooks.playbooks_map()
        moves_map  = self.codex.moves.moves_map()
        basic_ids  = {m.id for m in self.codex.moves.get_basic()}

        issues += self._validate_stats(ch, skills_map)

        pb = None
        playbook_id = self._get_playbook_id(ch)
        if playbook_id:
            pb, pb_issues = self._validate_playbook(ch, pb_map, moves_map, basic_ids)
            issues += pb_issues
        elif ch.moves:
            issues.append(ValidationIssue(
                path="data.moves",
                message="Character has moves but no playbook selected",
                icon="warning",
            ))

        issues += self._validate_move_overrides(ch, moves_map)
        issues += self._validate_extra(ch, pb)

        if issues:
            return ValidateResult(ok=False, issues=issues, result=None)

        ch = self._enrich_base(ch, pb)
        ch = self._enrich_derived(ch, pb)   # ← теперь возвращает CharacterData

        result = PluginPayload(data=ch.model_dump(mode="json"), tags=payload.get("tags", []))
        return ValidateResult(ok=True, issues=[], result=result)

    # ── hooks ────────────────────────────────────────────────────────────────

    def _enrich_base(self, ch: CharacterData, pb: Playbook) -> CharacterData:
        return ch

    def _enrich_derived(
        self,
        ch: CharacterData,
        pb: Playbook,
    ) -> CharacterData:
        """Заполняет вычисляемые поля прямо в модели."""
        stats = self._get_stats(ch)
        ch.stat_modifiers = {
            sid: self.codex.skills.get_modifier(val)
            for sid, val in stats.items()
        }
        return ch

    # ── helpers ──────────────────────────────────────────────────────────────

    def _get_playbook_id(self, ch: CharacterData) -> str:
        return ch.playbook_id or ""

    def _get_stats(self, ch: CharacterData) -> dict[str, int]:
        return ch.stats or {}

    # ── validation ───────────────────────────────────────────────────────────

    def _validate_stats(
        self,
        ch: CharacterData,
        skills_map: dict,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        stats = self._get_stats(ch)

        for sid in stats:
            if sid not in skills_map:
                issues.append(ValidationIssue(
                    path=f"data.stats.{sid}",
                    message=f"Unknown stat: '{sid}'",
                    icon="error",
                ))

        for sid in skills_map:
            if sid not in stats:
                issues.append(ValidationIssue(
                    path=f"data.stats.{sid}",
                    message=f"Missing required stat: '{sid}'",
                    icon="error",
                ))

        return issues

    def _validate_playbook(
        self,
        ch: CharacterData,
        pb_map: dict,
        moves_map: dict,
        basic_ids: set[str],
    ) -> tuple[Any, list[ValidationIssue]]:
        issues: list[ValidationIssue] = []
        playbook_id = self._get_playbook_id(ch)
        pb: Playbook = pb_map.get(playbook_id)

        if not pb:
            issues.append(ValidationIssue(
                path="data.playbook_id",
                message=f"Unknown playbook: '{playbook_id}'",
                icon="error",
            ))
            return None, issues

        missing = [mid for mid in pb.starting_moves if mid not in ch.moves]
        if missing:
            issues.append(ValidationIssue(
                path="data.moves",
                message=f"Missing mandatory starting moves for '{pb.id}': {', '.join(missing)}",
                icon="warning",
            ))

        choice_groups: list[list[str]] = list(
            getattr(pb, "starting_move_choices", None) or []
        )
        choice_ids: set[str] = set()
        for group in choice_groups:
            choice_ids.update(group)
            picked = [mid for mid in group if mid in ch.moves]
            if len(picked) == 0:
                issues.append(ValidationIssue(
                    path="data.moves",
                    message=(
                        f"Choose one starting move for '{pb.id}': "
                        + " or ".join(group)
                    ),
                    icon="warning",
                ))
            elif len(picked) > 1:
                issues.append(ValidationIssue(
                    path="data.moves",
                    message=(
                        f"Only one starting move allowed from group for '{pb.id}': "
                        + ", ".join(picked)
                    ),
                    icon="warning",
                ))

        master = set(getattr(pb, "advanced_moves_6_10", None) or [])
        allowed = (
            set(pb.starting_moves)
            | choice_ids
            | set(pb.advanced_moves)
            | master
            | basic_ids
        )
        for race in getattr(pb, "races", None) or []:
            allowed.add(race.move_id)
        for mid in ch.moves:
            if mid not in moves_map:
                issues.append(ValidationIssue(
                    path="data.moves",
                    message=f"Unknown move: '{mid}'",
                    icon="error",
                ))
            elif mid not in allowed:
                issues.append(ValidationIssue(
                    path="data.moves",
                    message=f"Move '{mid}' is not available for playbook '{playbook_id}'",
                    icon="warning",
                ))

        return pb, issues

    def _validate_move_overrides(
        self,
        ch: CharacterData,
        moves_map: dict,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        custom_ids = {cm.id for cm in (ch.custom_moves or [])}
        active = set(ch.moves or [])

        for mid in (ch.move_overrides or {}):
            if mid not in active:
                issues.append(ValidationIssue(
                    path=f"data.move_overrides.{mid}",
                    message=f"Override for inactive move '{mid}'",
                    icon="warning",
                ))
                continue
            if mid in custom_ids:
                issues.append(ValidationIssue(
                    path=f"data.move_overrides.{mid}",
                    message=f"Use custom_moves for '{mid}', not move_overrides",
                    icon="warning",
                ))
                continue
            if mid not in moves_map:
                issues.append(ValidationIssue(
                    path=f"data.move_overrides.{mid}",
                    message=f"Unknown move id in override: '{mid}'",
                    icon="error",
                ))

        return issues

    # ── hooks ────────────────────────────────────────────────────────────────

    def _validate_extra(
        self,
        ch: CharacterData,
        pb: Playbook,
    ) -> list[ValidationIssue]:
        return []
