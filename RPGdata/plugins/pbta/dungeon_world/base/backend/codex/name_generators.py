from __future__ import annotations

from pydantic import BaseModel, Field


class NameGeneratorEntry(BaseModel):
    name: str
    tags: list[str] = Field(default_factory=list)
    description: str = ""
    part_kind: str = "full"


def _entries() -> list[NameGeneratorEntry]:
    """Starter name tables for DW — filter by tags in UI (elf, dwarf, weapon, …)."""
    rows: list[tuple[str, list[str], str]] = [
        # Персонажи / NPC — эльфы
        ("Аэлиндор", ["character", "npc", "elf", "male"], "эльфийское мужское"),
        ("Галадриэль", ["character", "npc", "elf", "female"], "эльфийское женское"),
        ("Тирион", ["character", "npc", "elf", "male"], "лесной страж"),
        ("Мирэль", ["character", "npc", "elf", "female"], "певица рощ"),
        ("Фаэнор", ["character", "npc", "elf", "male"], "старый род"),
        # Люди
        ("Бран", ["character", "npc", "human", "male"], "северный воин"),
        ("Элара", ["character", "npc", "human", "female"], "торговка"),
        ("Годрик", ["character", "npc", "human", "male"], "стражник"),
        ("Мира", ["character", "npc", "human", "female"], "целительница"),
        ("Томас Красный", ["character", "npc", "human", "male"], "наёмник"),
        # Дварфы
        ("Торин Каменная Борода", ["character", "npc", "dwarf", "male"], "кузнец"),
        ("Брунна", ["character", "npc", "dwarf", "female"], "интендант"),
        ("Дурин", ["character", "npc", "dwarf", "male"], "старый клан"),
        ("Хельга", ["character", "npc", "dwarf", "female"], "рунописец"),
        # Орки / монстры
        ("Грак", ["npc", "orc", "male"], "орк-воин"),
        ("Шкурорез", ["npc", "beast"], "зверь"),
        ("Костяной страж", ["npc", "undead"], "нежить"),
        # Предметы — оружие
        ("Клинок рассвета", ["item", "weapon", "sword"], "меч"),
        ("Громовержец", ["item", "weapon", "hammer"], "молот"),
        ("Тихий шёпот", ["item", "weapon", "dagger"], "кинжал"),
        ("Дальний гнев", ["item", "weapon", "bow"], "лук"),
        ("Щит горного клана", ["item", "armor", "shield"], "щит"),
        # Предметы — снаряжение
        ("Сумка путника", ["item", "gear"], "ранец"),
        ("Фляга с серебряной крышкой", ["item", "gear"], "утварь"),
        ("Свиток древних знаков", ["item", "magic"], "магический свиток"),
        ("Зелье терпения", ["item", "potion"], "зелье"),
        ("Амулет удачи", ["item", "magic", "jewelry"], "украшение"),
        ("Карта забытой тропы", ["item", "gear", "travel"], "карта"),
        ("Пайок странника", ["item", "consumable", "travel"], "провизия"),
        ("Факел вечного пламени", ["item", "gear", "camp"], "свет"),
    ]
    return [NameGeneratorEntry(name=n, tags=t, description=d) for n, t, d in rows]


class NameGeneratorsCodex:
    def get_entries(self) -> list[NameGeneratorEntry]:
        return _entries()

    def as_config(self) -> dict:
        entries = self.get_entries()
        tag_set: set[str] = set()
        for e in entries:
            tag_set.update(e.tags)
        return {
            "entries": [e.model_dump(mode="json") for e in entries],
            "tags": sorted(tag_set),
            "partKinds": ["given", "family", "nickname", "full"],
        }
