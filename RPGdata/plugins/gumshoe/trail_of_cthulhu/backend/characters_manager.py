# plugins/gumshoe/characters.py
from __future__ import annotations

from typing import Any

from ...base.backend.types import CharacterData, CharacterPoints
from .codex import FullCodex
from plugins.common.types import PluginPayload, ValidateResult
from ...base.backend.characters_manager import CharactersManager as BaseCharactersManager


class CharactersManager(BaseCharactersManager):
    def __init__(self, codex: FullCodex) -> None:
        super().__init__(codex)

    def init(self, context: dict[str, Any] = None) -> dict[str, Any]:
        default_investigative_max = 10
        default_general_max = 65

        return CharacterData(
            skills={},
            initial_skills={},
            bonus_skills={},
            items=[],
            points=CharacterPoints(
                investigativeMax=default_investigative_max,
                generalMax=default_general_max,
            ),
        ).model_dump(mode="json")

    # def validate_and_enrich(
    #     self,
    #     payload: PluginPayload,
    #     context: dict[str, Any] | None = None,
    # ) -> ValidateResult:
    #     base_res = super().validate_and_enrich(payload, context)

    #     if not base_res.ok:
    #         return base_res

    #     try:
    #         ch = CharacterData.model_validate({
    #             **payload["data"],
    #             **base_res.result.data,
    #         })
    #     except Exception:
    #         return base_res

    #     bonus_skills: dict[str, int] = {}

    #     def add_bonus(skill_id: str, amount: int) -> None:
    #         if amount <= 0:
    #             return
    #         bonus_skills[skill_id] = int(bonus_skills.get(skill_id, 0) or 0) + int(amount)

    #     athletics = ch.initial_skills.get("athletics", 0)
    #     first_aid = ch.initial_skills.get("first_aid", 0)
    #     surveillance = ch.initial_skills.get("surveillance", 0)

    #     hit_difficulty = 4
    #     if athletics >= 8:
    #         hit_difficulty = 5

    #     if first_aid >= 8:
    #         add_bonus("pathology", 1)

    #     if surveillance >= 8:
    #         add_bonus("electronic_surveillance", 1)

    #     add_bonus("occult", 1)
    #     add_bonus("stability", 1)

    #     ch.bonus_skills = bonus_skills
    #     ch.hit_difficulty = hit_difficulty

    #     data = ch.model_dump(mode="json")

    #     return ValidateResult(
    #         ok=True,
    #         issues=base_res.issues,
    #         result=PluginPayload(
    #             data=data,
    #             tags=base_res.result.tags,
    #         ),
    #     )