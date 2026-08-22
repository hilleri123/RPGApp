from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, NonNegativeInt


# ── Базовые перечисления ──────────────────────────────────────────────────────

MoveKind = Literal["basic", "class", "advanced", "custom", "special", "gm", "race"]

RollTier = Literal[
    "10_plus",
    "7_9",
    "6_minus",
    "any_hit",      # 7+
    "any",          # всегда
]

ResourceKind = Literal[
    "bonus",        # forward / ongoing — бонус к броску
    "hold",         # hold-очки (тратятся по текстовке хода)
    "spell",        # слот заклинания / подготовленный спелл
    "ammo",         # патроны / заряды
    "use",          # разовые использования способности
    "flag",         # булев флаг состояния
    "armor",        # очки брони (могут быть временными)
    "custom",       # любой другой ресурс
]

ResourceModKind = Literal[
    "add",          # добавить N единиц
    "remove",       # потратить N единиц
    "set",          # установить в конкретное значение
    "clear",        # удалить все ресурсы этого spec_id у цели
]

ResourceTarget = Literal["self", "ally", "enemy", "target", "all_allies", "all_enemies"]

ConsumeOn = Literal[
    "declare",          # при заявке хода (до броска)
    "roll",             # при броске (например, forward)
    "apply",            # при применении результата
    "scene_end",        # в конце сцены
    "manual",           # вручную мастером / логикой
]


# ── Спецификация ресурса (что это вообще такое) ───────────────────────────────

class ResourceSpec(BaseModel):
    """
    Описание типа ресурса: что это, сколько максимум, как тратится.
    Хранится в codex'е, не в состоянии персонажа.
    """
    id: str
    title: str
    kind: ResourceKind = "custom"
    max_amount: Optional[int] = None        # None = без ограничения
    consume_on: ConsumeOn = "manual"
    expires_after_scene: bool = False
    description: str = ""


# ── Конкретный ресурс в состоянии актора ─────────────────────────────────────

class ResourceState(BaseModel):
    """
    Фактический ресурс у персонажа/npc/сцены.
    """
    spec_id: str                            # ссылка на ResourceSpec.id
    amount: int = 1
    source_move_id: str = ""

    # Фильтры применимости (для bonus/ongoing):
    # если списки пустые — применяется к любым статам/ходам/тегам
    filter_stats:  list[str] = Field(default_factory=list)
    filter_moves:  list[str] = Field(default_factory=list)
    filter_tags:   list[str] = Field(default_factory=list)

    # Жизненный цикл (переопределяет ResourceSpec если задан)
    consume_on: Optional[ConsumeOn] = None
    expires_after_scene: Optional[bool] = None

    description: str = ""


# ── Модификатор ресурса (что ход делает с ресурсами) ─────────────────────────

class ResourceModifier(BaseModel):
    """
    Декларирует изменение ресурса при срабатывании хода.
    Заменяет TempBonus + MoveBonusTemplate.

    Примеры:
    - потратить заряд при использовании хода
    - добавить hold 3 на 10+ / hold 1 на 7-9
    - добавить forward +1 союзнику на any_hit
    - восполнить все spell на 10+
    - добавить ongoing бонус к броску
    """
    kind: ResourceModKind = "add"
    spec_id: str                            # какой ресурс (ResourceSpec.id)
    amount: int = 1

    # Когда применяется (пустой список = всегда)
    on_tier: list[RollTier] = Field(default_factory=list)

    # Кому выдаётся
    target: ResourceTarget = "self"

    # Если создаётся ресурс типа bonus — вот его фильтры применимости
    filter_stats:  list[str] = Field(default_factory=list)
    filter_moves:  list[str] = Field(default_factory=list)
    filter_tags:   list[str] = Field(default_factory=list)

    description: str = ""


# ── Модификатор урона ─────────────────────────────────────────────────────────

