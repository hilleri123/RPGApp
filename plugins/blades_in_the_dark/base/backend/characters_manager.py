# characters_manager.py
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from .common import ValidateResult, ValidationIssue
from .types import (
    CharacterData,
    ActionId,
    AttributeId,
    TraumaId,
    LoadId,
    LOAD_VALUE,
    PLAYBOOKS,
    ItemData
)

ALL_ACTIONS: list[ActionId] = [
    "hunt", "study", "survey", "tinker",
    "finesse", "prowl", "skirmish", "wreck",
    "attune", "command", "consort", "sway",
]

ACTION_TO_ATTRIBUTE: dict[ActionId, AttributeId] = {
    # Insight
    "hunt": "insight",
    "study": "insight",
    "survey": "insight",
    "tinker": "insight",
    # Prowess
    "finesse": "prowess",
    "prowl": "prowess",
    "skirmish": "prowess",
    "wreck": "prowess",
    # Resolve
    "attune": "resolve",
    "command": "resolve",
    "consort": "resolve",
    "sway": "resolve",
}

ATTRIBUTE_TITLES: dict[AttributeId, str] = {
    "insight": "Insight",
    "prowess": "Prowess",
    "resolve": "Resolve",
}

ALL_TRAUMAS: list[TraumaId] = [
    "cold", "haunted", "obsessed", "paranoid",
    "reckless", "soft", "unstable", "vicious",
]

ALL_LOADS: list[LoadId] = ["light", "normal", "heavy"]

# --- Playbooks / Special abilities (RU) ---




