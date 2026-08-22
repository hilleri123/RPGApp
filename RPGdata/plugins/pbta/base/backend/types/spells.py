from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Spell(BaseModel):
    """Заклинание из книги заклинаний класса."""
    model_config = ConfigDict(frozen=True)

    id:    str
    title: str
    level: int = 0
    school: str = ""
    tags:   list[str] = Field(default_factory=list)
    description: str = ""
    classes: list[str] = Field(default_factory=list)


class SpellBook(BaseModel):
    """Книга заклинаний класса (маг, жрец и т.д.)."""
    model_config = ConfigDict(frozen=True)

    id:       str
    title:    str
    class_id: str
    levels:   list[int] = Field(default_factory=list)
    summary:  str = ""
    cantrip_note: str = ""