class DamageModifier(BaseModel):
    """
    Декларирует вклад хода в заявку на урон.

    Примеры:
    - базовый кубик урона класса: set_base_die="d8"
    - +1d6 к урону на 10+
    - добавить тег messy
    - игнорировать броню
    """
    flat_bonus:     int         = 0
    extra_dice:     list[str]   = Field(default_factory=list)   # ["d4", "d6"]
    add_tags:       list[str]   = Field(default_factory=list)   # ["messy", "forceful"]
    set_base_die:   Optional[str] = None    # "d8" — задаёт базовый дайс
    ignores_armor:  bool        = False
    piercing:       int         = 0         # уменьшить броню цели на N

    # Когда применяется (пустой список = всегда)
    on_tier:    list[RollTier]  = Field(default_factory=list)

    # На кого направлен урон
    target: Literal["enemy", "target", "self", "all_targets"] = "target"

    description: str = ""


# ── Условие применимости хода ─────────────────────────────────────────────────

class MoveCondition(BaseModel):
    """
    Когда ход вообще доступен / попадает в пул.
    """
    requires_resource:  list[str]   = Field(default_factory=list)  # spec_id должны быть > 0
    requires_context:   list[str]   = Field(default_factory=list)  # теги контекста: "melee", "ranged"
    requires_moves:     list[str]   = Field(default_factory=list)  # другой ход должен быть активен
    forbidden_context:  list[str]   = Field(default_factory=list)  # недоступен при этих тегах


# ── Фабрика ресурса (шаблон для копирования / выдачи) ─────────────────────────

FactorySource = Literal["character", "move", "spell", "codex", "custom"]


class ResourceFactory(BaseModel):
    """
    Место, откуда можно скопировать и выдать ресурс.
    Живёт на персонаже (заклинания мага, сигнатурные hold и т.п.),
    на ходе (grant_resources) или собирается ad-hoc в perform_move.
    """
    id: str
    spec_id: str
    amount: int = 1
    kind: ResourceModKind = "add"
    label: str = ""
    description: str = ""
    source: FactorySource = "custom"
    source_id: str = ""
    source_title: str = ""
    filter_stats: list[str] = Field(default_factory=list)
    filter_moves: list[str] = Field(default_factory=list)
    filter_tags: list[str] = Field(default_factory=list)
    inline_spec: Optional[ResourceSpec] = None
    on_tier: list[RollTier] = Field(default_factory=list)


# ── Ресурс, который ход может выдать ─────────────────────────────────────────

class MoveGrantResource(BaseModel):
    """
    Шаблон выдачи ресурса из хода.
    spec_id ссылается на ResourceSpec в кодексе; inline_spec — для кастомных ресурсов хода.
    """
    spec_id: str
    inline_spec: Optional[ResourceSpec] = None
    amount: int = 1
    on_tier: list[RollTier] = Field(default_factory=list)
    target: ResourceTarget = "self"
    filter_stats: list[str] = Field(default_factory=list)
    filter_moves: list[str] = Field(default_factory=list)
    filter_tags: list[str] = Field(default_factory=list)
    description: str = ""

    @classmethod
    def from_modifier(cls, mod: ResourceModifier) -> MoveGrantResource:
        return cls(
            spec_id=mod.spec_id,
            amount=int(mod.amount or 1),
            on_tier=list(mod.on_tier or []),
            target=mod.target,
            filter_stats=list(mod.filter_stats or []),
            filter_moves=list(mod.filter_moves or []),
            filter_tags=list(mod.filter_tags or []),
            description=mod.description or "",
        )

    def to_factory(self, *, move_id: str, move_title: str = "") -> ResourceFactory:
        label = self.description or f"{move_title or move_id}: {self.spec_id}"
        return ResourceFactory(
            id=f"move:{move_id}:{self.spec_id}:{self.amount}",
            spec_id=self.spec_id,
            amount=int(self.amount or 1),
            kind="add",
            label=label,
            description=self.description or "",
            source="move",
            source_id=move_id,
            source_title=move_title,
            filter_stats=list(self.filter_stats or []),
            filter_moves=list(self.filter_moves or []) or ([move_id] if move_id else []),
            filter_tags=list(self.filter_tags or []),
            inline_spec=self.inline_spec,
            on_tier=list(self.on_tier or []),
        )


# ── Кастомный ход персонажа ───────────────────────────────────────────────────

