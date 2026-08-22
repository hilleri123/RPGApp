from __future__ import annotations
from plugins.pbta.base.backend.codex import (
    PbtaFullCodex   as FullCodexBase,
    PbtaSkillsCodex as PbtaSkillsCodexBase,
    PbtaMovesCodex  as PbtaMovesCodexBase,
    PbtaPlaybooksCodex as PbtaPlaybooksCodexBase,
    PbtaResourcesCodex as PbtaResourcesCodexBase,
)
from .pbta_skills import DwSkillsCodex
from .moves       import DwMovesCodex
from .playbooks   import DwPlaybooksCodex
from .resources   import DwResourcesCodex
from .spells      import DwSpellsCodex
from .items       import ItemsCodex
from .npcs        import NpcCodex
from .name_generators import NameGeneratorsCodex


class FullCodex(FullCodexBase):
    def _make_skills(self)    -> PbtaSkillsCodexBase:    return DwSkillsCodex()
    def _make_moves(self)     -> PbtaMovesCodexBase:     return DwMovesCodex()
    def _make_playbooks(self) -> PbtaPlaybooksCodexBase: return DwPlaybooksCodex()
    def _make_resources(self) -> PbtaResourcesCodexBase: return DwResourcesCodex()

    def __init__(self) -> None:
        super().__init__()
        self.spells = DwSpellsCodex()
        self.items = ItemsCodex()
        self.npcs  = NpcCodex()
        self.name_generators = NameGeneratorsCodex()

    def as_config(self) -> dict:
        base = super().as_config()
        playbook_moves = self.playbooks.as_config().get("moves", [])
        base["moves"] = self.moves.as_config()["moves"] + playbook_moves
        base.update(self.spells.as_config())
        base["nameGenerators"] = self.name_generators.as_config()
        return base