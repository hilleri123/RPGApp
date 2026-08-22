# characters_manager.py
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from plugins.common.types import ValidateResult, ValidationIssue
from .types import CharacterData  # где ты держишь CharacterData


def _pydantic_validate(model_cls: Any, payload: Any) -> Any:
    if hasattr(model_cls, "model_validate"):  # pydantic v2
        return model_cls.model_validate(payload)
    return model_cls.parse_obj(payload)  # pydantic v1


def _pydantic_dump(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):  # pydantic v2
        return model.model_dump()
    return model.dict()  # pydantic v1


class CharactersManager:
    kind = "character"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        # Можно расширять потом как угодно
        return {
            "initialData": {
                "profession": "",
                "tokens": 15,
            },
            "constraints": {
                "professionMinLen": 1,
                "professionMaxLen": 128,
            },
        }

    def validate_and_enrich(
        self,
        payload: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> ValidateResult:
        issues: list[ValidationIssue] = []
        cfg = self.config(context or {})
        constraints = cfg.get("constraints") or {}

        # 1) Pydantic validate
        try:
            ch = _pydantic_validate(CharacterData, payload)
        except ValidationError as e:
            for err in e.errors():  # loc/msg/type/input... [web:766]
                loc = ".".join(str(x) for x in err.get("loc", []) if x is not None)
                issues.append(
                    ValidationIssue(
                        path=f"data.{loc}" if loc else "data",
                        message=err.get("msg", "Invalid"),
                        icon="error",
                    )
                )
            return ValidateResult(ok=False, issues=issues, data=None)

        data = _pydantic_dump(ch)

        # 2) Нормализация/правила (без “наворотов”, но уже с местом под расширение)
        prof = str(data.get("profession") or "").strip()
        data["profession"] = prof

        min_len = int(constraints.get("professionMinLen", 1) or 1)
        max_len = int(constraints.get("professionMaxLen", 128) or 128)

        if len(prof) < min_len:
            issues.append(
                ValidationIssue(
                    path="data.profession",
                    message=f"Profession is required (min length {min_len})",
                    icon="error",
                )
            )

        if len(prof) > max_len:
            issues.append(
                ValidationIssue(
                    path="data.profession",
                    message=f"Profession is too long ({len(prof)} > {max_len})",
                    icon="error",
                )
            )

        if any(i.icon == "error" for i in issues):
            return ValidateResult(ok=False, issues=issues, data=None)

        # 3) enrich (пока ничего не добавляем)
        return ValidateResult(ok=True, issues=issues, data=data)