class CustomMove(BaseModel):
    """
    Ход, созданный игроком для конкретного персонажа.
    Конвертируется в Move при использовании в perform_move.
    """
    id:    str
    title: str
    available_stats: list[str] = Field(default_factory=list)
    tags:  list[str] = Field(default_factory=list)

    summary:      str = ""
    trigger:      str = ""
    effect:       str = ""
    effect_10_plus: str = ""
    effect_7_9:     str = ""
    effect_6_minus: str = ""

    grant_resources: list[MoveGrantResource] = Field(default_factory=list)


class MoveTextOverride(BaseModel):
    """Текстовые правки классового хода на листе (id хода из codex)."""
    title: str = ""
    summary: str = ""
    trigger: str = ""
    effect: str = ""
    effect_10_plus: str = ""
    effect_7_9: str = ""
    effect_6_minus: str = ""


# ── Плейсхолдеры на листе персонажа (выбор при создании/редактировании) ───────

class MovePlaceholderOption(BaseModel):
    id: str
    label: str


class MovePlaceholder(BaseModel):
    id: str
    label: str
    kind: Literal["enum", "text", "move_pick"] = "text"
    required: bool = True
    options: list[MovePlaceholderOption] = Field(default_factory=list)
    level_delta: int = -1


# ── Ход ───────────────────────────────────────────────────────────────────────

class Move(BaseModel):
    """
    Декларативное описание хода.
    Ход не знает о фазах пайплайна.
    Он даёт инструменты: статы, тексты, модификаторы ресурсов и урона.
    Мастер и движок используют их согласно текстовке.
    """
    model_config = ConfigDict(frozen=True)

    id:    str
    title: str
    kind:  MoveKind = "class"
    tags:  list[str] = Field(default_factory=list)

    # Условие доступности
    condition: MoveCondition = Field(default_factory=MoveCondition)

    # Допустимые статы для броска
    available_stats: list[str] = Field(default_factory=list)

    # Текстовки
    summary:      str = ""
    trigger:      str = ""
    effect:       str = ""
    effect_10_plus: str = ""
    effect_7_9:     str = ""
    effect_6_minus: str = ""

    # Модификаторы ресурсов (hold, forward, spell, ammo и т.п.)
    resource_mods: list[ResourceModifier] = Field(default_factory=list)

    # Шаблоны ресурсов, которые ход может выдать (для авто-черновиков и копирования в UI)
    grant_resources: list[MoveGrantResource] = Field(default_factory=list)

    # Модификаторы урона
    damage_mods: list[DamageModifier] = Field(default_factory=list)

    placeholders: list[MovePlaceholder] = Field(default_factory=list)

    # Ход творит заклинание — в perform_move доступен выбор подготовленного заклинания
    casts_spell: bool = False


# ── Playbook identity (раса, мировоззрение) ───────────────────────────────────

class PlaybookRaceOption(BaseModel):
    model_config = ConfigDict(frozen=True)

    id:       str
    title:    str
    move_id:  str


class PlaybookAlignmentOption(BaseModel):
    model_config = ConfigDict(frozen=True)

    id:      str
    title:   str
    summary: str = ""


# ── Playbook ──────────────────────────────────────────────────────────────────

class Playbook(BaseModel):
    model_config = ConfigDict(frozen=True)

    id:    str
    title: str
    archetype: str = ""
    summary:   str = ""

    base_hp:     NonNegativeInt = 4
    damage_die:  str = "d6"         # базовый кубик урона класса
    base_load:   NonNegativeInt = 10

    starting_moves: list[str] = Field(default_factory=list)
    """Mandatory starting move ids (always on the character)."""
    starting_move_choices: list[list[str]] = Field(default_factory=list)
    """Each inner list: pick exactly one move id at creation (e.g. barbarian armor)."""
    advanced_moves:  list[str] = Field(default_factory=list)
    advanced_moves_6_10: list[str] = Field(default_factory=list)

    races:       list[PlaybookRaceOption] = Field(default_factory=list)
    alignments:  list[PlaybookAlignmentOption] = Field(default_factory=list)