class CharactersManager:
    kind = "character"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        actions0 = {a: 0 for a in ALL_ACTIONS}
        return {
            "attributes": [{"id": a, "title": ATTRIBUTE_TITLES[a]} for a in ("insight", "prowess", "resolve")],
            "actions": [{"id": a, "title": a, "attribute": ACTION_TO_ATTRIBUTE[a]} for a in ALL_ACTIONS],
            "traumas": [{"id": t, "title": t} for t in ALL_TRAUMAS],
            "loads": [{"id": lid, "value": LOAD_VALUE[lid]} for lid in ALL_LOADS],
            "constraints": {"stressMax": 9, "traumaMax": 4, "abilitiesMaxAtStart": 1},
            "playbooks": PLAYBOOKS,
            "initialData": {
                "playbookId": None,
                "abilities": [],
                "actions": actions0,
                "stress": 0,
                "traumas": [],
                "load": None,
                "harm": {"l3": None, "l2": [None, None], "l1": [None, None]},
                "items": [],
            },
        }

    def _default_item_quality(self, ctx: dict[str, Any]) -> int:
        if isinstance(ctx.get("defaultItemQuality"), int):
            return max(0, ctx["defaultItemQuality"])
        if isinstance(ctx.get("crewTier"), int):
            return max(0, ctx["crewTier"])
        return 0

    def _compute_attributes(self, actions: dict[ActionId, int]) -> dict[AttributeId, int]:
        # Attribute rating = number of actions in that attribute with rating > 0 (for resistance dice pool) [file:17]
        res: dict[AttributeId, int] = {"insight": 0, "prowess": 0, "resolve": 0}
        for aid, rating in actions.items():
            attr = ACTION_TO_ATTRIBUTE.get(aid)
            if attr and (rating or 0) > 0:
                res[attr] += 1
        return res

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        ctx = context or {}
        issues: list[ValidationIssue] = []

        # --- parse ---
        try:
            ch = CharacterData.model_validate(payload) if hasattr(CharacterData, "model_validate") else CharacterData.parse_obj(payload)
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(
                    ValidationIssue(
                        path=f"data.{loc}" if loc else "data",
                        message=err.get("msg", "Invalid"),
                        icon="error",
                    )
                )
            return ValidateResult(ok=False, issues=issues, data=None)

        # --- actions: unknown keys + normalize missing to 0 ---
        for key in ch.actions.keys():
            if key not in ALL_ACTIONS:
                issues.append(ValidationIssue(path=f"data.actions.{key}", message="Unknown action", icon="error"))

        normalized_actions: dict[ActionId, int] = {a: int(ch.actions.get(a, 0)) for a in ALL_ACTIONS}

        # --- playbook / abilities ---

        # Собираем доступные плейбуки и их способности из конфига (PLAYBOOKS)
        valid_playbook_ids = {p.get("id") for p in PLAYBOOKS if isinstance(p, dict)}
        playbook_map: dict[str, dict[str, Any]] = {
            p["id"]: p for p in PLAYBOOKS
            if isinstance(p, dict) and isinstance(p.get("id"), str)
        }

        # playbookId: либо None, либо валидный id
        if ch.playbookId is not None and ch.playbookId not in valid_playbook_ids:
            issues.append(
                ValidationIssue(
                    path="data.playbookId",
                    message="Unknown playbook",
                    icon="error",
                )
            )

        # abilities: нормализация + проверки
        abilities = list(ch.abilities or [])

        # уникальность
        if len(set(abilities)) != len(abilities):
            issues.append(
                ValidationIssue(
                    path="data.abilities",
                    message="Abilities must be unique",
                    icon="error",
                )
            )

        # проверка принадлежности к выбранному плейбуку
        if ch.playbookId is not None and ch.playbookId in playbook_map:
            pb = playbook_map[ch.playbookId]
            pb_abilities = pb.get("abilities") or []
            allowed_ability_ids = {
                a.get("id")
                for a in pb_abilities
                if isinstance(a, dict) and isinstance(a.get("id"), str)
            }

            for ab in abilities:
                if ab not in allowed_ability_ids:
                    issues.append(
                        ValidationIssue(
                            path="data.abilities",
                            message=f"Ability '{ab}' is not available for playbook '{ch.playbookId}'",
                            icon="error",
                        )
                    )

        # лимит на стартовые способности (из constraints; по умолчанию 1)
        abilities_max = 1
        try:
            cfg = self.config(ctx)
            abilities_max = int((cfg.get("constraints") or {}).get("abilitiesMaxAtStart", 1))
        except Exception:
            abilities_max = 1

        if abilities_max >= 0 and len(abilities) > abilities_max:
            issues.append(
                ValidationIssue(
                    path="data.abilities",
                    message=f"Too many abilities (max {abilities_max})",
                    icon="error",
                )
            )


        # --- stress ---
        # RAW: max track 9; overflow means take trauma. Here we warn if > 9. [file:17]
        if ch.stress > 9:
            issues.append(
                ValidationIssue(
                    path="data.stress",
                    message="Stress above 9: character should take trauma",
                    icon="warn",
                    level="warning",
                )
            )

        # --- traumas ---
        if len(ch.traumas or []) > 4:
            issues.append(ValidationIssue(path="data.traumas", message="Too many traumas (max 4)", icon="error"))
        if len(set(ch.traumas or [])) != len(ch.traumas or []):
            issues.append(ValidationIssue(path="data.traumas", message="Traumas must be unique", icon="error"))

        # --- load ---
        if ch.load is not None and ch.load not in ALL_LOADS:
            issues.append(ValidationIssue(path="data.load", message="Unknown load value", icon="error"))

        # --- harm (2/2/1) + normalize ---
        def norm_cell(x: Any) -> Any:
            if x is None:
                return None
            s = str(x).strip()
            return s if s else None

        harm_obj = ch.harm
        l1 = list(getattr(harm_obj, "l1", []) or [])
        l2 = list(getattr(harm_obj, "l2", []) or [])
        l3 = norm_cell(getattr(harm_obj, "l3", None))

        if len(l1) != 2:
            issues.append(ValidationIssue(path="data.harm.l1", message="harm.l1 must have exactly 2 slots", icon="error"))
        if len(l2) != 2:
            issues.append(ValidationIssue(path="data.harm.l2", message="harm.l2 must have exactly 2 slots", icon="error"))

        # normalize even if wrong length, so UI won't break after you fix validation errors
        l1 = (l1 + [None, None])[:2]
        l2 = (l2 + [None, None])[:2]
        harm_l1 = [norm_cell(x) for x in l1]
        harm_l2 = [norm_cell(x) for x in l2]

        # --- items: fill quality if missing ---
        default_q = self._default_item_quality(ctx)
        enriched_items: list[dict[str, Any]] = []
        for idx, it in enumerate(ch.items or []):
            try:
                it_obj = ItemData.model_validate(it) if hasattr(ItemData, "model_validate") else ItemData.parse_obj(it)  # type: ignore[arg-type]
            except ValidationError:
                issues.append(ValidationIssue(path=f"data.items.{idx}", message="Invalid item payload", icon="error"))
                continue

            it_data = it_obj.model_dump() if hasattr(it_obj, "model_dump") else it_obj.dict()
            if it_data.get("quality") is None:
                it_data["quality"] = default_q
            enriched_items.append(it_data)

        # If any hard errors -> fail
        if any(i.level == "error" for i in issues):
            return ValidateResult(ok=False, issues=issues, data=None)

        # --- enrich ---
        data = ch.model_dump() if hasattr(ch, "model_dump") else ch.dict()
        data["actions"] = normalized_actions
        data["playbookId"] = ch.playbookId
        data["abilities"] = abilities
        data["items"] = enriched_items
        data["harm"] = {"l1": harm_l1, "l2": harm_l2, "l3": l3}

        data.setdefault("derived", {})
        data["derived"]["attributes"] = self._compute_attributes(normalized_actions)  # resistance dice pools [file:17]
        data["derived"]["loadValue"] = LOAD_VALUE.get(data.get("load"), None)  # light=3, normal=5, heavy=6 [file:17]
        data["derived"]["defaultItemQualityUsed"] = default_q
        data["derived"]["traumaCount"] = len(data.get("traumas") or [])

        return ValidateResult(ok=True, issues=issues, data=data)
