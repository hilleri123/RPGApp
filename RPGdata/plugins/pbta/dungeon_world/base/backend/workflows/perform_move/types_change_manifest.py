from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

ManifestLineKind = Literal["resource_draft", "damage", "resource_grant"]
ManifestLineStatus = Literal["draft", "needs_roll", "rolled", "skipped", "applied"]
ManifestMode = Literal["edit", "review"]


class ManifestTarget(BaseModel):
    kind: Literal["character", "npc", "world", "none"] = "character"
    id: str = ""
    name: str = ""


class ManifestLine(BaseModel):
    id: str
    kind: ManifestLineKind
    target: ManifestTarget = Field(default_factory=ManifestTarget)
    payload: dict[str, Any] = Field(default_factory=dict)
    status: ManifestLineStatus = "draft"
    label: str = ""


class ChangeManifestState(BaseModel):
    mode: ManifestMode = "edit"
    lines: list[ManifestLine] = Field(default_factory=list)
    editing_line_id: Optional[str] = None
    editing_step: Optional[str] = None
