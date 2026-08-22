from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, NonNegativeInt

from .mastery import MasteryRules


PassiveLevel = Literal["none", "novice", "trained", "master", "legend"]


class PassiveState(BaseModel):
    id: str
    enabled: bool = True

    # вычисляется менеджером из тэгов; хранить удобно, чтобы UI не пересчитывал
    level: PassiveLevel = "none"
    matches: NonNegativeInt = 0  # сколько совпадений keyTags

    meta: dict[str, Any] = Field(default_factory=dict)


class PassiveDef(BaseModel):
    id: str
    title: str
    description: str = ""

    # Аналогично ItemData: requiredTags и keyTags
    requiredTags: list[str] = Field(default_factory=list)
    keyTags: list[str] = Field(default_factory=list)

    # Пороговые правила мастерства (как у предметов)
    masteryRules: MasteryRules = Field(default_factory=MasteryRules)

    # Тэги, которые пассивка “даёт”, если активна (enabled) и level >= novice (или другой порог)
    grantsTags: list[str] = Field(default_factory=list)

    # Obsessen как “приклеенный” payload, появляющийся при достижении порога.
    # Можно трактовать obsession как сущность, которую UI показывает отдельным блоком.
    obsession: Optional[dict[str, Any]] = None

    # С какого уровня пассивка считается “включённой автоматически” (опционально)
    autoEnableAt: PassiveLevel = "novice"

    # С какого уровня выдавать grantsTags/obsession (опционально, по умолчанию как autoEnableAt)
    grantsAt: PassiveLevel = "novice"
    obsessionAt: PassiveLevel = "novice"
