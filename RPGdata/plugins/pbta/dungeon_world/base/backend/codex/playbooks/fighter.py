from __future__ import annotations

from plugins.pbta.base.backend.types import DamageModifier, Move, Playbook
from ..multiclass_options import MULTICLASS_EFFECT_TEXT, MULTICLASS_MOVE_PLACEHOLDERS


fighter = Playbook(
    id="fighter",
    title="Воин",
    archetype="combat",
    summary=(
        "Закалённый боец и мастер оружия. "
        "Ты лучше всех знаешь, как ломать доспехи, кости и чужую уверенность."
    ),
    base_hp=10,
    base_load=12,
    damage_die="d10",
    starting_moves=[
        "fighter_bend_bars_lift_gates",
        "fighter_armored",
        "fighter_signature_weapon",
    ],
    advanced_moves=[
        "fighter_merciless",
        "fighter_heirloom",
        "fighter_armor_mastery",
        "fighter_improved_weapon",
        "fighter_interrogation",
        "fighter_scent_of_blood",
        "fighter_killers_eye",
        "fighter_iron_hide",
        "fighter_smith",
        "fighter_multiclass_dabbler",
    ],
    advanced_moves_6_10=[
        "fighter_bloodthirsty",
        "fighter_perfect_defense",
        "fighter_evil_eye",
        "fighter_taste_of_blood",
        "fighter_multiclass_initiate",
        "fighter_steel_hide",
        "fighter_eye_of_death",
        "fighter_weapon_expert",
        "fighter_great_warrior",
    ],
)


