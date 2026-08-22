from __future__ import annotations

from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


SceneMode = Literal["travel", "rest", "combat"]
CombatPhase = Literal["move", "melee", "ranged", "other"]


class Position(BaseModel):
    x: int = 0
    y: int = 0


class ContactEvent(BaseModel):
    id1: str
    id2: str
    initiator: Optional[str] = None
    meta: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _norm(self):
        a = (self.id1 or "").strip()
        b = (self.id2 or "").strip()
        if not a or not b or a == b:
            raise ValueError("ContactEvent requires two different non-empty ids")
        if b < a:
            a, b = b, a
        self.id1, self.id2 = a, b
        if self.initiator is not None:
            self.initiator = str(self.initiator).strip() or None
        return self

    @property
    def key(self) -> str:
        return f"{self.id1}::{self.id2}"


class DamageLine(BaseModel):
    dtype: str = "slashing"
    base: int = 0
    notes: str = ""


class AttackEvent(BaseModel):
    attackerId: str
    targetId: str
    contactKey: Optional[str] = None
    damage: List[DamageLine] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _norm(self):
        self.attackerId = (self.attackerId or "").strip()
        self.targetId = (self.targetId or "").strip()
        if not self.attackerId or not self.targetId:
            raise ValueError("AttackEvent requires attackerId and targetId")
        if self.attackerId == self.targetId:
            raise ValueError("AttackEvent attackerId cannot equal targetId")
        if self.contactKey is not None:
            ck = str(self.contactKey).strip()
            self.contactKey = ck or None
        self.damage = [d for d in (self.damage or []) if d is not None]
        return self


# ---------------------------
# 1) MOVE (base)
# ---------------------------

class CombatMoveState(BaseModel):
    phase: Literal["move"] = "move"

    # common
    positions: dict[UUID, Position] = Field(default_factory=dict)
    initiativeOrder: list[UUID] = Field(default_factory=list)
    initiativeValues: dict[UUID, int] = Field(default_factory=dict)
    activeIndex: int = 0

    # move data
    moves: dict[str, Position] = Field(default_factory=dict)
    contacts: list[ContactEvent] = Field(default_factory=list)

    @model_validator(mode="after")
    def _norm(self):
        # initiative uniq
        order: list[str] = []
        seen: set[str] = set()
        for x in self.initiativeOrder or []:
            s = str(x or "").strip()
            if not s or s in seen:
                continue
            seen.add(s)
            order.append(s)
        self.initiativeOrder = order

        if not isinstance(self.activeIndex, int) or self.activeIndex < 0:
            self.activeIndex = 0
        if self.initiativeOrder and self.activeIndex >= len(self.initiativeOrder):
            self.activeIndex = 0
        if not self.initiativeOrder:
            self.activeIndex = 0

        # positions normalize keys
        pos2: dict[str, Position] = {}
        for k, v in (self.positions or {}).items():
            kid = str(k or "").strip()
            if not kid:
                continue
            pos2[kid] = v if isinstance(v, Position) else Position.model_validate(v)
        self.positions = pos2

        # moves normalize keys
        mv2: dict[str, Position] = {}
        for k, v in (self.moves or {}).items():
            kid = str(k or "").strip()
            if not kid:
                continue
            mv2[kid] = v if isinstance(v, Position) else Position.model_validate(v)
        self.moves = mv2

        # contacts uniq by key
        out_contacts: list[ContactEvent] = []
        seen_keys: set[str] = set()
        for c in self.contacts or []:
            c2 = c if isinstance(c, ContactEvent) else ContactEvent.model_validate(c)
            if c2.key in seen_keys:
                continue
            seen_keys.add(c2.key)
            out_contacts.append(c2)
        self.contacts = out_contacts

        return self


# ---------------------------
# 2) MELEE extends MOVE
# ---------------------------

class CombatMeleeState(CombatMoveState):
    phase: Literal["melee"] = "melee"

    meleeActions: List[AttackEvent] = Field(default_factory=list)

    @model_validator(mode="after")
    def _norm_melee(self):
        self.meleeActions = [
            (a if isinstance(a, AttackEvent) else AttackEvent.model_validate(a))
            for a in (self.meleeActions or [])
            if a is not None
        ]
        return self


# ---------------------------
# 3) RANGED extends MELEE
# ---------------------------

class CombatRangedState(CombatMeleeState):
    phase: Literal["ranged"] = "ranged"

    rangedActions: List[AttackEvent] = Field(default_factory=list)

    @model_validator(mode="after")
    def _norm_ranged(self):
        self.rangedActions = [
            (a if isinstance(a, AttackEvent) else AttackEvent.model_validate(a))
            for a in (self.rangedActions or [])
            if a is not None
        ]
        return self


# ---------------------------
# 4) OTHER extends RANGED (FULL STATE)
# ---------------------------

class CombatOtherState(CombatRangedState):
    phase: Literal["other"] = "other"

    otherActions: List[dict[str, Any]] = Field(default_factory=list)


CombatState = Annotated[
    Union[CombatMoveState, CombatMeleeState, CombatRangedState, CombatOtherState],
    Field(discriminator="phase"),
]

def validate_as_phase(combat: CombatState) -> None:
    data = combat.model_dump()
    ph = data.get("phase")
    if ph == "move":
        CombatMoveState.model_validate(data)
    elif ph == "melee":
        CombatMeleeState.model_validate(data)
    elif ph == "ranged":
        CombatRangedState.model_validate(data)
    elif ph == "other":
        CombatOtherState.model_validate(data)



class TravelState(BaseModel):
    pace: Literal["slow", "normal", "fast"] = "normal"


class RestState(BaseModel):
    camp: bool = False


class SceneData(BaseModel):
    mode: SceneMode = "travel"
    travel: Optional[TravelState] = None
    rest: Optional[RestState] = None
    combat: Optional[CombatState] = None

    @model_validator(mode="after")
    def _by_mode(self):
        if self.mode == "travel":
            self.travel = self.travel or TravelState()
            self.rest = None
            self.combat = None

        elif self.mode == "rest":
            self.rest = self.rest or RestState()
            self.travel = None
            self.combat = None

        elif self.mode == "combat":
            self.combat = self.combat or CombatState()
            self.travel = None
            self.rest = None

        return self
