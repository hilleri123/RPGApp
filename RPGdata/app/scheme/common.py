from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from plugins.common.types import ValidateResult


class Issue(BaseModel):
    path: str
    message: str
    icon: Optional[str] = None
    level: Literal["error", "warning"] = "error"


class UpsertPayload(BaseModel):
    force: bool = False
    data: Dict[str, Any] = {}


def dump_entity_fields(
    payload: BaseModel,
    *,
    exclude: set[str] | frozenset[str] = frozenset(),
    exclude_unset: bool = False,
    exclude_none: bool = False,
) -> Dict[str, Any]:
    """Плоские поля сущности из upsert-payload (без force/data и служебных ключей)."""
    meta = {"force", "data"} | set(exclude)
    fields = payload.model_dump(
        mode="json",
        exclude=meta,
        exclude_unset=exclude_unset,
        exclude_none=exclude_none,
    )
    fields.pop("tags", None)
    return fields


class UpsertResult(ValidateResult):
    pass


class ORMWithTagsModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
