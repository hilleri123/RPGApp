from __future__ import annotations

from plugins.pbta.base.backend.types import Move, Playbook


class PlaybookMoveConsistencyError(ValueError):
    """Playbook move id lists do not match the class Move definitions."""


def validate_playbook_move_ids(
    pb: Playbook,
    class_moves: list[Move],
    *,
    race_move_ids: set[str] | frozenset[str] | None = None,
) -> None:
    """
    Every Move in ``class_moves`` must appear exactly once across
    starting_moves, starting_move_choices, advanced_moves, and advanced_moves_6_10.
    Every id listed on the Playbook must have a matching Move definition.
    Race options must reference ids from ``race_move_ids`` when provided.
    """
    defined = {m.id for m in class_moves}
    seen: set[str] = set()
    listed: list[str] = []

    for field_name, ids in (
        ("starting_moves", pb.starting_moves or []),
        ("advanced_moves", pb.advanced_moves or []),
        ("advanced_moves_6_10", pb.advanced_moves_6_10 or []),
    ):
        for mid in ids:
            if mid in seen:
                raise PlaybookMoveConsistencyError(
                    f"Playbook {pb.id!r}: duplicate move id {mid!r} "
                    f"(also listed in playbook move lists)"
                )
            seen.add(mid)
            listed.append(mid)

    for group in pb.starting_move_choices or []:
        if not group:
            raise PlaybookMoveConsistencyError(
                f"Playbook {pb.id!r}: empty starting_move_choices group"
            )
        for mid in group:
            if mid in seen:
                raise PlaybookMoveConsistencyError(
                    f"Playbook {pb.id!r}: duplicate move id {mid!r} "
                    f"(also listed in playbook move lists)"
                )
            seen.add(mid)
            listed.append(mid)

    listed_set = set(listed)
    missing_in_lists = defined - listed_set
    extra_in_lists = listed_set - defined

    if missing_in_lists or extra_in_lists:
        lines = [
            f"Playbook {pb.id!r}: move id lists do not match "
            f"{len(class_moves)} class Move definition(s).",
        ]
        if missing_in_lists:
            lines.append(
                "  In Move codex but not on Playbook: "
                + ", ".join(sorted(missing_in_lists))
            )
        if extra_in_lists:
            lines.append(
                "  On Playbook but missing from Move codex: "
                + ", ".join(sorted(extra_in_lists))
            )
        raise PlaybookMoveConsistencyError("\n".join(lines))

    if race_move_ids is not None:
        for race in pb.races or []:
            if race.move_id not in race_move_ids:
                raise PlaybookMoveConsistencyError(
                    f"Playbook {pb.id!r}: race {race.id!r} references "
                    f"move_id {race.move_id!r}, which is not in dw_race_moves"
                )
