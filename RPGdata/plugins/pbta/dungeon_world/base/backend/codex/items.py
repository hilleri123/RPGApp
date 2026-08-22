from __future__ import annotations
from pydantic import BaseModel


class TagMeta(BaseModel):
    id:      str
    label:   str
    hint:    str = ""
    effect:  str = ""


class TagMechanics(BaseModel):
    """Механические эффекты тега, которые применяются при enrich."""
    # Модификатор к броне (например shield: +armor_value)
    armor_bonus:      int  = 0
    # Заменяет STR на DEX для hack&slash (precise)
    use_dex_for_melee: bool = False
    # -1 ongoing пока надет (clumsy)
    ongoing_penalty:  int  = 0
    # Игнорирует броню цели при ударе
    ignores_armor:    bool = False
    # Нельзя использовать щит одновременно
    no_shield:        bool = False
    # Мощный удар — отброс на 10+
    forceful:         bool = False
    # Нужна перезарядка
    requires_reload:  bool = False


class TagDefinition(BaseModel):
    meta:       TagMeta
    mechanics:  TagMechanics = TagMechanics()


class ItemsCodex:
    """
    Источник правды о тегах DW.
    Содержит и метаданные (для UI), и механические эффекты (для enrich).
    """

    # ── range ──────────────────────────────────────────────────────────────────

    RANGE_TAGS: list[TagDefinition] = [
        TagDefinition(meta=TagMeta(id="hand",  label="Hand",  hint="вплотную",                   effect="только вплотную")),
        TagDefinition(meta=TagMeta(id="close", label="Close", hint="в пределах вытянутой руки",  effect="стандартная дистанция")),
        TagDefinition(meta=TagMeta(id="reach", label="Reach", hint="длиннодревковое оружие",     effect="атака через ряд")),
        TagDefinition(meta=TagMeta(id="near",  label="Near",  hint="метательное / короткий лук", effect="ближняя дистанция Volley")),
        TagDefinition(meta=TagMeta(id="far",   label="Far",   hint="длинный лук / арбалет",      effect="дальняя дистанция Volley")),
    ]

    # ── weapon mechanic ───────────────────────────────────────────────────────

    WEAPON_MECHANIC_TAGS: list[TagDefinition] = [
        TagDefinition(
            meta=TagMeta(id="two-handed", label="Two-handed", hint="требует обе руки",
                         effect="нельзя использовать щит"),
            mechanics=TagMechanics(no_shield=True),
        ),
        TagDefinition(
            meta=TagMeta(id="forceful", label="Forceful", hint="мощный удар",
                         effect="на 10+ можно отбросить врага"),
            mechanics=TagMechanics(forceful=True),
        ),
        TagDefinition(
            meta=TagMeta(id="precise", label="Precise", hint="точное оружие",
                         effect="используй DEX вместо STR для Hack&Slash"),
            mechanics=TagMechanics(use_dex_for_melee=True),
        ),
        TagDefinition(
            meta=TagMeta(id="reload", label="Reload", hint="нужна перезарядка",
                         effect="после выстрела нужно действие для перезарядки"),
            mechanics=TagMechanics(requires_reload=True),
        ),
        TagDefinition(
            meta=TagMeta(id="thrown", label="Thrown", hint="можно метать",
                         effect="можно применять как near при броске")),
        TagDefinition(
            meta=TagMeta(id="messy", label="Messy", hint="рвёт и калечит",
                         effect="урон особенно жестокий и явный")),
        TagDefinition(
            meta=TagMeta(id="ignores-armor", label="Ignores Armor", hint="игнорирует броню",
                         effect="броня цели не учитывается"),
            mechanics=TagMechanics(ignores_armor=True),
        ),
    ]

    # ── armor mechanic ────────────────────────────────────────────────────────

    ARMOR_MECHANIC_TAGS: list[TagDefinition] = [
        TagDefinition(
            meta=TagMeta(id="worn",   label="Worn",   hint="надевается на тело",
                         effect="занимает слот брони")),
        TagDefinition(
            meta=TagMeta(id="clumsy", label="Clumsy", hint="-1 ongoing пока носишь",
                         effect="-1 ongoing ко всем броскам пока надет"),
            mechanics=TagMechanics(ongoing_penalty=-1),
        ),
        TagDefinition(
            meta=TagMeta(id="shield", label="Shield", hint="это щит",
                         effect="значение стакается с бронёй (+n armor)"),
            mechanics=TagMechanics(armor_bonus=1),  # фактическое значение берётся из ArmorValue
        ),
    ]

    # ── general ───────────────────────────────────────────────────────────────

    GENERAL_TAGS: list[TagDefinition] = [
        TagDefinition(meta=TagMeta(id="magical",   label="Magical",   hint="магический предмет",    effect="взаимодействует с магическими эффектами")),
        TagDefinition(meta=TagMeta(id="awkward",   label="Awkward",   hint="неудобно использовать", effect="требует особых условий применения")),
        TagDefinition(meta=TagMeta(id="dangerous", label="Dangerous", hint="опасен для носителя",   effect="мастер может использовать против игрока")),
        TagDefinition(meta=TagMeta(id="applied",   label="Applied",   hint="наносится / поедается", effect="нужен контакт для применения")),
        TagDefinition(meta=TagMeta(id="slow",      label="Slow",      hint="медленное использование", effect="требует время / подготовку")),
        TagDefinition(meta=TagMeta(id="valuable",  label="Valuable",  hint="ценный предмет",        effect="можно продать по высокой цене")),
    ]

    # ── helpers ───────────────────────────────────────────────────────────────

    def all_definitions(self) -> list[TagDefinition]:
        return (
            self.RANGE_TAGS
            + self.WEAPON_MECHANIC_TAGS
            + self.ARMOR_MECHANIC_TAGS
            + self.GENERAL_TAGS
        )

    def mechanics_map(self) -> dict[str, TagMechanics]:
        """id → TagMechanics. Только теги с ненулевой механикой."""
        return {
            d.meta.id: d.mechanics
            for d in self.all_definitions()
            if d.mechanics != TagMechanics()
        }

    def meta_map(self) -> dict[str, TagMeta]:
        return {d.meta.id: d.meta for d in self.all_definitions()}

    def config_dict(self) -> dict[str, list[dict]]:
        """Для фронта: только метаданные, без механики."""
        def to_meta(defs: list[TagDefinition]) -> list[dict]:
            return [d.meta.model_dump() for d in defs]
        return {
            "range":           to_meta(self.RANGE_TAGS),
            "weapon_mechanic": to_meta(self.WEAPON_MECHANIC_TAGS),
            "armor_mechanic":  to_meta(self.ARMOR_MECHANIC_TAGS),
            "general":         to_meta(self.GENERAL_TAGS),
        }