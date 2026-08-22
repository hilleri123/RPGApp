from __future__ import annotations
from pydantic import BaseModel

class TagMeta(BaseModel):
    id:     str
    label:  str
    hint:   str = ""

class NpcCodex:
    """Метаданные тегов NPC/монстров DW. Без конкретных существ."""

    # Масштаб / организация [web:111]
    GROUP_TAGS: list[TagMeta] = [
        TagMeta(id="solitary", label="Solitary", hint="одно существо, опасное само по себе"),
        TagMeta(id="group",    label="Group",    hint="небольшая группа 3-6"),
        TagMeta(id="horde",    label="Horde",    hint="толпа, действуют вместе"),
    ]

    # Интеллект / природа
    NATURE_TAGS: list[TagMeta] = [
        TagMeta(id="intelligent",  label="Intelligent",  hint="способно рассуждать и договариваться"),
        TagMeta(id="devious",      label="Devious",      hint="опасно не силой, а хитростью"),
        TagMeta(id="magical",      label="Magical",      hint="магической природы"),
        TagMeta(id="divine",       label="Divine",       hint="связано с богами"),
        TagMeta(id="planar",       label="Planar",       hint="из другого плана"),
        TagMeta(id="undead",       label="Undead",       hint="нежить"),
        TagMeta(id="construct",    label="Construct",    hint="создан искусственно"),
        TagMeta(id="amorphous",    label="Amorphous",    hint="не имеет фиксированной формы"),
    ]

    # Размер
    SIZE_TAGS: list[TagMeta] = [
        TagMeta(id="tiny",   label="Tiny",   hint="очень маленькое"),
        TagMeta(id="small",  label="Small",  hint="меньше человека"),
        TagMeta(id="large",  label="Large",  hint="крупнее человека"),
        TagMeta(id="huge",   label="Huge",   hint="огромное, больше телеги"),
    ]

    # Поведение
    BEHAVIOR_TAGS: list[TagMeta] = [
        TagMeta(id="stealthy",   label="Stealthy",   hint="скрытное, застаёт врасплох"),
        TagMeta(id="organized",  label="Organized",  hint="действует тактически"),
        TagMeta(id="terrifying", label="Terrifying", hint="вызывает страх одним присутствием"),
        TagMeta(id="cautious",   label="Cautious",   hint="не бросается в бой без нужды"),
    ]

    # Особые качества (special qualities) — свободный текст, но часто повторяются
    COMMON_SPECIAL_QUALITIES: list[TagMeta] = [
        TagMeta(id="burrowing",   label="Burrowing",   hint="может зарываться в землю"),
        TagMeta(id="intangible",  label="Intangible",  hint="нематериальное"),
        TagMeta(id="flying",      label="Flying",      hint="летает"),
        TagMeta(id="swimming",    label="Swimming",    hint="плавает"),
        TagMeta(id="regeneration",label="Regeneration",hint="восстанавливает HP"),
        TagMeta(id="venomous",    label="Venomous",    hint="яд при укусе/атаке"),
    ]

    # Теги атаки (те же что у оружия + монстровые)
    ATTACK_TAGS: list[TagMeta] = [
        TagMeta(id="messy",         label="Messy",         hint="рвёт и калечит"),
        TagMeta(id="forceful",      label="Forceful",      hint="отбрасывает / ломает"),
        TagMeta(id="ignores-armor", label="Ignores Armor", hint="игнорирует броню"),
        TagMeta(id="precise",       label="Precise",       hint="точная атака"),
        TagMeta(id="slow",          label="Slow",          hint="медленная атака"),
        TagMeta(id="reach",         label="Reach",         hint="длиннодревковая / длинная"),
    ]

    RANGE_TAGS: list[TagMeta] = [
        TagMeta(id="hand",  label="Hand"),
        TagMeta(id="close", label="Close"),
        TagMeta(id="reach", label="Reach"),
        TagMeta(id="near",  label="Near"),
        TagMeta(id="far",   label="Far"),
    ]

    DAMAGE_DICE = ["d4", "d6", "d8", "d10", "d12", "2d6", "2d8"]

    def config(self) -> dict:
        return {
            "group_tags":              [t.model_dump() for t in self.GROUP_TAGS],
            "nature_tags":             [t.model_dump() for t in self.NATURE_TAGS],
            "size_tags":               [t.model_dump() for t in self.SIZE_TAGS],
            "behavior_tags":           [t.model_dump() for t in self.BEHAVIOR_TAGS],
            "special_quality_presets": [t.model_dump() for t in self.COMMON_SPECIAL_QUALITIES],
            "attack_tags":             [t.model_dump() for t in self.ATTACK_TAGS],
            "range_tags":              [t.model_dump() for t in self.RANGE_TAGS],
            "damage_dice":             self.DAMAGE_DICE,
        }