fighter_moves: list[Move] = [
    Move(
        id="fighter_bend_bars_lift_gates",
        title="Гнуть прутья, ломать двери",
        kind="class",
        available_stats=["str"],
        summary="Разрушить препятствие грубой силой.",
        trigger="Когда вы пытаетесь разрушить неодушевлённое препятствие грубой силой...",
        effect="Брось +STR.",
        effect_10_plus=(
            "Выберите три: быстро; ничего ценного не повреждено; без лишнего шума; "
            "можете починить то, что сломали."
        ),
        effect_7_9="Выберите два из того же списка.",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="fighter_armored",
        title="Привычный к доспехам",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Броня не делает вас неуклюжим.",
        trigger="",
        effect="Вы игнорируете свойство неуклюжий, которое накладывает броня.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_signature_weapon",
        title="Знаковое оружие",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Особое оружие, без которого вы не полны.",
        trigger="",
        effect=(
            "Ваше знаковое оружие — особая вещь. Вы не можете его потерять, "
            "исключая случаи, когда другой исход немыслим (и даже тогда можете попытаться вернуть). "
            "Выберите тип, длину, два свойства и внешний вид при создании персонажа."
            "Это ваше оружие. На свете много подобных ему, но это — ваше. Это ваш"
            "лучший друг. Вы — его хозяин, а оно — хозяин вашей жизни. Без вас это"
            "оружие бесполезно, равно как вы без него. Носите его с честью."
            "Выберите оружие из списка"
            "(каждое имеет вес 2):"
            "• Меч"
            "• Копьё"
            "• Топор"
            "• Цеп"
            "• Молот"
            "• Кулаки"
            "Выберите подходящую длину"
            "вашего оружия:"
            "• Рука"
            "• Взмах меча"
            "• Удар копья"
            "Выберите два особых свойства:"
            "• Крюки и шипы. Бонус +1 к урону, однако вес увеличивается на 1."
            "• Острое. Пробивание +2."
            "• Идеально сбалансированное. Добавьте свойство точное."
            "• Зазубренное лезвие. +1 к урону."
            "• Светится, когда рядом существа определённого типа (ваш выбор)."
            "• Огромные размеры. Добавьте свойства мощное и месиво."
            "• Универсальное. Выберите вторую длину."
            "• Мастерская работа. Вес -1."
            "Выберите, как оно выглядит:"
            "• Древнее"
            "• Безупречное"
            "• Богато украшенное"
            "• Закалённое в крови"
            "• Мрачное"
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_merciless",
        title="Безжалостный",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1d4 к урону.",
        trigger="",
        effect="Вы получаете бонус +1d4 к наносимому урону.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        damage_mods=[
            DamageModifier(extra_dice=["d4"], on_tier=["any_hit"], target="target", description="+1d4 урона"),
        ],
    ),
    Move(
        id="fighter_heirloom",
        title="Наследие",
        kind="advanced",
        available_stats=["cha"],
        summary="Духи знакового оружия дают видение.",
        trigger="Когда вы слушаете духов, обитающих в вашем знаковом оружии...",
        effect="Брось +CHA.",
        effect_10_plus="Мастер опишет ясное видение о текущей ситуации.",
        effect_7_9="Видение будет неточным и запутанным.",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="fighter_armor_mastery",
        title="Мастер защиты",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Принять удар на доспех или щит без урона.",
        trigger="",
        effect=(
            "Когда вы принимаете основной удар на доспех либо щит, вы не получаете урона, "
            "но должны уменьшить броню предмета на 1 каждый раз. При броне 0 предмет уничтожен."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_improved_weapon",
        title="Лучшее оружие",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Ещё одно свойство знакового оружия.",
        trigger="",
        effect="Наделите знаковое оружие ещё одним свойством.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_interrogation",
        title="Допрос",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Угроза насилия — рычаг переговоров.",
        trigger="",
        effect="Когда вы договариваетесь, используя угрозу физического насилия, можете использовать STR вместо CHA.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_scent_of_blood",
        title="Запах крови",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="После руби и кромсай — +1d4 по той же цели.",
        trigger="",
        effect="Если вы рубите и кромсаете, следующая атака по той же цели наносит +1d4 урона.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_killers_eye",
        title="Взгляд убийцы",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 к изучению обстановки в бою.",
        trigger="",
        effect="Изучая обстановку во время битвы, вы получаете +1 к броску этого хода.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_iron_hide",
        title="Железная шкура",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 к броне.",
        trigger="",
        effect="Вы получаете +1 к броне.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_smith",
        title="Кузнец",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Перенести свойства на знаковое оружие у кузни.",
        trigger="",
        effect=(
            "Когда у вас есть доступ к кузнице, можете наделить знаковое оружие "
            "волшебными свойствами другого оружия. Другое оружие будет уничтожено."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_multiclass_dabbler",
        title="Мультикласс: дилетант",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Ход другого класса на уровень ниже.",
        trigger="",
        effect=MULTICLASS_EFFECT_TEXT,
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="fighter_bloodthirsty",
        title="Кровожадный",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Безжалостный.",
        trigger="",
        effect="Вы получаете бонус +1d8 к наносимому урону.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_perfect_defense",
        title="Идеальная защита",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Мастер защиты.",
        trigger="",
        effect=(
            "Принимая удар на доспех или щит, не получаете урона и +1 на следующий ход против атакующего, "
            "но снижаете броню предмета на 1. При 0 — предмет уничтожен."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_evil_eye",
        title="Дурной глаз",
        kind="advanced",
        available_stats=["cha"],
        summary="Требует: Взгляд убийцы.",
        trigger="В начале битвы...",
        effect=(
            "Брось +CHA."
            "Если вы посмотрите в глаза персонажа ведущего, находящегося рядом, и потратите"
            "запас, он застынет на месте или отступит, и не сможет ничего делать, пока"
            "вы не отведете взгляд."
        ),
        effect_10_plus="Запас 2.",
        effect_7_9="Запас 1.",
        effect_6_minus="Противники считают вас главной угрозой.",
    ),
    Move(
        id="fighter_taste_of_blood",
        title="Вкус крови",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Запах крови.",
        trigger="",
        effect="После руби и кромсай следующая атака по той же цели наносит +1d8 урона.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_multiclass_initiate",
        title="Мультикласс: посвящённый",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Требует: Мультикласс: дилетант.",
        trigger="",
        effect="Возьмите один ход другого класса, будто ваш уровень ниже на 1.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="fighter_steel_hide",
        title="Стальная шкура",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Железная шкура.",
        trigger="",
        effect="Вы получаете +2 к броне.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_eye_of_death",
        title="Глазами смерти",
        kind="advanced",
        available_stats=["wis"],
        summary="Видение исхода боя.",
        trigger="В начале боя...",
        effect="Брось +WIS.",
        effect_10_plus="Назовите, кто переживёт бой, и кто погибнет (NPC).",
        effect_7_9="Назовите одного из двух.",
        effect_6_minus="Видите свою смерть: −1 на все ходы до конца битвы.",
    ),
    Move(
        id="fighter_weapon_expert",
        title="Знаток оружия",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Узнать урон оружия противника.",
        trigger="",
        effect="Рассматривая оружие противника, можете выяснить у мастера, сколько урона оно наносит.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="fighter_great_warrior",
        title="Великий воитель",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="На 12+ при руби и кромсай — впечатлить или напугать.",
        trigger="",
        effect=(
            "Когда вы, рубя и кромсая, получаете 12+, вы не просто наносите урон и избегаете ответа, "
            "но впечатляете, лишаете мужества или приводите в ужас противника."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
]
