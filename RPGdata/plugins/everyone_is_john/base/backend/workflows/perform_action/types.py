# plugins/everyone_is_john/perform_action/types.py
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


class PerformActionEntry(BaseModel):
    playerUserId: UUID
    characterId: UUID
    characterName: str = ""
    profession: str = ""                # profession из CharacterData
    available_tokens: int = 0

    # стадия 1 — заявка игрока
    description: Optional[str] = None
    spend_tokens: Optional[int] = None
    has_profession: bool = False

    # стадия 2 — решение мастера
    gm_approved: Optional[bool] = None   # True=ok, False=reject
    gm_dice_override: Optional[int] = None  # если мастер изменил кол-во d6
    gm_comment: Optional[str] = None

    # стадия 3 — seed-картинка игрока
    canvas_seed: Optional[str] = None   # base64 или url

    # результат броска
    dice_count: Optional[int] = None
    dice_results: Optional[List[int]] = None
    success: Optional[bool] = None


class PerformActionContext(BaseModel):
    sceneId: UUID
    entry: Optional[PerformActionEntry] = None
