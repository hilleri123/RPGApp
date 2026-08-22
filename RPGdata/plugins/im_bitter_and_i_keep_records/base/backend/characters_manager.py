# characters_manager.py
from __future__ import annotations

from typing import Any, Iterable

from pydantic import ValidationError

from .types import CombatantData, ValidateResult, ValidationIssue

from .codex import tags, traits, passives


def _norm_unique_str_list(xs: Any) -> list[str]:
    if not isinstance(xs, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        s = (str(x) if x is not None else "").strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _pydantic_validate(model_cls: Any, payload: Any) -> Any:
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(payload)
    return model_cls.parse_obj(payload)


def _pydantic_dump(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _dump_any(x: Any) -> Any:
    # pydantic v2
    if hasattr(x, "model_dump"):
        return x.model_dump()
    # pydantic v1
    if hasattr(x, "dict"):
        return x.dict()
    return x


def _dump_list(xs: Any) -> list[Any]:
    if not isinstance(xs, list):
        return []
    return [_dump_any(x) for x in xs]


# ---------- Passive mastery helpers ----------

_LEVEL_ORDER = {"none": 0, "novice": 1, "trained": 2, "master": 3, "legend": 4}


def _level_from_matches(matches: int, rules: dict[str, Any]) -> str:
    novice_at = int(rules.get("noviceAt", 1) or 1)
    trained_at = int(rules.get("trainedAt", 2) or 2)
    master_at = int(rules.get("masterAt", 3) or 3)
    legend_at = int(rules.get("legendAt", 4) or 4)

    if matches >= legend_at:
        return "legend"
    if matches >= master_at:
        return "master"
    if matches >= trained_at:
        return "trained"
    if matches >= novice_at:
        return "novice"
    return "none"


def _compute_active_passives(tags: Iterable[str], passives_catalog: list[Any]) -> dict[str, dict[str, Any]]:
    """
    Возвращает dict пассивок, которые считаются активными по текущим tags:
      pid -> {"id": pid, "enabled": True, "level": "...", "matches": int}

    ВНИМАНИЕ: без meta.
    """
    tag_set = {t for t in tags if isinstance(t, str) and t.strip()}

    active: dict[str, dict[str, Any]] = {}
    for p in passives_catalog:
        # p может быть pydantic-моделью или dict
        pid = (getattr(p, "id", None) or (p.get("id") if isinstance(p, dict) else "") or "").strip()
        if not pid:
            continue

        required = getattr(p, "requiredTags", None)
        if required is None and isinstance(p, dict):
            required = p.get("requiredTags")
        required = [str(x).strip() for x in (required or []) if str(x).strip()]
        if required and not all(r in tag_set for r in required):
            continue

        key_tags = getattr(p, "keyTags", None)
        if key_tags is None and isinstance(p, dict):
            key_tags = p.get("keyTags")
        key_tags = [str(x).strip() for x in (key_tags or []) if str(x).strip()]
        matches = sum(1 for kt in key_tags if kt in tag_set)

        rules = getattr(p, "masteryRules", None)
        if rules is None and isinstance(p, dict):
            rules = p.get("masteryRules")
        rules = rules if isinstance(rules, dict) else {}

        level = _level_from_matches(matches, rules)

        # active iff level != none
        if level != "none":
            active[pid] = {"id": pid, "enabled": True, "level": level, "matches": matches}

    return active


class CharactersManager:
    kind = "character"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        tags_catalog = _dump_list(tags.all())
        traits_catalog = _dump_list(traits.all())
        passives_catalog = _dump_list(passives.all())
        items_catalog: list[dict[str, Any]] = []

        return {
            "tagCategories": ["technique", "material", "tactic"],
            "tagsCatalog": tags_catalog,
            "traitsCatalog": traits_catalog,
            "passivesCatalog": passives_catalog,
            "itemsCatalog": items_catalog,
            "constraints": {
                "traitsAtStart": 1,
                "tagCountAtStart": 10,
                "categoryLimitsAtStart": {"technique": 4, "material": 3, "tactic": 3},
                "economyDefaults": {"main": 1, "move": 1, "defense": 1},
            },
            "initialData": {
                "kind": "pc",
                "tags": [],
                "traits": [
                    {"id": "trait_1", "text": "Когда X — я обязан Y, иначе плачу цену"},
                ],
                "tracks": {"hp": 6, "eq": 3, "fat": 0, "conc": 0, "grudge": 0},
                "trackMax": {"hp": 6, "eq": 3, "fat": 6, "conc": 3, "grudge": 6},
                "economy": {"main": 1, "move": 1, "defense": 1},
                "items": [],
                "passives": [],
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []
        cfg = self.config(context or {})
        constraints = cfg.get("constraints") or {}

        # 1) Pydantic validate CombatantData
        try:
            ch = _pydantic_validate(CombatantData, payload)
        except ValidationError as e:
            for err in e.errors():  # loc/msg [web:12][web:15]
                loc = ".".join(str(x) for x in err.get("loc", []) if x is not None)
                issues.append(
                    ValidationIssue(
                        path=f"data.{loc}" if loc else "data",
                        message=err.get("msg", "Invalid"),
                        icon="error",
                    )
                )
            return ValidateResult(ok=False, issues=issues, data=None)

        data = _pydantic_dump(ch)

        # 2) Tags: normalize + unknown + limits
        raw_tags = _norm_unique_str_list(data.get("tags"))
        unknown_tags, norm_tags = tags.normalize_and_unknown(raw_tags)
        for t in unknown_tags:
            issues.append(ValidationIssue(path="data.tags", message=f"Unknown tag '{t}'", icon="error"))
        data["tags"] = norm_tags

        cat_limits: dict[str, int] = (constraints.get("categoryLimitsAtStart") or {}) if isinstance(constraints, dict) else {}
        if cat_limits:
            tag_index = {t.id: t.category for t in tags.all()}
            counts: dict[str, int] = {}
            for tid in data["tags"]:
                cat = tag_index.get(tid)
                if not cat:
                    continue
                counts[cat] = counts.get(cat, 0) + 1
            for cat, limit in cat_limits.items():
                if isinstance(limit, int) and limit >= 0 and counts.get(cat, 0) > limit:
                    issues.append(
                        ValidationIssue(
                            path="data.tags",
                            message=f"Too many tags in category '{cat}': {counts.get(cat, 0)} > {limit}",
                            icon="error",
                        )
                    )

        tag_limit = constraints.get("tagCountAtStart")
        if isinstance(tag_limit, int) and tag_limit >= 0 and len(data["tags"]) > tag_limit:
            issues.append(ValidationIssue(path="data.tags", message=f"Too many tags: {len(data['tags'])} > {tag_limit}", icon="error"))

        # 3) Traits: no meta, text required
        traits_in = data.get("traits")
        norm_traits: list[dict[str, Any]] = []

        if isinstance(traits_in, list) and traits_in and all(isinstance(x, str) for x in traits_in):
            unknown_ids, norm_ids = traits.normalize_and_unknown_ids(traits_in)
            for tid in unknown_ids:
                issues.append(ValidationIssue(path="data.traits", message=f"Unknown trait id '{tid}'", icon="error"))
            for tid in norm_ids:
                tr = traits.get(tid)
                if tr:
                    norm_traits.append({"id": tr.id, "text": tr.text})
        else:
            if not isinstance(traits_in, list):
                traits_in = []
            for i, tr in enumerate(traits_in):
                if not isinstance(tr, dict):
                    issues.append(ValidationIssue(path=f"data.traits.{i}", message="Trait must be object", icon="error"))
                    continue
                tid = str(tr.get("id") or "").strip() or f"trait_{i+1}"
                text = str(tr.get("text") or "").strip()
                if not text:
                    issues.append(ValidationIssue(path=f"data.traits.{i}.text", message="Trait text is required", icon="error"))
                    continue
                norm_traits.append({"id": tid, "text": text})

        data["traits"] = norm_traits

        traits_min = constraints.get("traitsAtStart")
        if isinstance(traits_min, int) and traits_min > 0 and len(data["traits"]) < traits_min:
            issues.append(ValidationIssue(path="data.traits", message=f"At least {traits_min} trait(s) required", icon="error"))

        # 4) Economy
        econ_defaults = (constraints.get("economyDefaults") or {}) if isinstance(constraints, dict) else {}
        econ = data.get("economy") if isinstance(data.get("economy"), dict) else {}
        out_econ: dict[str, int] = {}
        for k in ("main", "move", "defense"):
            default = econ_defaults.get(k, 1)
            v = econ.get(k, default)
            if not isinstance(v, int) or v < 0 or v > 3:
                issues.append(ValidationIssue(path=f"data.economy.{k}", message="Economy slot must be int in range 0..3", icon="error"))
                v = default if isinstance(default, int) else 1
            out_econ[k] = int(v)
        data["economy"] = out_econ

        # 5) Items
        data["items"] = _norm_unique_str_list(data.get("items"))

        # 6) Passives: validate IDs against catalog, no meta, and "missing active" issues
        passives_catalog = cfg.get("passivesCatalog") or []
        allowed_passive_ids = {
            (getattr(p, "id", None) or (p.get("id") if isinstance(p, dict) else "") or "").strip()
            for p in passives_catalog
        }
        allowed_passive_ids.discard("")

        passives_in = data.get("passives")
        if not isinstance(passives_in, list):
            passives_in = []

        norm_passives: list[dict[str, Any]] = []
        seen: set[str] = set()

        for i, ps in enumerate(passives_in):
            if not isinstance(ps, dict):
                issues.append(ValidationIssue(path=f"data.passives.{i}", message="Passive must be object", icon="error"))
                continue
            pid = str(ps.get("id") or "").strip()
            if not pid:
                issues.append(ValidationIssue(path=f"data.passives.{i}.id", message="Passive id is required", icon="error"))
                continue
            if pid in seen:
                issues.append(ValidationIssue(path="data.passives", message=f"Duplicate passive '{pid}'", icon="error"))
                continue
            seen.add(pid)

            if allowed_passive_ids and pid not in allowed_passive_ids:
                issues.append(ValidationIssue(path="data.passives", message=f"Unknown passive '{pid}'", icon="error"))
                continue

            # NO META: only allow id + enabled (+ optional computed fields if client sent)
            enabled = ps.get("enabled", True)
            level = ps.get("level", None)
            matches = ps.get("matches", None)

            out: dict[str, Any] = {"id": pid, "enabled": bool(enabled)}
            # если фронт уже шлёт computed-поля — пропустим, но провалидируем типы
            if level is not None:
                lv = str(level).strip()
                if lv not in _LEVEL_ORDER:
                    issues.append(ValidationIssue(path=f"data.passives.{i}.level", message="Invalid passive level", icon="error"))
                else:
                    out["level"] = lv
            if matches is not None:
                if not isinstance(matches, int) or matches < 0:
                    issues.append(ValidationIssue(path=f"data.passives.{i}.matches", message="matches must be non-negative int", icon="error"))
                else:
                    out["matches"] = matches

            norm_passives.append(out)

        data["passives"] = norm_passives

        # compute which passives SHOULD be active
        should_be_active = _compute_active_passives(data["tags"], passives_catalog)  # pid -> state

        present_ids = {p["id"] for p in data["passives"] if isinstance(p, dict) and isinstance(p.get("id"), str)}

        # if active but missing -> error issue "need to add passive"
        for pid, st in sorted(should_be_active.items()):
            if pid not in present_ids:
                issues.append(
                    ValidationIssue(
                        path="data.passives",
                        message=f"Passive '{pid}' is active for current tags; add it to passives",
                        icon="error",
                    )
                )

        # optional: if present but shouldn't be active -> warning (можно сделать error если хочешь)
        for pid in sorted(present_ids):
            if pid not in should_be_active:
                issues.append(
                    ValidationIssue(
                        path="data.passives",
                        message=f"Passive '{pid}' is not active for current tags",
                        icon="warning",
                    )
                )

        # 7) Return
        if any(getattr(i, "level", "error") == "error" for i in issues):
            return ValidateResult(ok=False, issues=issues, data=None)

        data.setdefault("derived", {})
        return ValidateResult(ok=True, issues=issues, data=data)
