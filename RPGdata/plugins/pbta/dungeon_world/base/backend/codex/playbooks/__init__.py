from __future__ import annotations
from typing import Any

from plugins.pbta.base.backend.types import Move, Playbook

from ..move_contexts import tag_moves_for_scene

from .bard import bard, bard_moves
from .cleric import cleric, cleric_moves
from .druid import druid, druid_moves
from .fighter import fighter, fighter_moves
from .paladin import paladin, paladin_moves
from .ranger import ranger, ranger_moves
from .thief import thief, thief_moves
from .wizard import wizard, wizard_moves
from .barbarian import barbarian, barbarian_moves


from .immolator import immolator, immolator_moves
from .dw_playbook_identity import (
    apply_playbook_identity,
    dw_race_moves,
)
from .validate_playbook_moves import validate_playbook_move_ids

_PLAYBOOK_CLASS_MOVES: dict[str, list[Move]] = {
    bard.id: bard_moves,
    cleric.id: cleric_moves,
    druid.id: druid_moves,
    fighter.id: fighter_moves,
    barbarian.id: barbarian_moves,
    immolator.id: immolator_moves,
    paladin.id: paladin_moves,
    ranger.id: ranger_moves,
    thief.id: thief_moves,
    wizard.id: wizard_moves,
}


class DwPlaybooksCodex:
    def __init__(self) -> None:
        raw_playbooks = [
            bard,
            barbarian,
            cleric,
            druid,
            fighter,
            immolator,
            paladin,
            ranger,
            thief,
            wizard,
        ]
        race_move_ids = frozenset(m.id for m in dw_race_moves)
        self.playbooks: list[Playbook] = []
        for pb in raw_playbooks:
            enriched = apply_playbook_identity(pb)
            class_moves = _PLAYBOOK_CLASS_MOVES.get(enriched.id)
            if class_moves is None:
                raise ValueError(
                    f"DwPlaybooksCodex: no class_moves registered for playbook {enriched.id!r}"
                )
            validate_playbook_move_ids(
                enriched,
                class_moves,
                race_move_ids=race_move_ids,
            )
            self.playbooks.append(enriched)

        self.moves: list[Move] = tag_moves_for_scene([
            *dw_race_moves,
            *bard_moves,
            *cleric_moves,
            *druid_moves,
            *fighter_moves,
            *barbarian_moves,
            *immolator_moves,
            *paladin_moves,
            *ranger_moves,
            *thief_moves,
            *wizard_moves,
        ])

    def moves_map(self) -> dict[str, Move]:
        return {m.id: m for m in self.moves}

    def playbooks_map(self) -> dict[str, Playbook]:
        return {p.id: p for p in self.playbooks}
    
    def playbook_moves_map(self) -> dict[str, list[str]]:
        """id плейбука → [starting_moves + advanced_moves]"""
        result: dict[str, list[str]] = {}
        for pb in self.playbooks:
            moves = list(pb.starting_moves or [])
            for group in pb.starting_move_choices or []:
                moves += list(group)
            moves += list(pb.advanced_moves or [])
            moves += list(pb.advanced_moves_6_10 or [])
            result[pb.id] = moves
        return result

    def as_config(self) -> dict[str, Any]:
        return {
            "moves": [m.model_dump() for m in self.moves],
            "playbooks": [p.model_dump() for p in self.playbooks],
        }
    
PlaybooksCodex = DwPlaybooksCodex