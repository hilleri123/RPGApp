# plugins/gumshoe/characters.py
from __future__ import annotations

from typing import Any

from .types import CharacterData          # с role, bonuses
from .codex import FullCodex
from plugins.common.types import PluginPayload, ValidateResult
from ...base.backend.characters_manager import CharactersManager as BaseCharactersManager


class CharactersManager(BaseCharactersManager):
    def __init__(self, codex: FullCodex) -> None:
        super().__init__(codex)

    def validate_and_enrich(self, payload: PluginPayload, context: dict[str, Any] | None = None) -> ValidateResult:
        # 1) сначала даём отработать базовой валидации (скиллы, лимиты и т.п.)
        base_res = super().validate_and_enrich(payload, context)

        # если базовый не ок — просто возвращаем его ошибки
        if not base_res.ok:
            return base_res

        # 2) прогоняем data базового результата через наш CharacterData,
        #    чтобы убедиться, что role/bonuses валидны и не теряются
        try:
            ch = CharacterData.model_validate({
                **payload["data"],
                **base_res.result.data
            })
        except Exception:
            # если вдруг наши поля некорректны — не ломаем базовый результат
            return base_res

        # 3) модель уже содержит и скиллы, и points, и role/bonuses, и skill_points из базы
        data = ch.model_dump(mode="json")

        return ValidateResult(
            ok=True,
            issues=base_res.issues,
            result=PluginPayload(
                data=data,
                tags=base_res.result.tags,
            ),
        )