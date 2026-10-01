from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

EntryKind = Literal["character", "npc"]


class InitEntry(BaseModel):
    entity_id: str
    kind: EntryKind = "character"
    name: str = ""
    owner_user_id: Optional[str] = None

    # False, пока участник ещё не бросил кубы (стадия бросков)
    rolled: bool = True

    # 2d6 + modifier
    modifier: int = 0
    dice: list[int] = Field(default_factory=list)
    roll_seed: str = ""  # хэш жеста, от которого брошены кубы
    seed_image_ref: Optional[str] = None  # rolls/<hash>.png — рисунок жеста (как в журнале бросков)
    total: int = 0

    # итог поправлен мастером вручную (кубы остаются для истории)
    manual: bool = False


class InitiativeContext(BaseModel):
    scene_id: str
    entries: list[InitEntry] = Field(default_factory=list)

    # мастер расставил порядок руками: перебросы и правки значений его не сбивают
    custom_order: bool = False

    # хэш жеста, от которого мастер бросил за всех NPC (сам рисунок в контексте не храним)
    npc_seed: str = ""
