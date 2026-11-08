"""До броска заявку видят мастер и связанный игрок. После броска результат виден всем."""

from __future__ import annotations

from typing import Any

def redact_damage_rolls(action: dict[str, Any], user_id: str) -> None:
    if str(action.get("actionKey") or "") not in ("perform_move", "issue_changes"):
        return
    participants = action.get("participants") or {}
    if str(participants.get("gmUserId") or "") == str(user_id):
        return

    scene = action.get("scene") or {}
    owned = _owned_characters(scene, user_id)
    owners = _owner_map(scene)
    workflow = action.get("workflow") or {}
    if not isinstance(workflow, dict):
        return
    entry = ((workflow.get("context") or {}).get("entry") or {})
    claims = entry.get("damage_claims") if isinstance(entry, dict) else None
    if isinstance(claims, list) and isinstance(entry, dict):
        entry["damage_claims"] = [
            claim for claim in claims
            if not isinstance(claim, dict) or claim.get("rolled") or _claim_related(claim, owned, owners)
        ]

    stage_data = workflow.get("stageData") or {}
    stages = stage_data.get("stages") if isinstance(stage_data, dict) else None
    if not isinstance(stages, dict):
        return
    manifest = stages.get("perform_move.change_manifest") or {}
    if isinstance(manifest, dict) and isinstance(manifest.get("lines"), list):
        manifest["lines"] = [
            line for line in manifest["lines"]
            if _line_visible(line, owned, owners, user_id)
        ]


def _owner_map(scene: dict[str, Any]) -> dict[str, str]:
    links = (scene.get("links") or {}).get("characterToUserId") or {}
    owners = {str(k): str(v) for k, v in links.items()} if isinstance(links, dict) else {}
    for player in scene.get("players") or []:
        if not isinstance(player, dict) or not player.get("character_id"):
            continue
        user = player.get("user") or {}
        uid = user.get("id") if isinstance(user, dict) else player.get("user_id")
        if uid:
            owners.setdefault(str(player["character_id"]), str(uid))
    return owners


def _owned_characters(scene: dict[str, Any], user_id: str) -> set[str]:
    owned: set[str] = set()
    links = (scene.get("links") or {}).get("characterToUserId") or {}
    if isinstance(links, dict):
        for character_id, owner in links.items():
            if str(owner) == str(user_id):
                owned.add(str(character_id))
    for player in scene.get("players") or []:
        if not isinstance(player, dict):
            continue
        user = player.get("user") or {}
        uid = user.get("id") if isinstance(user, dict) else None
        if str(uid or "") == str(user_id) and player.get("character_id"):
            owned.add(str(player["character_id"]))
    return owned


def _rolls_this(source_kind: str, source_id: str, target_kind: str, target_id: str, owned: set[str], owners: dict[str, str]) -> bool:
    """Бросает актор, если это персонаж игрока. Иначе — тот, кто получает урон или лечение."""
    if source_kind == "character" and source_id and owners.get(source_id):
        return source_id in owned
    return target_kind == "character" and target_id in owned


def _claim_related(claim: dict[str, Any], owned: set[str], owners: dict[str, str]) -> bool:
    return _rolls_this(
        str(claim.get("source_kind") or ""),
        str(claim.get("source_character_id") or ""),
        str(claim.get("target_kind") or ""),
        str(claim.get("target_character_id") or ""),
        owned,
        owners,
    )


def _line_visible(line: dict[str, Any], owned: set[str], owners: dict[str, str], user_id: str) -> bool:
    if not isinstance(line, dict) or line.get("kind") != "damage":
        return True
    if line.get("status") == "rolled":
        return True
    payload = line.get("payload") if isinstance(line.get("payload"), dict) else {}
    if payload.get("rolled"):
        return True
    if line.get("status") == "pending" and str(payload.get("declared_by") or "") == str(user_id):
        return True
    return _line_related(line, owned, owners)


def _line_related(line: dict[str, Any], owned: set[str], owners: dict[str, str]) -> bool:
    payload = line.get("payload") if isinstance(line.get("payload"), dict) else {}
    target = line.get("target") if isinstance(line.get("target"), dict) else {}
    return _rolls_this(
        str(payload.get("source_kind") or ""),
        str(payload.get("source_id") or payload.get("source_character_id") or ""),
        str(target.get("kind") or payload.get("target_kind") or ""),
        str(target.get("id") or payload.get("target_id") or ""),
        owned,
        owners,
    )

