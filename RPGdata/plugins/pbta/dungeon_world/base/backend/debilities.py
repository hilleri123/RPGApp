"""Шесть травм Dungeon World: каждая даёт −1 к броску своей характеристики."""

from __future__ import annotations

DEBILITY_STAT: dict[str, str] = {
    "weak": "str",
    "shaky": "dex",
    "sick": "con",
    "stunned": "int",
    "confused": "wis",
    "scarred": "cha",
}

DEBILITY_TITLE: dict[str, str] = {
    "weak": "Слабость",
    "shaky": "Дрожь",
    "sick": "Болезнь",
    "stunned": "Оглушение",
    "confused": "Замешательство",
    "scarred": "Шрам",
}


def clean_debilities(raw: list[str] | None) -> list[str]:
    seen: list[str] = []
    for item in raw or []:
        deb = str(item)
        if deb in DEBILITY_STAT and deb not in seen:
            seen.append(deb)
    return seen


def apply_debility_mods(stat_modifiers: dict[str, int], debilities: list[str] | None) -> dict[str, int]:
    out = {sid: int(mod) for sid, mod in (stat_modifiers or {}).items()}
    for deb in clean_debilities(list(debilities or [])):
        sid = DEBILITY_STAT[deb]
        out[sid] = int(out.get(sid, 0)) - 1
    return out


def appetite_consequence(d6: int, d8: int) -> bool:
    """Ход «Геркулесовы аппетиты»: осложнение, если к6 выше к8."""
    return int(d6) > int(d8)


def build_debility_patch(scene, updates) -> tuple[dict, list[str]]:
    """Вернуть dataPatch персонажей и строки журнала. Пустой патч — ничего не менять."""
    from .codex.pbta_skills import stat_modifier

    by_target: dict[str, list[str]] = {}
    for upd in updates or []:
        tid = str(getattr(upd, "target_id", "") or "")
        if not tid:
            continue
        raw = getattr(upd, "debilities", None) or []
        by_target[tid] = clean_debilities([str(x) for x in raw])

    characters = []
    logs: list[str] = []
    for tid, deb_ids in by_target.items():
        ch = next(
            (x for x in (getattr(scene, "characters", None) or []) if str(x.id) == tid),
            None,
        )
        if ch is None:
            continue
        raw_data = ch.data if isinstance(getattr(ch, "data", None), dict) else {}
        stats = raw_data.get("stats") or {}
        mods = {
            str(sid): stat_modifier(int(val))
            for sid, val in stats.items()
        }
        mods = apply_debility_mods(mods, deb_ids)
        names = [DEBILITY_TITLE[d] for d in deb_ids]
        who = getattr(ch, "name", None) or tid
        logs.append(f"{who}: травмы — {', '.join(names) if names else 'нет'}")
        characters.append({
            "id": str(ch.id),
            "dataPatch": {
                "debilities": deb_ids,
                "stat_modifiers": mods,
            },
        })

    if not characters:
        return {}, logs
    return {"characters": characters}, logs
