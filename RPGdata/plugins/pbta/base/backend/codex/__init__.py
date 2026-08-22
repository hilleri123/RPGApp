from __future__ import annotations
from abc import ABC, abstractmethod
from ..types import Skill, Move, Playbook, ResourceSpec




class PbtaSkillsCodex(ABC):
    """Статы системы и функция получения модификатора."""

    @abstractmethod
    def get_skills(self) -> list[Skill]: ...

    @abstractmethod
    def get_modifier(self, value: int) -> int: ...

    def skills_map(self) -> dict[str, Skill]:
        return {s.id: s for s in self.get_skills()}

    def get_ids(self) -> list[str]:
        return [s.id for s in self.get_skills()]

    def as_config(self) -> dict:
        return {"skills": [s.model_dump(mode="json")  for s in self.get_skills()]}


class PbtaMovesCodex(ABC):
    """Все ходы системы."""

    @abstractmethod
    def get_moves(self) -> list[Move]: ...

    def moves_map(self) -> dict[str, Move]:
        return {m.id: m for m in self.get_moves()}

    def get_basic(self) -> list[Move]:
        return [m for m in self.get_moves() if m.kind == "basic"]

    def as_config(self) -> dict:
        return {"moves": [m.model_dump(mode="json") for m in self.get_moves()]}


class PbtaPlaybooksCodex(ABC):
    """Плейбуки (классы персонажей)."""

    @abstractmethod
    def get_playbooks(self) -> list[Playbook]: ...

    def playbooks_map(self) -> dict[str, Playbook]:
        return {p.id: p for p in self.get_playbooks()}

    def get_playbook_move_ids(self, playbook_id: str) -> set[str]:
        pb = self.playbooks_map().get(playbook_id)
        if not pb:
            return set()
        return set(pb.starting_moves) | set(pb.advanced_moves)

    def as_config(self) -> dict:
        return {"playbooks": [p.model_dump(mode="json") for p in self.get_playbooks()]}


class PbtaResourcesCodex(ABC):
    """Виды ресурсов: hold, forward, spell_slot, ammo и т.п."""

    @abstractmethod
    def get_resource_specs(self) -> list[ResourceSpec]: ...

    def resource_specs_map(self) -> dict[str, ResourceSpec]:
        return {r.id: r for r in self.get_resource_specs()}

    def as_config(self) -> dict:
        return {"resource_specs": [r.model_dump(mode="json") for r in self.get_resource_specs()]}


# ── Полный кодекс ─────────────────────────────────────────────────────────────


class PbtaFullCodex(ABC):
    """
    Композитный кодекс PbtA-системы.
    Конкретная игра (DW, AW...) реализует _make_* и получает
    готовый объект с удобными проксями.
    """

    @abstractmethod
    def _make_skills(self) -> PbtaSkillsCodex: ...

    @abstractmethod
    def _make_moves(self) -> PbtaMovesCodex: ...

    @abstractmethod
    def _make_playbooks(self) -> PbtaPlaybooksCodex: ...

    @abstractmethod
    def _make_resources(self) -> PbtaResourcesCodex: ...

    def __init__(self) -> None:
        self.skills    = self._make_skills()
        self.moves     = self._make_moves()
        self.playbooks = self._make_playbooks()
        self.resources = self._make_resources()

    # ── Прокси для удобства ───────────────────────────────────────────────────

    def get_modifier(self, value: int) -> int:
        return self.skills.get_modifier(value)

    def as_config(self) -> dict:
        return {
            **self.skills.as_config(),
            **self.moves.as_config(),
            **self.playbooks.as_config(),
            **self.resources.as_config(),
        }