from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from ..scene_context import normalize_scene_mode

SceneMode = Literal["travel", "camp", "action"]


class InitiativeState(BaseModel):
  """Порядок ходов в сцене.

  `order` — id персонажей и NPC от первого к последнему, `values` — итог броска
  (2d6 + ЛОВ) для отображения, `active_index` — чей сейчас ход, `round` —
  номер раунда. Пустой `order` означает «инициатива не ведётся».
  """

  order: list[str] = Field(default_factory=list)
  values: dict[str, int] = Field(default_factory=dict)
  active_index: int = 0
  round: int = 1

  @field_validator("order", mode="before")
  @classmethod
  def _uniq_order(cls, value):
    out: list[str] = []
    seen: set[str] = set()
    for raw in value or []:
      s = str(raw or "").strip()
      if not s or s in seen:
        continue
      seen.add(s)
      out.append(s)
    return out

  @model_validator(mode="after")
  def _normalize(self):
    # values только для тех, кто в порядке: при deep-merge патча старые ключи
    # остаются, здесь мы их отсекаем, когда данные проходят валидацию.
    self.values = {k: int(v) for k, v in (self.values or {}).items() if k in set(self.order)}
    if not self.order:
      self.active_index = 0
    elif not isinstance(self.active_index, int) or self.active_index < 0 or self.active_index >= len(self.order):
      self.active_index = 0
    if not isinstance(self.round, int) or self.round < 1:
      self.round = 1
    return self


class SceneData(BaseModel):
  mode: SceneMode = "action"
  initiative: InitiativeState = Field(default_factory=InitiativeState)

  @field_validator("mode", mode="before")
  @classmethod
  def _coerce_mode(cls, value):
    return normalize_scene_mode(value if value is not None else "action")

  @field_validator("initiative", mode="before")
  @classmethod
  def _coerce_initiative(cls, value):
    return value if isinstance(value, (dict, InitiativeState)) else {}
