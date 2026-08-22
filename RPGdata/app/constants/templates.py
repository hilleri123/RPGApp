"""Shared constants for template (blueprint) entities."""

TEMPLATE_TAG = "template"


def is_template_entity(tags) -> bool:
    if not tags:
        return False
    if isinstance(tags, list):
        return TEMPLATE_TAG in [str(t) for t in tags]
    return False


def ensure_template_tags(tags) -> list[str]:
    arr = [str(t) for t in (tags or [])]
    if TEMPLATE_TAG not in arr:
        arr.append(TEMPLATE_TAG)
    return arr
