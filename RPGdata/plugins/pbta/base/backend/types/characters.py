from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

from .types_classes import CustomMove, MoveTextOverride


class ActiveResource(BaseModel):
    id: str
    spec_id: str
    amount: int = 0
    source_move_id: Optional[str] = None
    description: Optional[str] = None


class CharacterState(BaseModel):
    """Runtime bonuses. Prefer resources for forward/ongoing; legacy buckets ignored in UI."""
    temp_bonuses: list[ActiveResource] = Field(default_factory=list)
    hold: list[ActiveResource] = Field(default_factory=list)  # legacy, unused
    resources: list[ActiveResource] = Field(default_factory=list)


class CharacterSpellEntry(BaseModel):
    id: str = ""
    spell_id: str = ""
    title: str = ""
    level: int = 0
    prepared: bool = False
    amount: int = 1
    source: Literal["codex", "custom", "other_playbook"] = "codex"
    notes: str = ""


class CharacterSpellcasting(BaseModel):
    spells: list[CharacterSpellEntry] = Field(default_factory=list)


class CharacterData(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    playbook_id: str = Field(default="")
    moves: list[str] = Field(default_factory=list)
    custom_moves: list[CustomMove] = Field(default_factory=list)
    stats: dict[str, int] = Field(default_factory=dict)
    stat_modifiers: dict[str, int] = Field(default_factory=dict)
    state: CharacterState = Field(default_factory=CharacterState)
    spellcasting: CharacterSpellcasting = Field(default_factory=CharacterSpellcasting)
    move_overrides: dict[str, MoveTextOverride] = Field(default_factory=dict)

    race_id: str = ""
    alignment_id: str = ""
    alignment_notes: str = ""
