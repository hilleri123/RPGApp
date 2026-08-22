from __future__ import annotations

from plugins.pbta.base.backend.types.types_classes import MovePlaceholderOption

# SRD / DW lands (id stable, label for UI)
DRUID_LANDS: list[MovePlaceholderOption] = [
    MovePlaceholderOption(id="great_forests", label="Великие леса"),
    MovePlaceholderOption(id="sweeping_plains", label="Бескрайние равнины"),
    MovePlaceholderOption(id="vast_desert", label="Безбрежная пустыня"),
    MovePlaceholderOption(id="stagnant_marshes", label="Застойные болота"),
    MovePlaceholderOption(id="jagged_mountains", label="Острые горы"),
    MovePlaceholderOption(id="open_sea", label="Открытое море"),
    MovePlaceholderOption(id="shattered_land", label="Разрушенная земля"),
    MovePlaceholderOption(id="the_towers", label="Башни"),
    MovePlaceholderOption(id="the_underground", label="Подземелье"),
]
