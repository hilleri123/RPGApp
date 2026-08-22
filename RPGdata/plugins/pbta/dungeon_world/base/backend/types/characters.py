from __future__ import annotations

from pydantic import Field, AliasChoices, ConfigDict

from plugins.pbta.base.backend.types.characters import CharacterData as BaseCharacterData


class CharacterData(BaseCharacterData):
    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    hp: int = 0

    max_hp: int = Field(default=0)

    level: int = 1
    xp: int = 0
    armor_cache: int = 0